import { Scene, Frame, type SceneCtx } from '../engine/scene';
import { BespokeSceneHelper, type GenericSceneParams } from './bespoke-helper';
import { W, H, Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { clamp, lerp } from '../engine/util';
import type { Line } from '../engine/lyrics';
import * as THREE from 'three';

/**
 * 多维矩阵交织线条通用插件 (Matrix Loom Weaver Plugin)
 * 提取自原版 loom.ts，构建声学自适应的高维张量分支网络与空间悬浮歌词投影。
 */
export default class MatrixLoomPlugin extends Scene {
  private params: GenericSceneParams;
  private lines = new LineBatch(64000, { blend: 'add' });
  private hud = new Layer2D();
  private sceneLines: Line[] = [];
  private theme: [number, number, number] = [0.15, 0.85, 0.95]; // 矩阵青蓝光

  constructor(ctx: SceneCtx, params: GenericSceneParams = {}) {
    super(ctx);
    this.params = { ...params, ...(ctx.params ?? {}) };
    if (this.params.themeColor) this.theme = this.params.themeColor;
  }

  override async init() {
    this.sceneLines = BespokeSceneHelper.resolveLines(this.ctx, this.params);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, audio } = this.ctx;
    const t = f.t;
    const bass = f.a.bass;
    const rms = f.a.rms;
    const beat = audio.beatAt(t);

    this.lines.clear();
    this.hud.clear();
    if (f.layerIndex > 0) {
      clearRT(renderer, out, [0, 0, 0], 0);
    }

    // 1. 生成 3D 矩阵张量交织网线 (Matrix Lattice Lines)
    const lineCount = 36;
    const radius = 4.5 + bass * 1.5;
    const zSpan = 28.0;
    const camZ = ((t * 8.0) % zSpan) - zSpan * 0.5;

    for (let i = 0; i < lineCount; i++) {
      const angle = (i / lineCount) * Math.PI * 2.0 + t * 0.25;
      const twist = Math.sin(t * 0.5 + i * 0.3) * 0.8;
      const r = radius * (0.8 + 0.4 * Math.sin(angle * 3.0 + t));

      // 投影至屏幕坐标计算
      const segs = 12;
      for (let s = 0; s < segs; s++) {
        const z0 = (s / segs) * zSpan - zSpan * 0.5;
        const z1 = ((s + 1) / segs) * zSpan - zSpan * 0.5;
        const a0 = angle + twist * (z0 / zSpan);
        const a1 = angle + twist * (z1 / zSpan);

        // 透视投影
        const depth0 = z0 - camZ + zSpan * 0.5;
        const depth1 = z1 - camZ + zSpan * 0.5;

        if (depth0 > 1.0 && depth1 > 1.0) {
          const k0 = 650.0 / depth0;
          const k1 = 650.0 / depth1;

          const p0x = W * 0.5 + Math.cos(a0) * r * k0;
          const p0y = H * 0.5 + Math.sin(a0) * r * k0;
          const p1x = W * 0.5 + Math.cos(a1) * r * k1;
          const p1y = H * 0.5 + Math.sin(a1) * r * k1;

          const alpha = clamp(0.15 + bass * 0.45 - (depth0 / zSpan) * 0.3, 0.05, 0.85);

          this.lines.seg2(p0x, p0y, p1x, p1y, 1.8, this.theme, alpha);
        }
      }
    }

    // 2. 渲染 3D 线批
    this.lines.render(renderer, out);

    // 3. 绘制中央悬浮歌词与矩阵状态监控 HUD (支持多句轮播与无人声自动隐去)
    const ctx2d = this.hud.ctx;
    const lyric = BespokeSceneHelper.getRenderableLyric(this.sceneLines, t);

    if (!f.suppressLyrics && !lyric.isInstrumental && lyric.text && lyric.opacity > 0.01) {
      const fontSize = this.params.fontSize ?? 48;
      const autoSize = BespokeSceneHelper.autoFitSize(lyric.text.length, W - 200, fontSize);

      ctx2d.save();
      ctx2d.globalAlpha = lyric.opacity;
      ctx2d.translate(W * 0.5, H * 0.5 + lyric.offsetY);

      ctx2d.font = `700 ${autoSize}px "Courier New", monospace`;
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';

      // 发音高光双层绘制
      ctx2d.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx2d.fillText(lyric.text, 0, 4);

      // 高科技流光渐变
      const grad = ctx2d.createLinearGradient(-W * 0.35, 0, W * 0.35, 0);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(clamp(lyric.progress, 0.0, 1.0), `rgb(${Math.floor(this.theme[0] * 255)}, ${Math.floor(this.theme[1] * 255)}, ${Math.floor(this.theme[2] * 255)})`);
      grad.addColorStop(1.0, 'rgba(100, 120, 140, 0.35)');

      ctx2d.fillStyle = grad;
      ctx2d.fillText(lyric.text, 0, 0);

      // 顶部张量与节拍监控微文本
      ctx2d.font = '600 13px "Courier New", monospace';
      ctx2d.fillStyle = 'rgba(100, 240, 255, 0.7)';
      ctx2d.fillText(`[TENSOR LOOM] // LINE ${lyric.lineIndex + 1}/${lyric.totalLines} // BEAT: ${beat.toFixed(2)} // FLUX: ${(rms * 100).toFixed(1)}%`, 0, -autoSize - 16);

      ctx2d.restore();
    }

    // 4. 复合 HUD (使用 screen 模式)
    this.ctx.comp.draw(renderer, this.hud.upload(), out, { mode: 'screen' });
    return undefined;
  }
}
