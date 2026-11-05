// 歌词感知插件公共基类 (Lyric-Aware Plugin Base Class)
// 依据 CODEBASE_ENGINEERING_AUDIT_AND_OPTIMIZATION_SPEC 规范设计与解耦

import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides, type SceneCtx } from '../engine/scene';
import { Layer2D, W, H } from '../engine/gl';
import type { Line } from '../engine/lyrics';
import { BespokeSceneHelper, type GenericSceneParams } from './bespoke-helper';

export interface EmbeddedLyricRenderOptions {
  cx?: number;
  cy?: number;
  baseSize?: number;
  color?: string;
  activeColor?: string;
  glowColor?: string;
  showTelemetry?: boolean;
  telemetryTag?: string;
  blendMode?: 'normal' | 'add' | 'screen' | 'multiply';
}

export abstract class LyricAwarePlugin extends Scene {
  /** 专用于 2D 文字排版与卡拉OK高亮的 Canvas 图层 (自动纳入生命周期释放) */
  protected layer = this.disposables.track(new Layer2D());
  /** 关联的歌词行 */
  protected lines: Line[] = [];
  constructor(ctx: SceneCtx) {
    super(ctx);
  }

  override async init(): Promise<void> {
    this.lines = BespokeSceneHelper.resolveLines(this.ctx, this.ctx.params as GenericSceneParams);
  }

  /**
   * Draw the line that owns this shot. Visibility is a function of `f.t` only.
   * The engine clears the render target before each call, so an instrumental gap
   * is just "do not draw" — no memory of the previous frame.
   */
  protected renderLyrics(
    f: Frame,
    out: THREE.WebGLRenderTarget,
    opts: EmbeddedLyricRenderOptions = {}
  ): void {
    if (f.suppressLyrics || this.lines.length === 0) return;

    const lyric = BespokeSceneHelper.getRenderableLyric(this.lines, f.t);
    const isVisible = !lyric.isInstrumental && lyric.opacity > 0.005 && lyric.text.trim().length > 0;
    if (!isVisible) return;

    this.layer.clear();
    BespokeSceneHelper.renderEmbeddedLyric(this.layer.ctx, lyric, f, {
      cx: opts.cx ?? W / 2,
      cy: opts.cy ?? H / 2 - 40,
      baseSize: opts.baseSize ?? (this.ctx.params?.fontSize ?? 54),
      color: opts.color ?? 'rgba(255, 255, 255, ',
      activeColor: opts.activeColor ?? 'rgba(255, 210, 60, ',
      glowColor: opts.glowColor ?? 'rgba(255, 100, 20, ',
      showTelemetry: opts.showTelemetry ?? false,
      telemetryTag: opts.telemetryTag ?? this.ctx.id,
    });
    this.ctx.comp.draw(this.ctx.renderer, this.layer.upload(true), out, {
      mode: opts.blendMode ?? 'normal',
    });
  }
}
