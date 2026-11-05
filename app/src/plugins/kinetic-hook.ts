import { Scene, Frame, type SceneCtx } from '../engine/scene';
import { BespokeSceneHelper, type GenericSceneParams } from './bespoke-helper';
import { W, H, Layer2D } from '../engine/gl';
import { clamp, frameIdx, hash, lerp } from '../engine/util';
import type { Line } from '../engine/lyrics';
import * as THREE from 'three';

/**
 * 副歌大标题冲击排版插件 (Kinetic Hook Chorus Plugin)
 * 提取自原版 hook.ts，具备超大字号爆发冲击、同心圆激波环、下拍剧烈抖动与故障色散发光。
 */
export default class KineticHookPlugin extends Scene {
  private params: GenericSceneParams;
  private hud = new Layer2D();
  private sceneLines: Line[] = [];
  private theme: [number, number, number] = [1.0, 0.2, 0.4]; // 冲击品红

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
    const kick = f.a.kick;
    const beat = audio.beatAt(t);

    this.hud.clear();
    const ctx2d = this.hud.ctx;

    const info = BespokeSceneHelper.getLyricPhaseInfo(this.sceneLines, t);
    const showLine = !f.suppressLyrics && !info.isInstrumental && info.opacity > 0.01 && !!info.text;
    const text = showLine ? info.text : '';

    // 1. 下拍剧烈震颤位移
    const shakeAmount = kick > 0.3 ? (hash(frameIdx(t), 1) - 0.5) * 8 : 0;

    ctx2d.save();
    ctx2d.translate(W * 0.5 + shakeAmount, H * 0.5 + shakeAmount * 0.6);

    // 2. 绘制多重同心圆声波脉冲环 (Concentric Shockwaves)
    const shockCount = 4;
    for (let i = 0; i < shockCount; i++) {
      const ringR = ((beat * 80 + i * 160) % 700) + 50;
      const alpha = clamp(1.0 - ringR / 750, 0.0, 0.8) * (0.3 + bass * 0.7);
      ctx2d.beginPath();
      ctx2d.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx2d.strokeStyle = `rgba(${Math.floor(this.theme[0] * 255)}, ${Math.floor(this.theme[1] * 255)}, ${Math.floor(this.theme[2] * 255)}, ${alpha})`;
      ctx2d.lineWidth = 2.5 + kick * 4;
      ctx2d.stroke();
    }

    // 3. 超大冲击大字排版。透明度来自轮播：间隙里上一句必须退场，下一句才进来。
    if (text) {
      ctx2d.save();
      ctx2d.globalAlpha = info.opacity;
      const baseFontSize = this.params.fontSize ?? 130;
      const autoSize = BespokeSceneHelper.autoFitSize(text.length, W - 140, baseFontSize);

      // 随节拍下拍产生瞬态缩放爆发
      const burstScale = 1.0 + kick * 0.18 + (1.0 - clamp(info.tau * 2.0, 0.0, 1.0)) * 0.25;
      ctx2d.scale(burstScale, burstScale);

      ctx2d.font = `900 ${autoSize}px "Impact", "Archivo", sans-serif`;
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';

      // 故障色散 (Chromatic Aberration) 重影：红蓝分离
      if (bass > 0.5 || kick > 0.4) {
        ctx2d.fillStyle = 'rgba(255, 0, 80, 0.8)';
        ctx2d.fillText(text.toUpperCase(), -8 * kick, 0);

        ctx2d.fillStyle = 'rgba(0, 240, 255, 0.8)';
        ctx2d.fillText(text.toUpperCase(), 8 * kick, 0);
      }

      // 底层粗描边
      ctx2d.strokeStyle = 'rgba(0, 0, 0, 0.9)';
      ctx2d.lineWidth = 12;
      ctx2d.strokeText(text.toUpperCase(), 0, 0);

      // 正面主文本 (高亮纯白 + 主题色高光渐变)
      ctx2d.fillStyle = '#ffffff';
      ctx2d.fillText(text.toUpperCase(), 0, 0);

      // 发音进度下划线
      const textWidth = ctx2d.measureText(text.toUpperCase()).width;
      const barY = autoSize * 0.65;
      ctx2d.fillStyle = `rgb(${Math.floor(this.theme[0] * 255)}, ${Math.floor(this.theme[1] * 255)}, ${Math.floor(this.theme[2] * 255)})`;
      ctx2d.fillRect(-textWidth * 0.5, barY, textWidth * clamp(info.progress, 0, 1), 6);
      ctx2d.restore();
    }

    ctx2d.restore();

    // 4. 复合到 WebGL
    this.ctx.comp.draw(renderer, this.hud.upload(), out, { mode: 'replace' });
    return undefined;
  }
}
