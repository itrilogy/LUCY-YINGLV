// DynamicTypographyPlugin: one transparent lyric line, timed by word ends.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides, type SceneCtx } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { paintShotLine } from '../engine/shot-glyph';
import { BespokeSceneHelper } from './bespoke-helper';

export default class DynamicTypographyPlugin extends Scene {
  private layer = new Layer2D();

  constructor(ctx: SceneCtx) {
    super(ctx);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    clearRT(this.ctx.renderer, out, [0, 0, 0], 0);
    if (f.suppressLyrics) return;
    const lines = BespokeSceneHelper.resolveLines(this.ctx, this.ctx.params || {});
    paintShotLine(
      { layer: this.layer, comp: this.ctx.comp, renderer: this.ctx.renderer, W: this.ctx.W, H: this.ctx.H },
      lines,
      f,
      out,
    );
  }
}
