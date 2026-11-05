import { Scene, Frame, type SceneCtx } from '../engine/scene';
import { BespokeSceneHelper, type GenericSceneParams } from './bespoke-helper';
import { W, H, Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { clamp, lerp } from '../engine/util';
import type { Line } from '../engine/lyrics';
import * as THREE from 'three';

/**
 * 声学通量图表与火花折线插件 (Acoustic Loss Curve Plugin)
 * 提取自原版 loss.ts，将手绘曲线解耦为声学实时通量折线图，激光火花在曲线顶端随发音进度跳动。
 */
export default class AcousticLossPlugin extends Scene {
  private params: GenericSceneParams;
  private hud = new Layer2D();
  private lines = new LineBatch(32000, { blend: 'add' });
  private sceneLines: Line[] = [];
  private theme: [number, number, number] = [1.0, 0.35, 0.2]; // 警戒赤橙红

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

    this.hud.clear();
    this.lines.clear();
    const ctx2d = this.hud.ctx;

    // 0. 独奏模式下铺设深邃科技暗色底板；多层叠加模式下保持透明底板
    if (f.layerIndex === 0) {
      ctx2d.fillStyle = 'rgba(10, 14, 18, 0.96)';
      ctx2d.fillRect(0, 0, W, H);
    } else {
      clearRT(renderer, out, [0, 0, 0], 0);
    }

    const info = BespokeSceneHelper.getLyricPhaseInfo(this.sceneLines, t);
    const line = info.activeLine;

    // 1. 绘制对数坐标系与背景网格
    const plotX0 = 160;
    const plotX1 = W - 160;
    const plotY0 = 160;
    const plotY1 = H - 200;
    const plotW = plotX1 - plotX0;
    const plotH = plotY1 - plotY0;

    // 网格线条
    const gridCols = 8;
    const gridRows = 5;
    ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx2d.lineWidth = 1;
    for (let c = 0; c <= gridCols; c++) {
      const gx = plotX0 + (plotW * c) / gridCols;
      ctx2d.beginPath();
      ctx2d.moveTo(gx, plotY0);
      ctx2d.lineTo(gx, plotY1);
      ctx2d.stroke();
    }
    for (let r = 0; r <= gridRows; r++) {
      const gy = plotY0 + (plotH * r) / gridRows;
      ctx2d.beginPath();
      ctx2d.moveTo(plotX0, gy);
      ctx2d.lineTo(plotX1, gy);
      ctx2d.stroke();
    }

    // 2. 构建声学通量动态折线 (Acoustic Flux Polyline)
    const samples = 48;
    const points: [number, number][] = [];
    const windowStart = t - 1.5;
    const windowEnd = t + 0.5;

    for (let s = 0; s < samples; s++) {
      const st = windowStart + ((windowEnd - windowStart) * s) / samples;
      const px = plotX0 + (plotW * s) / samples;
      // 基于音频 Bass 与 RMS 采样动态折线高度
      const sampleBass = audio.env('bass', st);
      const sampleRms = audio.env('rms', st);
      const val = sampleBass * 0.7 + sampleRms * 0.3;
      const py = plotY1 - clamp(val * 1.8, 0.05, 0.95) * plotH;
      points.push([px, py]);
    }

    // 用 LineBatch 绘制连续高亮折线
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, ay] = points[i]!;
      const [bx, by] = points[i + 1]!;
      const isCurrentHead = Math.abs(i - Math.floor(samples * 0.75)) < 3;
      const lineWidth = isCurrentHead ? 3.5 : 2.0;
      const alpha = isCurrentHead ? 1.0 : 0.65;
      this.lines.seg2(ax, ay, bx, by, lineWidth, this.theme, alpha);
    }

    this.lines.render(renderer, out);

    // 3. 在当前时间点绘制激光激波火花
    const headIdx = Math.floor(samples * 0.75);
    const [headX, headY] = points[headIdx]!;

    ctx2d.save();
    // 火花中心光斑
    ctx2d.beginPath();
    ctx2d.arc(headX, headY, 8 + bass * 12, 0, Math.PI * 2);
    ctx2d.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx2d.fill();

    // 火花外发光环
    ctx2d.beginPath();
    ctx2d.arc(headX, headY, 24 + bass * 28, 0, Math.PI * 2);
    ctx2d.strokeStyle = `rgba(${Math.floor(this.theme[0] * 255)}, ${Math.floor(this.theme[1] * 255)}, ${Math.floor(this.theme[2] * 255)}, 0.6)`;
    ctx2d.lineWidth = 2.5;
    ctx2d.stroke();

    // 4. 坐标轴读数与微文本（仅独奏层显示，避免多层左上角文字踩踏）
    if (f.layerIndex === 0) {
      ctx2d.font = '600 13px "Courier New", monospace';
      ctx2d.fillStyle = 'rgba(255, 180, 160, 0.7)';
      ctx2d.fillText(`FLUX_PEAK: ${(bass * 10.0).toFixed(2)} dB // EPOCH_LOSS: ${(1.0 / Math.max(0.1, bass + 0.5)).toFixed(4)}`, plotX0, plotY0 - 15);
    }

    // 5. 悬浮发音歌词大字（支持多句轮播与无人声自动隐去）
    const lyric = BespokeSceneHelper.getRenderableLyric(this.sceneLines, t);
    if (!f.suppressLyrics && !lyric.isInstrumental && lyric.text && lyric.opacity > 0.01) {
      const autoSize = BespokeSceneHelper.autoFitSize(lyric.text.length, plotW, this.params.fontSize ?? 54);
      ctx2d.font = `700 ${autoSize}px "Archivo", "Helvetica Neue", sans-serif`;
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';

      ctx2d.save();
      ctx2d.globalAlpha = lyric.opacity;
      ctx2d.translate(0, lyric.offsetY);

      // 阴影
      ctx2d.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx2d.fillText(lyric.text, W * 0.5, plotY1 + 80);

      // 发音渐变
      const grad = ctx2d.createLinearGradient(W * 0.2, 0, W * 0.8, 0);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(clamp(lyric.progress, 0.05, 0.95), `rgb(${Math.floor(this.theme[0] * 255)}, ${Math.floor(this.theme[1] * 255)}, ${Math.floor(this.theme[2] * 255)})`);
      grad.addColorStop(1.0, 'rgba(120, 120, 130, 0.35)');

      ctx2d.fillStyle = grad;
      ctx2d.fillText(lyric.text, W * 0.5, plotY1 + 76);
      ctx2d.restore();
    }

    ctx2d.restore();

    // 6. 复合 HUD
    this.ctx.comp.draw(renderer, this.hud.upload(), out, { mode: 'normal' });
    return undefined;
  }
}
