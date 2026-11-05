import { Scene, Frame, type SceneCtx } from '../engine/scene';
import { BespokeSceneHelper, type GenericSceneParams } from './bespoke-helper';
import { W, H, Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { clamp, frameIdx, hash, lerp, springStep } from '../engine/util';
import type { Line, Word } from '../engine/lyrics';
import * as THREE from 'three';

/**
 * 工业重压动效排版通用插件 (Kinetic Heavy Press Plugin)
 * 提取自原版 dense-press，实现完全解耦的动态词流下拍液压挤压与字模破裂特效。
 */
export default class KineticPressPlugin extends Scene {
  private params: GenericSceneParams;
  private lines2d = new Layer2D();
  private batch = new LineBatch(16000, { blend: 'add' });
  private lines: Line[] = [];
  private currentLine: Line | null = null;
  private focusWord: Word | null = null;

  // 机械重压阶段状态
  private kicks: number[] = [];
  private theme: [number, number, number] = [0.95, 0.55, 0.2]; // 工业橙黄基色

  constructor(ctx: SceneCtx, params: GenericSceneParams = {}) {
    super(ctx);
    this.params = { ...params, ...(ctx.params ?? {}) };
    if (this.params.themeColor) this.theme = this.params.themeColor;
  }

  override async init() {
    const { audio } = this.ctx;
    // 1. 动态安全获取分配给该镜头的歌词行
    this.lines = BespokeSceneHelper.resolveLines(this.ctx, this.params);
    this.currentLine = this.lines[0] ?? null;

    if (this.currentLine) {
      this.focusWord = BespokeSceneHelper.extractFocusWord(
        this.currentLine,
        this.params.focusRule ?? 'peak',
        audio
      );
    }

    // 2. 提取分镜内的 4 个节拍下拍点，构建液压下压节奏
    const startB = audio.beatAt(this.ctx.start);
    this.kicks = [0, 1, 2, 3].map((i) => audio.timeOfBeat(Math.floor(startB) + i));
  }

  /** 计算当前时间处于哪一级液压冲压阶段以及弹簧阻尼回弹 */
  private getHydraulicStage(t: number) {
    let stage = 0;
    for (let i = 0; i < this.kicks.length; i++) {
      if (t >= this.kicks[i]!) stage = i + 1;
    }
    const lastKickT = stage > 0 ? this.kicks[stage - 1]! : this.ctx.start;
    const spring = stage === 0 ? 1.0 : springStep(t - lastKickT, 3.8, 0.45);
    return { stage, spring, progress: stage / Math.max(1, this.kicks.length) };
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer } = this.ctx;
    const t = f.t;
    const bass = f.a.bass;
    const rms = f.a.rms;

    this.batch.clear();
    const hud = this.lines2d;
    hud.clear();
    const ctx2d = hud.ctx;

    const { stage, spring, progress } = this.getHydraulicStage(t);

    // 1. 绘制工业外边框与液压警示标尺（随下拍强力震颤）
    const shake = stage > 0 && t - this.kicks[Math.min(stage - 1, this.kicks.length - 1)]! < 0.25
      ? (hash(frameIdx(t), 2) - 0.5) * 8
      : 0;

    const margin = 50 + (1.0 - spring) * 20;
    ctx2d.save();
    ctx2d.translate(shake, shake * 0.5);

    // 外轮廓安全框
    ctx2d.strokeStyle = `rgba(${Math.floor(this.theme[0] * 255)}, ${Math.floor(this.theme[1] * 255)}, ${Math.floor(this.theme[2] * 255)}, 0.4)`;
    ctx2d.lineWidth = 2;
    ctx2d.strokeRect(margin, margin, W - 2 * margin, H - 2 * margin);

    // 四角定位十字标
    const crossSize = 16;
    const corners = [
      [margin, margin],
      [W - margin, margin],
      [margin, H - margin],
      [W - margin, H - margin],
    ];
    ctx2d.strokeStyle = `rgba(255, 255, 255, 0.8)`;
    ctx2d.lineWidth = 1.5;
    for (const [cx, cy] of corners) {
      ctx2d.beginPath();
      ctx2d.moveTo(cx - crossSize, cy);
      ctx2d.lineTo(cx + crossSize, cy);
      ctx2d.moveTo(cx, cy - crossSize);
      ctx2d.lineTo(cx, cy + crossSize);
      ctx2d.stroke();
    }

    // 2. 核心大排版文字动态渲染 (支持多句轮播与无人声自动隐去)
    const lyric = BespokeSceneHelper.getRenderableLyric(this.lines, t);

    if (!f.suppressLyrics && !lyric.isInstrumental && lyric.text && lyric.opacity > 0.01) {
      const textToRender = lyric.text.toUpperCase();
      const totalChars = textToRender.length;
      const baseFontSize = this.params.fontSize ?? 110;
      // 动态收缩字号保证在安全框内
      const autoSize = BespokeSceneHelper.autoFitSize(totalChars, W - 2 * margin - 80, baseFontSize);

      // 液压挤压变形率：随下拍阶段收窄字宽，增强字重感
      const compressionScaleX = lerp(1.15, 0.75, progress) * (1.0 - (1.0 - spring) * 0.1);
      const compressionScaleY = lerp(0.9, 1.25, progress) * spring;

      ctx2d.save();
      ctx2d.globalAlpha = lyric.opacity;
      ctx2d.translate(W * 0.5, H * 0.5 + lyric.offsetY);
      ctx2d.scale(compressionScaleX, compressionScaleY);

      const activeWord = lyric.activeWord;
      const lineProg = lyric.progress;

      // 文字居中排版测量
      ctx2d.font = `900 ${autoSize}px "Archivo", "Impact", "Helvetica Neue", sans-serif`;
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';

      // 底层重压暗影
      ctx2d.fillStyle = 'rgba(10, 10, 14, 0.95)';
      ctx2d.fillText(textToRender, 0, 8);

      // 歌词发音进度填充渐变
      const grad = ctx2d.createLinearGradient(-W * 0.4, 0, W * 0.4, 0);
      const splitStop = clamp(lineProg, 0.01, 0.99);
      grad.addColorStop(0, `rgb(${Math.floor(this.theme[0] * 255)}, ${Math.floor(this.theme[1] * 255)}, ${Math.floor(this.theme[2] * 255)})`);
      grad.addColorStop(splitStop, '#ffffff');
      grad.addColorStop(Math.min(1.0, splitStop + 0.05), 'rgba(140, 140, 150, 0.45)');
      grad.addColorStop(1.0, 'rgba(80, 80, 90, 0.25)');

      ctx2d.fillStyle = grad;
      ctx2d.fillText(textToRender, 0, 0);

      // 击打高亮描边
      if (bass > 0.6 || activeWord) {
        ctx2d.strokeStyle = `rgba(255, 255, 255, ${clamp((bass - 0.4) * 2.0, 0.2, 0.9)})`;
        ctx2d.lineWidth = 3;
        ctx2d.strokeText(textToRender, 0, 0);
      }

      ctx2d.restore();

      // 3. 绘制重音焦点词下方的指示线与声学能量标尺
      const barY = H * 0.5 + autoSize * 0.8;
      const barW = 320 * (1.0 + bass * 0.4);
      ctx2d.save();
      ctx2d.globalAlpha = lyric.opacity;
      ctx2d.strokeStyle = `rgba(${Math.floor(this.theme[0] * 255)}, ${Math.floor(this.theme[1] * 255)}, ${Math.floor(this.theme[2] * 255)}, 0.8)`;
      ctx2d.lineWidth = 4;
      ctx2d.beginPath();
      ctx2d.moveTo(W * 0.5 - barW * 0.5, barY);
      ctx2d.lineTo(W * 0.5 - barW * 0.5 + barW * lyric.progress, barY);
      ctx2d.stroke();
      ctx2d.restore();
    }

    ctx2d.restore();

    // 4. 将 2D HUD 上传到 WebGL 渲染目标
    this.ctx.comp.draw(renderer, hud.upload(), out, { mode: 'replace' });
    return undefined;
  }
}
