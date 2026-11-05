// Scene API. A scene owns a time window of the song and renders HDR linear colour
// into the render target it is given. Everything must be a deterministic function of
// time (plus internal state advanced only through render() calls, see `stateful`).
import type * as THREE from 'three';
import type { AudioData, AudioSample } from './audio';
import type { Lyrics } from './lyrics';
import type { Compositor } from './gl';
import type { PostParams } from './post';
import { DisposableCollector, type Disposable } from './disposable';

export type PluginParams = Record<string, any>;

export interface SceneCtx {
  renderer: THREE.WebGLRenderer;
  audio: AudioData;
  lyrics: Lyrics;
  comp: Compositor;
  W: number;
  H: number;
  /** Timeline entry id and its free-form params (lets one scene module serve several entries). */
  id: string;
  params: PluginParams;
  /** Entry window (song seconds). */
  start: number;
  end: number;
}

export interface Frame {
  /** Song time (s). */
  t: number;
  /** Time since the previous rendered frame (1/fps on export; 0 after a seek). */
  dt: number;
  /** Local time since this scene's start, and 0..1 progress through its window. */
  lt: number;
  p: number;
  start: number;
  end: number;
  /** True when time jumped (scrub/seek) — stateful scenes should reset. */
  seeked: boolean;
  /** True while the engine fast-forwards a stateful scene after a seek (skip non-essential work). */
  preroll: boolean;
  /** Continuous beat/bar indices from the analysed grid, and their fractional phases. */
  beat: number;
  bar: number;
  beatPhase: number;
  barPhase: number;
  /** Audio features at t (envelopes 0..1 and decaying hit pulses). */
  a: AudioSample;
  /**
   * When this scene overlaps the previous one (a transition), the previous scene's
   * output texture for this frame; otherwise null. Scenes that set
   * `handlesTransition = true` composite it themselves.
   */
  under: THREE.Texture | null;
  /** 0..1 progress through the overlap with the previous scene (1 when not overlapping). */
  tin: number;
  /** 0..1 progress through the overlap with the next scene (0 when not overlapping). */
  tout: number;
  /** Downbeat transient impulse (0..1, peaks at bar start). Guaranteed provided by engine. */
  downbeat: number;
  /** Direct audio impulse spikes (0..1). Guaranteed provided by engine. */
  kickImpulse: number;
  snareImpulse: number;
  hatImpulse: number;
  /** Normalized integrated RMS & spectral energy (0..1). Guaranteed provided by engine. */
  energy: number;
  /** Current layer index in layered composition (0: bg, 1: imagery, 2: accent, 3: typography). Guaranteed provided by engine. */
  layerIndex: number;
  /** Stacked shots draw lyrics in one layer only. A lone plugin leaves this false. */
  suppressLyrics: boolean;
}

export type PostOverrides = Partial<PostParams>;

export abstract class Scene implements Disposable {
  /** If true, the engine fast-forwards (calls render with preroll=true) after seeks. */
  stateful = false;
  /** Max seconds of history the engine re-simulates when seeking into a stateful scene. */
  prerollMax = 6;
  /** If true, this scene composites `f.under` itself during its incoming transition. */
  handlesTransition = false;

  /** Managed disposable collector for child resources */
  protected disposables = new DisposableCollector();

  constructor(protected ctx: SceneCtx) {}

  /** Load/create resources. Called once before first render. */
  init(): Promise<void> | void {}

  /** Reset internal state (called on seeks for stateful scenes). */
  reset(): void {}

  /** Render into `out` (HalfFloat, linear HDR). Must fully overwrite/clear it. Return post-processing overrides. */
  abstract render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void;

  /**
   * Automatically dispose all tracked disposables and inspect object properties
   * for any disposable resources (FSPass, Layer2D, LineBatch, Material, Geometry, etc.)
   */
  dispose(): void {
    const keys = Object.getOwnPropertyNames(this) as (keyof this)[];
    for (const key of keys) {
      if (key === 'ctx' || key === 'disposables') continue;
      const prop = this[key] as any;
      if (!prop || typeof prop !== 'object' || typeof prop.dispose !== 'function') continue;
      if (this.disposables.owns(prop)) continue;
      try {
        prop.dispose();
      } catch (e) {
        console.warn(`[Scene ${this.ctx.id}] Auto-dispose failed for property ${String(key)}:`, e);
      }
    }
    this.disposables.disposeAll();
  }
}

export type SceneClass = new (ctx: SceneCtx) => Scene;
