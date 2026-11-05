// Timeline DSL 动态加载器与插件装配中枢
// 负责解析外置 timeline.json 并按需挂载 scenes/ 或 plugins/ 模块
import type { TimelineEntry } from './engine';
import type { SceneClass } from './scene';
import type { Lyrics } from './lyrics';
import type { AudioData } from './audio';
import { residentLines } from './plate-window';

// 同时扫描原生定制 scenes 与通用参数化 plugins（排除非 Scene 工具与抽象基类，消除动态/静态混合导入告警）
const sceneModules = import.meta.glob<{ default: SceneClass }>('../scenes/*.ts');
const pluginModules = import.meta.glob<{ default: SceneClass }>([
  '../plugins/*.ts',
  '!../plugins/bespoke-helper.ts',
  '!../plugins/lyric-aware-plugin.ts',
]);
const pluginSources = import.meta.glob<string>(
  ['../plugins/*.ts', '!../plugins/bespoke-helper.ts', '!../plugins/lyric-aware-plugin.ts'],
  { query: '?raw', import: 'default', eager: true },
);

type SoloRole = 'background' | 'imagery' | 'accent' | 'typography';

function headerOwns(id: string): { owns: boolean | null; role: SoloRole | null } {
  const src = pluginSources[`../plugins/${id}.ts`];
  if (typeof src !== 'string') return { owns: null, role: null };
  const line = src.split('\n', 1)[0] ?? '';
  const role = line.match(/\brole=([a-z]+)/)?.[1];
  const owns = line.match(/\bowns=([01])\b/)?.[1];
  const known: SoloRole[] = ['background', 'imagery', 'accent', 'typography'];
  return {
    owns: owns == null ? null : owns === '1',
    role: known.includes(role as SoloRole) ? role as SoloRole : null,
  };
}

export interface LayerConfig {
  /** Background layer plugin (e.g. terrain, room-terminal, tunnel, glitch). */
  background?: string;
  /** Imagery motif entity layer plugin (e.g. hardware-stack, gantt-maneuver, spacetime-lens, cyber-shoggoth). */
  imagery?: string;
  /** Accent line geometry layer plugin (e.g. acoustic-loss, fuse-spark, glitch). */
  accent?: string;
  /** Typography text layer plugin (e.g. kinetic-press, cyber-prompt, typography, kinetic-hook). */
  typography?: string;
  /** Emotional color grade profile ('cold-industrial' | 'warning-crimson' | 'cyber-green' | 'void-monochrome' | 'noir-gold'). */
  colorGrade?: string;
}

export interface TimelineDSLItem extends LayerConfig {
  id: string;
  scene?: string;
  plugin?: string;
  start?: number;
  end?: number;
  startBar?: number;
  endBar?: number;
  startQuery?: string;
  endQuery?: string;
  caption?: { fig: string; text: string; dur?: number; delay?: number };
  post?: Record<string, any>;
  params?: Record<string, any>;
  maxSamples?: number;
  blend?: { mode?: 'normal' | 'add' | 'screen' | 'multiply' | 'max' | 'replace'; opacity?: number };
  layerIndex?: number;
}

export function resolveModuleLoader(name: string): () => Promise<{ default: SceneClass }> {
  // 1. 尝试在 plugins 中查找
  const pluginKey = `../plugins/${name}.ts`;
  if (pluginModules[pluginKey]) {
    return pluginModules[pluginKey]!;
  }
  // 2. 尝试在 scenes 中查找
  const sceneKey = `../scenes/${name}.ts`;
  if (sceneModules[sceneKey]) {
    return sceneModules[sceneKey]!;
  }
  return () => Promise.reject(new Error(`Visual module not found in plugins/ or scenes/: ${name}`));
}

import { errorCollector } from './error-collector';
import { enforceAdjacency, nearestGrid, type ShotSpan } from './shot-assembly';

interface ResolvedShot extends ShotSpan {
  item: TimelineDSLItem;
  idx: number;
}

function resolveOne(item: TimelineDSLItem, idx: number, lyrics: Lyrics, audio: AudioData): ResolvedShot | null {
  const beat = audio.bpm > 1 ? 60 / audio.bpm : 0.5;
  let start: number | null = null;
  let end: number | null = null;
  let fallback = false;

  if (typeof item.start === 'number') start = item.start;
  else if (typeof item.startBar === 'number') start = audio.downbeats[item.startBar] ?? audio.timeOfBeat(item.startBar * 4);
  else if (item.startQuery) {
    try {
      const line = lyrics.get(item.startQuery);
      const word = line.words[0]?.start ?? line.start;
      start = audio.timeOfBeat(Math.floor(audio.beatAt(word + 0.02)));
    } catch (err: any) {
      errorCollector.report({
        source: 'timeline',
        severity: 'warning',
        context: `item_${item.id ?? idx}`,
        message: `startQuery "${item.startQuery}" failed: ${err.message}`,
      });
    }
  }

  if (typeof item.end === 'number') end = item.end;
  else if (typeof item.endBar === 'number') end = audio.downbeats[item.endBar] ?? audio.timeOfBeat(item.endBar * 4);
  else if (item.endQuery) {
    try {
      const line = lyrics.get(item.endQuery);
      // Same grid as the start cut: nearest beat to the line end, not the raw phoneme time.
      const grid = audio.beats?.length ? audio.beats : audio.downbeats;
      end = nearestGrid(line.end, grid);
    } catch (err: any) {
      errorCollector.report({
        source: 'timeline',
        severity: 'warning',
        context: `item_${item.id ?? idx}`,
        message: `endQuery "${item.endQuery}" failed: ${err.message}`,
      });
    }
  }

  if (start == null && end == null) {
    errorCollector.report({
      source: 'timeline',
      severity: 'warning',
      context: `item_${item.id ?? idx}`,
      message: `shot "${item.id ?? idx}" has no resolvable window and was skipped`,
    });
    return null;
  }
  if (start == null) {
    start = Math.max(0, (end ?? 0) - 4);
    fallback = true;
  }
  if (end == null) {
    end = Math.min(audio.duration || start + 4, start + 4);
    fallback = true;
  }
  if (end <= start) end = Math.min(audio.duration || start + 1, start + Math.max(beat, 1 / 60));
  return { item, idx, start, end, fallback };
}

export function parseTimelineDSL(dsl: TimelineDSLItem[], lyrics: Lyrics, audio: AudioData): TimelineEntry[] {
  const result: TimelineEntry[] = [];
  const beat = audio.bpm > 1 ? 60 / audio.bpm : 0.5;
  const resolved = enforceAdjacency(
    dsl.map((item, idx) => resolveOne(item, idx, lyrics, audio)).filter((s): s is ResolvedShot => !!s),
    audio.duration,
    beat,
  );

  resolved.forEach((shot) => {
    const item = shot.item;
    const idx = shot.idx;
    const start = shot.start;
    const end = shot.end;

    // 检测是否为多层镜头组合模式
    const hasLayers = !!(item.background || item.imagery || item.accent || item.typography);

    if (hasLayers) {
      // One lyric owner per shot. Accent never owns lyrics: screen-blended type ghosts the line below.
      const instrumental = item.params?.instrumental === true;
      const lyricRole = item.typography ? 'typography'
        : item.imagery ? 'imagery'
        : item.background ? 'background'
        : 'accent';
      const layer = (
        role: 'background' | 'imagery' | 'accent' | 'typography',
        name: string,
        layerIndex: number,
        blend: TimelineEntry['blend'],
        withCaption = false,
      ) => {
        const tag = role === 'background' ? 'bg' : role === 'imagery' ? 'img' : role === 'accent' ? 'acc' : 'typo';
        result.push({
          id: `${item.id || `scene_${idx}`}_${tag}_${name}`,
          module: name,
          load: resolveModuleLoader(name),
          start,
          end,
          caption: withCaption ? item.caption : undefined,
          post: role === 'background' ? item.post : undefined,
          params: { ...(item.params ?? {}), suppressLyrics: instrumental || role !== lyricRole },
          maxSamples: item.maxSamples,
          blend,
          layerIndex,
          colorGrade: item.colorGrade,
          suppressLyrics: instrumental || role !== lyricRole,
        });
      };

      if (item.background) layer('background', item.background, 0, { mode: 'replace', opacity: 1 });
      if (item.imagery) layer('imagery', item.imagery, 1, { mode: 'normal', opacity: 1 });
      if (item.accent) layer('accent', item.accent, 2, { mode: 'screen', opacity: 1 });
      if (item.typography) layer('typography', item.typography, 3, { mode: 'normal', opacity: 1 }, true);
    } else {
      const targetModule = item.plugin ?? item.scene ?? 'typography';
      const ownsField = item.params?.ownsLyrics;
      const header = headerOwns(targetModule);
      const owns = ownsField === true ? true : ownsField === false ? false : header.owns;
      const sung = owns === false && !targetModule.startsWith('plate-') && residentLines(lyrics, start, end).length > 0;
      if (sung) {
        const role = (item.params?.layerRole as SoloRole | undefined) ?? header.role ?? 'accent';
        const stack = { ...item, plugin: undefined, scene: undefined } as TimelineDSLItem;
        if (role !== 'typography') stack[role] = targetModule;
        stack.typography = 'lyric-line';
        stack.params = { ...(item.params ?? {}), ownsLyrics: false };
        const wrapped = parseTimelineDSL([stack], lyrics, audio);
        result.push(...wrapped.map((entry) => ({ ...entry, start, end })));
      } else {
        const load = resolveModuleLoader(targetModule);
        const instrumental = item.params?.instrumental === true;
        result.push({
          id: item.id || `entry_${idx}_${targetModule}`,
          module: targetModule,
          load,
          start,
          end,
          caption: item.caption,
          post: item.post,
          params: item.params,
          maxSamples: item.maxSamples,
          blend: item.blend,
          layerIndex: item.layerIndex ?? 0,
          colorGrade: item.colorGrade,
          suppressLyrics: instrumental ? true : undefined,
        });
      }
    }
  });

  return result;
}
