// Dev-server routes for the studio. The DeepSeek key stays in .env.local.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  EFFECT_SYSTEM_PROMPT,
  extractJsonObject,
  pluginSkeleton,
  readGeneratedHeader,
  stamp,
} from './src/engine/effect-source.ts';
import {
  MAX_SHOTS,
  REUSE_ALLOW,
  ROLES as SHOT_ROLES,
  STAGE1_SYSTEM,
  STAGE2_SYSTEM,
  classNameFor,
  EXEMPLARS,
  fitStage2Prompt,
  fitWindows,
  parseArrangeShots,
  seal,
  tempPluginId,
  type ArrangeShot,
  type Role,
  type ShotProgramEvent,
  type ShotWindow,
} from './src/engine/shot-program.ts';
import { Lyrics, type Line } from './src/engine/lyrics.ts';

export const PLUGIN_SKIP = new Set(['bespoke-helper.ts', 'lyric-aware-plugin.ts']);

export function loadEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

export function studioSecrets(root: string) {
  const env = { ...loadEnvFile(path.join(root, '.env')), ...loadEnvFile(path.join(root, '.env.local')) };
  return {
    apiKey: env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || '',
    model: env.DEEPSEEK_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-flash',
    base: (env.DEEPSEEK_BASE_URL || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
  };
}

export function listPlugins(pluginsDir: string) {
  const files = fs.readdirSync(pluginsDir).filter((f) => f.endsWith('.ts') && !PLUGIN_SKIP.has(f));
  return files.map((f) => {
    const id = f.replace(/\.ts$/, '');
    const head = fs.readFileSync(path.join(pluginsDir, f), 'utf8').slice(0, 240);
    const generated = readGeneratedHeader(head);
    const status = generated?.status ?? (generated?.kind === 'asset' ? 'asset' : null);
    const origin = id.startsWith('plate-') ? 'film' : generated ? 'generated' : 'bespoke';
    return {
      id,
      origin,
      status: generated && status == null ? 'asset' : status,
      layerRole: generated?.role ?? (origin === 'film' ? 'background' : ''),
      zh: generated?.zh ?? '',
      ownsLyrics: generated?.owns ?? null,
    };
  });
}

export function listTracks(root: string) {
  const tracksRoot = path.join(root, 'public/tracks');
  if (!fs.existsSync(tracksRoot)) return [];
  return fs
    .readdirSync(tracksRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^[a-zA-Z0-9_-]+$/.test(d.name))
    .map((d) => {
      const dir = path.join(tracksRoot, d.name);
      return {
        id: d.name,
        hasAudio: fs.existsSync(path.join(dir, 'audio.json')),
        hasLyrics: fs.existsSync(path.join(dir, 'lyrics.json')),
        hasTimeline: fs.existsSync(path.join(dir, 'timeline.json')),
      };
    })
    .filter((t) => t.hasAudio && t.hasLyrics)
    .sort((a, b) => (a.id === 'demo' ? -1 : b.id === 'demo' ? 1 : a.id.localeCompare(b.id)));
}

const ROLES = new Set(['background', 'imagery', 'accent', 'typography']);

function assertId(id: string) {
  if (!/^[a-z][a-z0-9-]{1,48}$/.test(id)) throw new Error(`插件 id 不合法: ${id}`);
  if (PLUGIN_SKIP.has(`${id}.ts`)) throw new Error(`插件 id 被保留: ${id}`);
}

async function complete(root: string, user: string, json: boolean, maxTokens: number, system = EFFECT_SYSTEM_PROMPT) {
  const { apiKey, model, base } = studioSecrets(root);
  if (!apiKey) throw new Error('没有读到 DEEPSEEK_API_KEY。把它放在 app/.env.local。');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      thinking: { type: 'disabled' },
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: AbortSignal.timeout(180000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`DeepSeek HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = JSON.parse(text) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
  const content = data.choices?.[0]?.message?.content ?? '';
  if (!content.trim()) throw new Error('模型没有返回正文');
  return { content, finishReason: data.choices?.[0]?.finish_reason ?? '' };
}

const GRADES = ['cold-industrial', 'warning-crimson', 'cyber-green', 'void-monochrome', 'noir-gold'];

const ASSEMBLE_SYSTEM = `你是分镜装配。只输出 JSON，不要 Markdown。
从给定目录里为每个镜头各选一个 background、imagery、accent、typography 插件 id，再选一个 colorGrade。
id 必须原样复制目录中的 id，而且角色必须一致。colorGrade 只能是 cold-industrial、warning-crimson、cyber-green、void-monochrome、noir-gold。
一个镜头里有多句歌词时，字效交给 typography 角色的插件。不要把 plate- 原片整幕当作字效层。
纯器乐镜头也要选满四层，背景优先 terrain、tunnel、plate-open、plate-outro。
返回 {"shots":[{"index":0,"background":"...","imagery":"...","accent":"...","typography":"...","colorGrade":"...","rationale":"一句中文"}]}`;

export interface AssembledShot {
  index: number;
  background: string;
  imagery: string;
  accent: string;
  typography: string;
  colorGrade: string;
  rationale: string;
}

export async function assembleShots(root: string, body: {
  shots?: { index?: number; lyric?: string }[];
  catalog?: { id?: string; role?: string; zh?: string; description?: string }[];
}): Promise<AssembledShot[]> {
  const known = new Set(listPlugins(path.join(root, 'src/plugins')).map((p) => p.id));
  const catalog = (body.catalog ?? [])
    .map((item) => ({
      id: String(item.id ?? ''),
      role: String(item.role ?? ''),
      zh: String(item.zh ?? '').slice(0, 40),
      description: String(item.description ?? '').replace(/\s+/g, ' ').slice(0, 80),
    }))
    .filter((item) => known.has(item.id) && ROLES.has(item.role));
  if (catalog.length < 4) throw new Error('插件目录不够装配四层');

  const byRole = new Map<string, string[]>();
  for (const item of catalog) {
    const list = byRole.get(item.role) ?? [];
    list.push(item.id);
    byRole.set(item.role, list);
  }
  for (const role of ROLES) {
    if (!(byRole.get(role)?.length)) throw new Error(`目录里没有 ${role} 插件`);
  }

  const shots = (body.shots ?? []).slice(0, 40).map((shot, i) => ({
    index: Number.isFinite(shot.index) ? Number(shot.index) : i,
    lyric: String(shot.lyric ?? '').replace(/\s+/g, ' ').slice(0, 400) || '(纯器乐，没有歌词)',
  }));
  if (shots.length === 0) throw new Error('没有要装配的镜头');

  const catalogText = catalog.map((item) => `${item.id} | ${item.role} | ${item.zh} | ${item.description}`).join('\n');
  const shotText = shots.map((shot) => `#${shot.index}: ${shot.lyric}`).join('\n');
  const { content } = await complete(
    root,
    `目录:\n${catalogText}\n\n镜头:\n${shotText}`,
    true,
    Math.min(8000, 600 + shots.length * 220),
    ASSEMBLE_SYSTEM,
  );
  let parsed: any;
  try {
    parsed = extractJsonObject(content);
  } catch {
    throw new Error('模型没有返回可解析的装配 JSON');
  }
  const rows = Array.isArray(parsed?.shots) ? parsed.shots : [];
  const choose = (role: string, wanted: unknown) => {
    const pool = byRole.get(role)!;
    const id = String(wanted ?? '');
    if (pool.includes(id)) return id;
    if (role === 'background') {
      return pool.find((name) => name === 'terrain' || name === 'tunnel' || name === 'plate-open') ?? pool[0]!;
    }
    if (role === 'typography') {
      return pool.find((name) => name === 'kinetic-press' || name === 'typography' || name === 'cyber-prompt') ?? pool[0]!;
    }
    return pool[0]!;
  };
  return shots.map((shot, i) => {
    const row = rows.find((item: any) => Number(item?.index) === shot.index) ?? rows[i] ?? {};
    const grade = String(row.colorGrade ?? '');
    return {
      index: shot.index,
      background: choose('background', row.background),
      imagery: choose('imagery', row.imagery),
      accent: choose('accent', row.accent),
      typography: choose('typography', row.typography),
      colorGrade: GRADES.includes(grade) ? grade : 'cold-industrial',
      rationale: String(row.rationale ?? '').replace(/\s+/g, ' ').slice(0, 180),
    };
  });
}

export interface GeneratedFile {
  id: string;
  role: string;
  zh: string;
  path: string;
}

export async function generateEffects(root: string, body: {
  mode?: string;
  id?: string;
  prefix?: string;
  layerRole?: string;
  brief?: string;
  overwrite?: boolean;
}): Promise<GeneratedFile[]> {
  const brief = String(body.brief ?? '').trim();
  if (brief.length < 4) throw new Error('先写画面描述');
  if (brief.length > 4000) throw new Error('描述超过 4000 字');
  const pluginsDir = path.join(root, 'src/plugins');
  const mode = body.mode === 'one' ? 'one' : 'stack';

  const write = (id: string, role: string, zh: string, code: string) => {
    assertId(id);
    const target = path.join(pluginsDir, `${id}.ts`);
    if (fs.existsSync(target) && !body.overwrite) throw new Error(`已存在 ${id}.ts。勾选覆盖后再写。`);
    const stamped = stamp(role, zh, code);
    fs.writeFileSync(target, stamped.endsWith('\n') ? stamped : `${stamped}\n`, 'utf8');
    return { id, role, zh, path: target };
  };

  if (mode === 'one') {
    const role = String(body.layerRole ?? 'imagery');
    if (!ROLES.has(role)) throw new Error('图层角色不对');
    const id = String(body.id ?? '').trim();
    assertId(id);
    const className = id.replace(/(^|-)([a-z])/g, (_, __, c: string) => c.toUpperCase());
    const { content } = await complete(
      root,
      `写一个${role}层插件。类名必须是 ${className}。画面：${brief}\n以这个骨架为起点，只改着色器和需要的 uniform。\n${pluginSkeleton(className, role)}`,
      false,
      4000,
    );
    return [write(id, role, brief.slice(0, 24), content)];
  }

  const prefix = String(body.prefix ?? body.id ?? '').trim();
  assertId(prefix);
  const { content } = await complete(
    root,
    `按同一画面写四个插件，返回 JSON。键是 background、imagery、accent、typography。每个值是 { "zh": "四字以内中文名", "code": "完整 TypeScript 源码" }。每个 code 都从对应骨架改着色器，类名分别用 ${prefix.replace(/(^|-)([a-z])/g, (_, __, c: string) => c.toUpperCase())}Bg / Img / Acc / Typo。画面：${brief}\n背景骨架：\n${pluginSkeleton('Bg', 'background')}`,
    true,
    12000,
  );
  const parsed = extractJsonObject(content) as Record<string, { zh?: string; code?: string }>;
  const spec = [
    ['background', `${prefix}-bg`],
    ['imagery', `${prefix}-img`],
    ['accent', `${prefix}-acc`],
    ['typography', `${prefix}-typo`],
  ] as const;
  const written: GeneratedFile[] = [];
  for (const [role, id] of spec) {
    const item = parsed[role];
    if (!item?.code) throw new Error(`模型没有给出 ${role} 的源码`);
    written.push(write(id, role, String(item.zh ?? role), item.code));
  }
  return written;
}

export function saveLyricsFile(root: string, track: string, lyrics: unknown) {
  if (!/^[a-zA-Z0-9_-]+$/.test(track)) throw new Error('曲目名不合法');
  if (!lyrics || typeof lyrics !== 'object' || !Array.isArray((lyrics as { lines?: unknown }).lines)) {
    throw new Error('歌词文件必须有 lines 数组');
  }
  const dir = path.join(root, 'public/tracks', track);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, 'lyrics.json');
  fs.writeFileSync(target, JSON.stringify(lyrics, null, 2), 'utf8');
  return target;
}

function trackDir(root: string, track: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(track)) throw new Error('曲目名不合法');
  if (track === 'default') throw new Error('default 曲目走 makeTimeline()，不写 timeline.json');
  return path.join(root, 'public/tracks', track);
}

function loadTrackLyrics(root: string, track: string) {
  const dir = trackDir(root, track);
  const lyrics = JSON.parse(fs.readFileSync(path.join(dir, 'lyrics.json'), 'utf8'));
  const audio = JSON.parse(fs.readFileSync(path.join(dir, 'audio.json'), 'utf8'));
  return { lyrics: new Lyrics(lyrics), audio, lines: new Lyrics(lyrics).lines as Line[] };
}

function lyricFragment(shot: ShotWindow, lines: Line[]) {
  const picked = shot.lineIndexes.map((i) => lines.find((l) => l.i === i)).filter((l): l is Line => !!l);
  const payload = {
    window: { start: shot.start, end: shot.end },
    lines: picked.map((l) => ({
      i: l.i,
      text: l.text.replace(/`/g, ' ').replace(/<\/lyric>/g, ' '),
      start: l.start,
      end: l.end,
      words: l.words.map((w) => ({ w: w.w, start: w.start, end: w.end })),
    })),
  };
  let text = JSON.stringify(payload);
  if (text.length > 4000) {
    text = JSON.stringify({ ...payload, lines: payload.lines.map(({ i, text, start, end, words }) => ({ i, text, start, end, words })) });
  }
  return text.slice(0, 4000);
}

async function arrangeOnce(root: string, lines: Line[], audio: { duration: number; bpm?: number; downbeats: number[] }, repair: string | null) {
  const allow = SHOT_ROLES.map((role) => `${role}: ${REUSE_ALLOW[role].join(', ') || '（无）'}`).join('\n');
  const rows = lines.map((l) => `${l.i} | ${l.start} | ${l.end} | ${l.text}`).join('\n');
  const user = [
    `时长 ${audio.duration} BPM ${audio.bpm ?? '未知'} 下拍 ${audio.downbeats?.length ?? 0}`,
    `允许表:\n${allow}`,
    `write 预算还剩 ${12}`,
    `歌词:\n${rows}`,
    repair ? `上一轮失败：${repair}\n请合并到不超过 ${MAX_SHOTS} 镜，仍然只输出 JSON。` : '',
  ].join('\n\n');
  const maxTokens = repair ? 16000 : 12000;
  const { content, finishReason } = await complete(root, user, true, maxTokens, STAGE1_SYSTEM);
  if (finishReason === 'length') {
    const err = new Error('stage1_truncated');
    (err as Error & { code?: string }).code = 'stage1_truncated';
    throw err;
  }
  let parsed: ArrangeShot[];
  try {
    parsed = parseArrangeShots(extractJsonObject(content));
  } catch (err: any) {
    throw new Error(err.message || 'stage1_schema');
  }
  if (parsed.filter((s) => !s.instrumental && s.lineIndexes.length).length > MAX_SHOTS) {
    throw new Error(`镜头超过 ${MAX_SHOTS}`);
  }
  const fitted = fitWindows(parsed, lines, audio);
  seal(fitted.shots, lines, audio.duration);
  return fitted;
}

export async function runShotProgram(
  root: string,
  track: string,
  signal: AbortSignal,
  emit: (event: ShotProgramEvent) => void,
) {
  const { lines, audio } = loadTrackLyrics(root, track);
  let fitted: { shots: ShotWindow[]; warnings: string[] };
  try {
    fitted = await arrangeOnce(root, lines, audio, null);
  } catch (first: any) {
    if (signal.aborted) throw new Error('已取消');
    try {
      fitted = await arrangeOnce(root, lines, audio, String(first.message || first).slice(0, 800));
    } catch (second: any) {
      const code = second.code === 'stage1_truncated' || String(second.message).includes('stage1_truncated') ? 'stage1_truncated' : String(second.message || second);
      throw Object.assign(new Error(code), { status: 422 });
    }
  }
  emit({ event: 'stage', stage: 1 });
  emit({ event: 'arrangement', shots: fitted.shots.length, warnings: fitted.warnings });
  emit({ event: 'stage', stage: 2 });

  const pluginsDir = path.join(root, 'src/plugins');
  const taken = new Set(fs.readdirSync(pluginsDir).filter((f) => f.endsWith('.ts')).map((f) => f.replace(/\.ts$/, '')));
  let calls = 0;
  let repairs = 0;
  let skipped = 0;
  const dsl: Record<string, unknown>[] = [];

  for (let index = 0; index < fitted.shots.length; index++) {
    const shot = fitted.shots[index]!;
    const ids: Partial<Record<Role, string>> = {};
    const errors: string[] = [];
    for (const job of shot.writes) {
      if (signal.aborted) throw new Error('已取消');
      const id = tempPluginId(track, index, job.role, taken);
      const className = classNameFor(id);
      const fragment = lyricFragment(shot, lines);
      const ask = fitStage2Prompt(
        `role=${job.role}\nclassName=${className}\nid=${id}\nstyle=${shot.style}\nimagery=${shot.imageryTag}\nacoustic=${shot.acoustic}\npace=${shot.pace}\ncolorGrade=${shot.colorGrade}\nbrief=${job.brief}\n<lyric>${fragment}</lyric>\n骨架:\n${pluginSkeleton(className, job.role)}`,
        EXEMPLARS[job.role],
      );
      let status: 'ok' | 'repair' | 'skipped' = 'ok';
      let lastError = '';
      const attempt = async (extra: string) => {
        calls++;
        const { content } = await complete(root, ask + extra, true, 4000, STAGE2_SYSTEM);
        const parsed = extractJsonObject(content) as { zh?: string; code?: string };
        if (!parsed.code) throw new Error('模型没有给出 code');
        const stamped = stamp(job.role, String(parsed.zh ?? job.role), parsed.code, className);
        fs.writeFileSync(path.join(pluginsDir, `${id}.ts`), stamped.endsWith('\n') ? stamped : `${stamped}\n`, 'utf8');
        ids[job.role] = id;
      };
      try {
        await attempt('');
      } catch (err: any) {
        repairs++;
        status = 'repair';
        lastError = String(err.message || err).slice(0, 800);
        try {
          if (signal.aborted) throw new Error('已取消');
          await attempt(`\n上一轮错误：${lastError}\n只改错误，仍然只输出 JSON。`);
        } catch (again: any) {
          skipped++;
          status = 'skipped';
          lastError = String(again.message || again).slice(0, 180);
          if (fs.existsSync(path.join(pluginsDir, `${id}.ts`))) fs.rmSync(path.join(pluginsDir, `${id}.ts`));
          taken.delete(id);
          const fallback = REUSE_ALLOW[job.role][0];
          if (fallback) ids[job.role] = fallback;
          errors.push(`s${String(index).padStart(2, '0')} ${job.role}: ${lastError}`);
        }
      }
      emit({ event: 'file', id, role: job.role, status, ...(lastError && status !== 'ok' ? { error: lastError } : {}) });
    }
    const item: Record<string, unknown> = {
      id: `shot_${String(index).padStart(2, '0')}`,
      start: shot.start,
      end: shot.end,
      colorGrade: shot.colorGrade,
      params: {
        lineIndexes: shot.lineIndexes,
        instrumental: shot.instrumental || undefined,
        ownsLyrics: shot.plateSolo ? true : undefined,
      },
    };
    if (shot.plateSolo) item.plugin = shot.plateSolo;
    else {
      for (const role of SHOT_ROLES) {
        const chosen = ids[role] ?? shot[role];
        if (chosen) item[role] = chosen;
      }
      if (shot.instrumental) {
        item.background = 'terrain';
        item.params = { lineIndexes: [], instrumental: true, ownsLyrics: false };
      }
    }
    if (errors.length) item.programError = errors.join(' | ');
    dsl.push(item);
  }

  if (signal.aborted) throw new Error('已取消');
  expandTimelineSolos(root, dsl);
  const dir = trackDir(root, track);
  const target = path.join(dir, 'timeline.json');
  const prev = path.join(dir, 'timeline.prev.json');
  const tmp = path.join(dir, 'timeline.json.tmp');
  if (fs.existsSync(target)) fs.copyFileSync(target, prev);
  fs.writeFileSync(tmp, JSON.stringify(dsl, null, 2), 'utf8');
  fs.renameSync(tmp, target);
  emit({ event: 'done', calls, repairs, skipped, timeline: true });
}

const CATALOG_SHAPE = /^export const GENERATED_ASSETS[\s\S]*= \[[\s\S]*\];\s*$/;

function catalogObjects(catalog: string): Record<string, unknown>[] {
  if (!CATALOG_SHAPE.test(catalog) || catalog.includes('//')) {
    throw Object.assign(new Error('generated-catalog.ts 形状不对'), { status: 500 });
  }
  const start = catalog.indexOf('= [');
  const end = catalog.lastIndexOf('];');
  const body = catalog.slice(start + 3, end).trim();
  if (!body) return [];
  const items: Record<string, unknown>[] = [];
  let i = 0;
  while (i < body.length) {
    while (i < body.length && body[i] !== '{') i++;
    if (i >= body.length) break;
    let depth = 0;
    let inStr = false;
    let esc = false;
    let j = i;
    for (; j < body.length; j++) {
      const ch = body[j]!;
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { j++; break; }
      }
    }
    items.push(JSON.parse(body.slice(i, j)) as Record<string, unknown>);
    i = j;
  }
  return items;
}

function renderCatalog(catalog: string, entries: Record<string, unknown>[]): string {
  const start = catalog.indexOf('= [');
  const rendered = entries.map((entry) => JSON.stringify(entry, null, 2)).join(',\n');
  return `${catalog.slice(0, start)}= [\n${rendered}${rendered ? '\n' : ''}];\n`;
}

function expandTimelineSolos(root: string, dsl: Record<string, unknown>[]) {
  const pluginsDir = path.join(root, 'src/plugins');
  const roles = new Set(['background', 'imagery', 'accent', 'typography']);
  for (const item of dsl) {
    const layered = !!(item.background || item.imagery || item.accent || item.typography);
    if (layered) continue;
    const plugin = typeof item.plugin === 'string' ? item.plugin : typeof item.scene === 'string' ? item.scene : '';
    if (!plugin) continue;
    const params = (item.params && typeof item.params === 'object' ? { ...(item.params as Record<string, unknown>) } : {}) as Record<string, unknown>;
    if (params.instrumental === true) {
      params.ownsLyrics = false;
      item.params = params;
      continue;
    }
    if (plugin.startsWith('plate-')) {
      params.ownsLyrics = true;
      item.params = params;
      continue;
    }
    let owns: boolean | null = null;
    let role = typeof params.layerRole === 'string' && roles.has(params.layerRole) ? params.layerRole : 'accent';
    const file = path.join(pluginsDir, `${plugin}.ts`);
    if (fs.existsSync(file)) {
      const header = readGeneratedHeader(fs.readFileSync(file, 'utf8'));
      if (header) {
        owns = header.owns;
        if (roles.has(header.role)) role = header.role;
      }
    }
    const sung = Array.isArray(params.lineIndexes) && params.lineIndexes.length > 0;
    if (owns === false && sung) {
      delete item.plugin;
      delete item.scene;
      if (role !== 'typography') item[role] = plugin;
      item.typography = 'lyric-line';
      params.ownsLyrics = false;
      item.params = params;
    } else {
      params.ownsLyrics = true;
      item.params = params;
    }
  }
}

export function revertTimeline(root: string, track: string) {
  const dir = trackDir(root, track);
  const prev = path.join(dir, 'timeline.prev.json');
  if (!fs.existsSync(prev)) throw Object.assign(new Error('没有上一版编排'), { status: 404 });
  fs.copyFileSync(prev, path.join(dir, 'timeline.json'));
}

export async function writeShotLayer(root: string, body: {
  track?: string;
  shotIndex?: number;
  role?: string;
  brief?: string;
  start?: number;
  end?: number;
  colorGrade?: string;
}) {
  const track = String(body.track || 'demo').trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(track)) throw Object.assign(new Error('曲目名不合法'), { status: 400 });
  const role = String(body.role || 'imagery') as Role;
  if (!ROLES.has(role)) throw Object.assign(new Error('图层角色不合法'), { status: 400 });
  const brief = String(body.brief || '').trim().slice(0, 200);
  if (brief.length < 2) throw Object.assign(new Error('先输入图层画面描述'), { status: 400 });

  const shotIndex = Math.max(0, Math.min(99, Number(body.shotIndex) || 0));
  const start = Number(body.start) || 0;
  const end = Math.max(start + 0.5, Number(body.end) || start + 4);
  const colorGrade = GRADES.includes(String(body.colorGrade)) ? String(body.colorGrade) : 'cold-industrial';

  const { lyrics, lines } = loadTrackLyrics(root, track);
  const inWin = lyrics.linesIn(start, end);
  const mockWindow: ShotWindow = {
    start,
    end,
    fallback: false,
    instrumental: inWin.length === 0,
    lineIndexes: inWin.map((l) => l.i),
    plateSolo: null,
    background: null,
    imagery: null,
    accent: null,
    typography: null,
    writes: [{ role, brief }],
    style: 'style_cyber_brutalism',
    imageryTag: 'img_singularity',
    acoustic: 'ac_kick_impact',
    pace: 'medium',
    colorGrade,
    warnings: [],
  };

  const slug = track.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20) || 'track';
  const id = `tmp-${slug}-s${String(shotIndex).padStart(2, '0')}-${role}`;
  assertId(id);
  const className = classNameFor(id);
  const fragment = lyricFragment(mockWindow, lines);
  const ask = fitStage2Prompt(
    `role=${role}\nclassName=${className}\nid=${id}\nstyle=${mockWindow.style}\nimagery=${mockWindow.imageryTag}\nacoustic=${mockWindow.acoustic}\npace=${mockWindow.pace}\ncolorGrade=${colorGrade}\nbrief=${brief}\n<lyric>${fragment}</lyric>\n骨架:\n${pluginSkeleton(className, role)}`,
    EXEMPLARS[role],
  );

  const pluginsDir = path.join(root, 'src/plugins');
  let zhOut = brief.slice(0, 12);
  const attempt = async (extra: string) => {
    const { content } = await complete(root, ask + extra, true, 4000, STAGE2_SYSTEM);
    const parsed = extractJsonObject(content) as { zh?: string; code?: string };
    if (!parsed.code) throw new Error('模型没有给出 code');
    zhOut = String(parsed.zh ?? role).slice(0, 24);
    const stamped = stamp(role, zhOut, parsed.code, className);
    fs.writeFileSync(path.join(pluginsDir, `${id}.ts`), stamped.endsWith('\n') ? stamped : `${stamped}\n`, 'utf8');
  };

  try {
    await attempt('');
  } catch (firstErr: any) {
    const reason = String(firstErr.message || firstErr).slice(0, 600);
    await attempt(`\n上一轮错误：${reason}\n只改错误，仍然只输出 JSON。`);
  }

  return { id, role, zh: zhOut };
}

export function promotePlugin(root: string, body: { from?: string; to?: string; zh?: string; promoteOverwrite?: boolean }) {
  const from = String(body.from ?? '');
  const to = String(body.to ?? '');
  assertId(from);
  assertId(to);
  if (to.startsWith('tmp-') || to.startsWith('plate-')) throw Object.assign(new Error('目标 id 不能是临时文件或原片'), { status: 409 });
  const pluginsDir = path.join(root, 'src/plugins');
  const fromPath = path.join(pluginsDir, `${from}.ts`);
  const toPath = path.join(pluginsDir, `${to}.ts`);
  if (!fs.existsSync(fromPath)) throw new Error('找不到临时插件');
  if (fs.existsSync(toPath)) {
    const head = fs.readFileSync(toPath, 'utf8').slice(0, 160);
    const generated = head.includes('@pdoom-generated') || head.includes('@pdoom-asset');
    if ((!generated || to.startsWith('plate-')) && body.promoteOverwrite !== true) {
      throw Object.assign(new Error('目标是手写插件或原片'), { status: 409 });
    }
  }
  const source = fs.readFileSync(fromPath, 'utf8').replace(
    /^\/\/ @pdoom-generated role=([a-z]+) zh=(.*?)\s+owns=([01]).*$/m,
    '// @pdoom-asset role=$1 zh=$2 owns=$3',
  );
  if (!source.startsWith('// @pdoom-asset ')) throw new Error('临时头没有改成固定资产头');
  const catalogPath = path.join(root, 'src/engine/generated-catalog.ts');
  const catalog = fs.readFileSync(catalogPath, 'utf8');
  const header = readGeneratedHeader(source) ?? readGeneratedHeader(fs.readFileSync(fromPath, 'utf8'));
  const role = header?.role || 'imagery';
  const entry = {
    id: to,
    name: classNameFor(to),
    zhName: String(body.zh || header?.zh || to).slice(0, 40),
    sourceScene: `${to}.ts`,
    layerRole: role,
    styles: [] as string[],
    imageries: [] as string[],
    acousticFocus: ['kick'],
    recommendedPaces: ['medium'],
    description: '晋升后的模型插件。',
    promptGuidance: '',
    ownsLyrics: role === 'typography',
    origin: 'generated',
    kind: 'layer',
  };
  const entries = catalogObjects(catalog).filter((item) => item.id !== to);
  entries.push(entry);
  const next = renderCatalog(catalog, entries);
  const nextPath = `${catalogPath}.next`;
  fs.writeFileSync(toPath, source.endsWith('\n') ? source : `${source}\n`, 'utf8');
  fs.writeFileSync(nextPath, next, 'utf8');
  try {
    execFileSync('bun', ['run', 'typecheck'], { cwd: root, stdio: 'pipe' });
  } catch (err: any) {
    fs.rmSync(toPath, { force: true });
    fs.rmSync(nextPath, { force: true });
    throw new Error(`类型检查没有通过: ${String(err.stderr || err.message || err).slice(0, 400)}`);
  }
  fs.renameSync(nextPath, catalogPath);
  const timelinePath = path.join(root, 'public/tracks');
  if (fs.existsSync(timelinePath)) {
    for (const name of fs.readdirSync(timelinePath)) {
      if (name === 'default') continue;
      const file = path.join(timelinePath, name, 'timeline.json');
      if (!fs.existsSync(file)) continue;
      const timeline = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!Array.isArray(timeline)) continue;
      const rewritten = JSON.stringify(timeline, null, 2).split(`"${from}"`).join(`"${to}"`);
      fs.writeFileSync(file, rewritten, 'utf8');
    }
  }
  fs.rmSync(fromPath, { force: true });
  return { from, to };
}

export function discardUnreferencedTemps(root: string) {
  const pluginsDir = path.join(root, 'src/plugins');
  const used = new Set<string>();
  const tracks = path.join(root, 'public/tracks');
  if (fs.existsSync(tracks)) {
    for (const name of fs.readdirSync(tracks)) {
      if (name === 'default') continue;
      const file = path.join(tracks, name, 'timeline.json');
      if (!fs.existsSync(file)) continue;
      used.add(fs.readFileSync(file, 'utf8'));
    }
  }
  const blob = [...used].join('\n');
  const removed: string[] = [];
  for (const file of fs.readdirSync(pluginsDir)) {
    if (!file.startsWith('tmp-') || !file.endsWith('.ts')) continue;
    const id = file.replace(/\.ts$/, '');
    const full = path.join(pluginsDir, file);
    const head = fs.readFileSync(full, 'utf8').split('\n', 1)[0] ?? '';
    if (!head.includes('status=temporary')) continue;
    if (blob.includes(`"${id}"`)) continue;
    fs.rmSync(full);
    removed.push(id);
  }
  return removed;
}
