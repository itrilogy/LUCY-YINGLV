import { Scene, Frame, type SceneCtx } from '../engine/scene';
import { BespokeSceneHelper, type GenericSceneParams } from './bespoke-helper';
import { W, H, Layer2D } from '../engine/gl';
import { clamp, lerp } from '../engine/util';
import type { Line } from '../engine/lyrics';
import * as THREE from 'three';

/**
 * 黑客终端大模型交互逐字输出插件 (Cyber Prompt Terminal Plugin)
 * 提取自原版 prompt.ts，具备高保真终端窗口、发音严格锁相的逐字键入、光标闪烁与绿色荧光。
 */
export default class CyberPromptPlugin extends Scene {
  private params: GenericSceneParams;
  private hud = new Layer2D();
  private sceneLines: Line[] = [];
  private theme: [number, number, number] = [0.2, 0.95, 0.4]; // 终端矩阵绿

  constructor(ctx: SceneCtx, params: GenericSceneParams = {}) {
    super(ctx);
    this.params = { ...params, ...(ctx.params ?? {}) };
    if (this.params.themeColor) this.theme = this.params.themeColor;
  }

  override async init() {
    this.sceneLines = BespokeSceneHelper.resolveLines(this.ctx, this.params);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer } = this.ctx;
    const t = f.t;

    this.hud.clear();
    const ctx2d = this.hud.ctx;

    // 1. 动态获取当前正在起振的歌词行及其生命周期
    const info = BespokeSceneHelper.getLyricPhaseInfo(this.sceneLines, t);
    const showLine = !f.suppressLyrics && !info.isInstrumental && info.opacity > 0.01;
    const fullText = showLine ? (info.text ?? '') : '';

    // 2. 终端窗口布局计算
    const winX = 120;
    const winY = 140;
    const winW = W - 2 * winX;
    const winH = H - 2 * winY;

    // 窗口外框暗黑底色
    ctx2d.fillStyle = 'rgba(12, 16, 18, 0.94)';
    ctx2d.fillRect(winX, winY, winW, winH);

    // 窗口描边
    ctx2d.strokeStyle = `rgba(${Math.floor(this.theme[0] * 255)}, ${Math.floor(this.theme[1] * 255)}, ${Math.floor(this.theme[2] * 255)}, 0.5)`;
    ctx2d.lineWidth = 2;
    ctx2d.strokeRect(winX, winY, winW, winH);

    // 顶部标题栏
    ctx2d.fillStyle = 'rgba(20, 26, 30, 0.95)';
    ctx2d.fillRect(winX, winY, winW, 42);
    ctx2d.strokeRect(winX, winY, winW, 42);

    // 窗口三色按钮标点
    const dotColors = ['#ff5f56', '#ffbd2e', '#27c93f'];
    for (let i = 0; i < 3; i++) {
      ctx2d.beginPath();
      ctx2d.arc(winX + 24 + i * 22, winY + 21, 6, 0, Math.PI * 2);
      ctx2d.fillStyle = dotColors[i]!;
      ctx2d.fill();
    }

    // 标题文本
    ctx2d.font = '600 14px "Courier New", monospace';
    ctx2d.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx2d.textAlign = 'center';
    if (!f.suppressLyrics) {
      ctx2d.fillText(`terminal@model: ~//stream_tokens (Line ${info.lineIndex + 1}/${Math.max(1, info.totalLines)})`, winX + winW * 0.5, winY + 26);
    }

    // 3. 逐字键入。一句唱完就清掉，下一句从空光标重新键入。
    if (!f.suppressLyrics) {
      const typedLength = Math.floor(fullText.length * clamp(info.progress, 0, 1));
      const currentTypedText = fullText.slice(0, typedLength);
      ctx2d.save();
      ctx2d.globalAlpha = showLine ? info.opacity : 0.35;

      const baseFontSize = this.params.fontSize ?? 52;
      const autoSize = BespokeSceneHelper.autoFitSize(Math.max(1, fullText.length), winW - 120, baseFontSize);

      ctx2d.textAlign = 'left';
      ctx2d.textBaseline = 'top';
      ctx2d.font = `700 ${autoSize}px "Courier New", monospace`;

      const textStartX = winX + 50;
      const textStartY = winY + 110;

      ctx2d.fillStyle = `rgb(${Math.floor(this.theme[0] * 255)}, ${Math.floor(this.theme[1] * 255)}, ${Math.floor(this.theme[2] * 255)})`;
      ctx2d.fillText('> ', textStartX - autoSize * 0.9, textStartY);

      ctx2d.fillStyle = '#ffffff';
      ctx2d.fillText(currentTypedText, textStartX, textStartY);

      const textWidth = ctx2d.measureText(currentTypedText).width;
      const cursorBlink = Math.sin(t * 12.0) > 0 || info.phase === 'singing';
      if (cursorBlink && showLine) {
        ctx2d.fillStyle = `rgb(${Math.floor(this.theme[0] * 255)}, ${Math.floor(this.theme[1] * 255)}, ${Math.floor(this.theme[2] * 255)})`;
        ctx2d.fillRect(textStartX + textWidth + 6, textStartY + 4, autoSize * 0.55, autoSize);
      }
      ctx2d.restore();
    }

    // 5. 上传并复合到 WebGL
    this.ctx.comp.draw(renderer, this.hud.upload(), out, { mode: 'replace' });
    return undefined;
  }
}
