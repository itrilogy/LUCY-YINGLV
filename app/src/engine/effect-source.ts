// Turn a model reply into a plugin module the dev server can write.
// The key never lives in this file.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const EFFECT_SYSTEM_PROMPT = `你是 pdoom-video 的视效程序员。只输出能被 TypeScript 编译的插件源码，或按要求输出 JSON。
必须使用给出的骨架：import { Scene, type Frame, type PostOverrides, type SceneCtx } from '../engine/scene'，import { FSPass, clearRT } from '../engine/gl'，import * as THREE from 'three'。字效层骨架不用 FSPass，改为 clearRT 透明并调用 paintShotLine。
只用 FSPass、Layer2D、LineBatch、paintShotLine。禁止 WebGLProgram、getContext、shaderSource、../engine/types、../scenes/、../plugins/。
着色器里不要写 #version。引擎已经提供 vUv 和 fragColor。
禁止 Math.random、Date.now、performance.now。
构造函数只接收 ctx: SceneCtx，第一行 super(ctx)。
背景层 clearRT(..., 1)，fragColor alpha 为 1。意象和点缀没画到的地方 rgb 为 0 且 alpha 为 0，禁止 vec4 的 alpha 字面量 1。
字效层 clearRT(..., 0)，只调用 paintShotLine。禁止 fillText、strokeText、f.p。
可用字段：f.t f.beat f.barPhase f.downbeat f.energy f.a.kick f.a.snare f.a.hat f.a.bass f.layerIndex f.suppressLyrics。
fragColor.rgb 不超过 1.2。
不要解释。除非用户要 JSON，否则不要 Markdown。`;

const ALLOWED_IMPORT = [
  /^\s*import\s+.+\s+from\s+['"]three['"]/,
  /^\s*import\s+.+\s+from\s+['"]\.\.\/engine\/scene['"]/,
  /^\s*import\s+.+\s+from\s+['"]\.\.\/engine\/gl['"]/,
  /^\s*import\s+.+\s+from\s+['"]\.\.\/engine\/lines['"]/,
  /^\s*import\s+.+\s+from\s+['"]\.\.\/engine\/util['"]/,
  /^\s*import\s+.+\s+from\s+['"]\.\.\/engine\/palette['"]/,
  /^\s*import\s+.+\s+from\s+['"]\.\.\/engine\/shot-glyph['"]/,
  /^\s*import\s+.+\s+from\s+['"]\.\.\/engine\/lyrics['"]/,
];

const GLYPH_API = /fillText|strokeText|renderEmbeddedLyric|renderLyrics|paintShotLine|drawStrokeText|writtenLength|getRenderableLyric/;

export function pluginSkeleton(className: string, role: string): string {
  if (role === 'typography') {
    return `import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides, type SceneCtx } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { paintShotLine } from '../engine/shot-glyph';
import type { Line } from '../engine/lyrics';

export default class ${className} extends Scene {
  private layer = new Layer2D();
  constructor(ctx: SceneCtx) {
    super(ctx);
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    clearRT(this.ctx.renderer, out, [0, 0, 0], 0);
    const wanted = this.ctx.params.lineIndexes as number[] | undefined;
    const lines = this.ctx.lyrics.lines.filter((l: Line) => !wanted || wanted.includes(l.i));
    paintShotLine(
      { layer: this.layer, comp: this.ctx.comp, renderer: this.ctx.renderer, W: this.ctx.W, H: this.ctx.H },
      lines,
      f,
      out,
    );
  }
}`;
  }
  const body = role === 'background'
    ? `vec2 p = vUv - 0.5;
        float horizon = smoothstep(0.02, 0.0, abs(p.y + 0.18 + uKick * 0.02));
        vec3 col = vec3(0.02, 0.04, 0.07) + vec3(0.15, 0.35, 0.55) * horizon;
        col = min(col, vec3(1.2));
        fragColor = vec4(col, 1.0);`
    : role === 'accent'
      ? `vec2 p = vUv - 0.5;
        p.x *= 1.7778;
        float r = length(p);
        float ring = smoothstep(0.008, 0.0, abs(r - 0.28));
        vec3 col = vec3(0.35, 0.75, 1.0) * ring;
        col = min(col, vec3(1.2));
        float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
        float a = smoothstep(0.025, 0.20, L);
        fragColor = vec4(col, a);`
      : `vec2 p = vUv - 0.5;
        float d = smoothstep(0.04, 0.0, length(p - vec2(0.0, 0.1 * sin(uTime))));
        vec3 col = vec3(0.4, 0.7, 0.9) * d;
        col = min(col, vec3(1.2));
        float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
        float a = smoothstep(0.025, 0.20, L);
        fragColor = vec4(col, a);`;
  const clearA = role === 'background' ? '1' : '0';
  return `import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides, type SceneCtx } from '../engine/scene';
import { FSPass, clearRT } from '../engine/gl';

export default class ${className} extends Scene {
  private pass: FSPass;
  constructor(ctx: SceneCtx) {
    super(ctx);
    this.pass = new FSPass(\`
      uniform float uTime;
      uniform float uDownbeat;
      uniform float uKick;
      void main() {
        ${body}
      }
    \`, { uTime: { value: 0 }, uDownbeat: { value: 0 }, uKick: { value: 0 } });
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    clearRT(this.ctx.renderer, out, [0, 0, 0], ${clearA});
    this.pass.u.uTime!.value = f.t;
    this.pass.u.uDownbeat!.value = f.downbeat;
    this.pass.u.uKick!.value = f.a.kick;
    this.pass.render(this.ctx.renderer, out);
  }
}`;
}

export function assertUsablePlugin(code: string, role = 'imagery') {
  if (code.includes('getContext(') || code.includes('WebGLProgram') || code.includes('../engine/types')) {
    throw new Error('生成结果绕开了引擎的全屏着色器');
  }
  if (role === 'background') {
    if (!code.includes('FSPass') || !code.includes('clearRT')) throw new Error('背景层必须使用 FSPass 和 clearRT');
    if (!/clearRT\([\s\S]*?,\s*1\s*\)/.test(code)) throw new Error('背景层必须不透明清屏');
    return;
  }
  if (role === 'imagery' || role === 'accent') {
    if (!code.includes('FSPass') && !code.includes('LineBatch')) throw new Error('意象或点缀必须使用 FSPass 或 LineBatch');
    if (!code.includes('clearRT')) throw new Error('意象或点缀必须 clearRT');
    if (/vec4\([^)]*,\s*1(?:\.0+)?\s*\)/.test(code)) throw new Error('意象或点缀禁止不透明 alpha');
    return;
  }
  if (role === 'typography') {
    if (!code.includes('paintShotLine')) throw new Error('字效层必须调用 paintShotLine');
    if (!/clearRT\([\s\S]*?,\s*0\s*\)/.test(code)) throw new Error('字效层必须透明清屏');
    if (/\bfillText\b|\bstrokeText\b|\bf\.p\b/.test(code)) throw new Error('字效层禁止 fillText、strokeText 和 f.p');
    return;
  }
  throw new Error(`未知图层角色: ${role}`);
}

export function assertParadigm(code: string, role: string, className?: string) {
  if (className && !new RegExp(`export\\s+default\\s+class\\s+${className}\\b`).test(code)) {
    throw new Error(`类名必须是 ${className}`);
  }
  if (/\bMath\.random\s*\(|\bperformance\.now\s*\(|\bDate\.now\s*\(/.test(code)) {
    throw new Error('生成结果含有随机数或墙钟');
  }
  if (code.includes('../scenes/') || code.includes('../plugins/') || code.includes('shaderSource') || /\beval\s*\(/.test(code) || /\bfetch\s*\(/.test(code)) {
    throw new Error('生成结果使用了禁止的 API');
  }
  if (/stateful\s*=\s*true/.test(code)) throw new Error('生成结果不能是 stateful');
  for (const line of code.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('import ')) continue;
    if (!ALLOWED_IMPORT.some((re) => re.test(trimmed))) throw new Error(`import 不在白名单: ${trimmed}`);
  }
  if (role === 'typography') {
    if (/\bfillText\b|\bstrokeText\b|\brenderEmbeddedLyric\b|\bf\.p\b/.test(code)) {
      throw new Error('字效层只能通过 paintShotLine 画字');
    }
  } else if (GLYPH_API.test(code)) {
    throw new Error('非字效层不能画字');
  }
}

export function assertSyntax(code: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdoom-syntax-'));
  const src = path.join(dir, 'plugin.ts');
  const out = path.join(dir, 'plugin.js');
  fs.writeFileSync(src, code, 'utf8');
  try {
    execFileSync('bun', ['build', src, '--no-bundle', `--outfile=${out}`], { cwd: path.resolve(import.meta.dirname, '../..'), stdio: 'pipe' });
  } catch {
    throw new Error('生成结果语法没有通过 bun build');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function stamp(role: string, zh: string, code: string, className?: string) {
  const body = extractPluginSource(code);
  assertUsablePlugin(body, role);
  assertParadigm(body, role, className);
  assertSyntax(body);
  const withoutOld = body.replace(/^\/\/ @(?:pdoom-generated|pdoom-asset).*\n/, '');
  return generatedHeader(role, zh || role) + withoutOld;
}

export function extractPluginSource(raw: string): string {
  const fenced = raw.match(/```(?:typescript|ts)?\s*([\s\S]*?)```/);
  const code = (fenced?.[1] ?? raw).trim();
  if (!/export\s+default\s+class\s+[A-Za-z0-9_]+/.test(code)) {
    throw new Error('模型没有给出 export default class');
  }
  if (/\bMath\.random\s*\(/.test(code) || /\bperformance\.now\s*\(/.test(code) || /\bDate\.now\s*\(/.test(code)) {
    throw new Error('生成结果含有随机数或墙钟，已拒绝写入');
  }
  if (code.includes('../scenes/')) {
    throw new Error('生成结果引用了 scenes/，已拒绝写入');
  }
  return code;
}

export function extractJsonObject(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = (fenced?.[1] ?? raw).trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text);
}

export function generatedHeader(role: string, zh: string, status: 'temporary' | 'asset' = 'temporary'): string {
  const safeRole = role.replace(/[^a-z]/g, '') || 'imagery';
  const safeZh = zh.replace(/[\r\n]+/g, ' ').slice(0, 40);
  const owns = safeRole === 'typography' ? 1 : 0;
  return `// @pdoom-generated role=${safeRole} zh=${safeZh} owns=${owns} status=${status}\n`;
}

export function readGeneratedHeader(source: string): { role: string; zh: string; owns: boolean | null; status: 'temporary' | 'asset' | null; kind: 'generated' | 'asset' } | null {
  const line = source.split('\n', 1)[0] ?? '';
  const m = line.match(/^\/\/ @(pdoom-generated|pdoom-asset) role=([a-z]+) zh=(.*)$/);
  if (!m) return null;
  let zh = m[3]!.trim();
  let owns: boolean | null = null;
  let status: 'temporary' | 'asset' | null = m[1] === 'pdoom-asset' ? 'asset' : null;
  const ownsMatch = zh.match(/\sowns=([01])\b/);
  if (ownsMatch) {
    owns = ownsMatch[1] === '1';
    zh = zh.slice(0, ownsMatch.index).trim();
  }
  const statusMatch = zh.match(/\sstatus=(temporary|asset)\b/) ?? (m[3] ?? '').match(/\sstatus=(temporary|asset)\b/);
  if (statusMatch) {
    status = statusMatch[1] as 'temporary' | 'asset';
    zh = zh.replace(/\sstatus=(temporary|asset)\b/, '').trim();
  }
  return { role: m[2]!, zh, owns, status, kind: m[1] === 'pdoom-asset' ? 'asset' : 'generated' };
}
