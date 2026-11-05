import type { Line, Word } from '../engine/lyrics';
import type { AudioData } from '../engine/audio';
import type { SceneCtx } from '../engine/scene';
import { clamp, ease } from '../engine/util';

export interface GenericSceneParams {
  /** 自定义歌词覆盖文本列表 */
  customLines?: string[];
  /** 核心强调槽位提取策略：'longest' | 'peak' | number (第几个词) */
  focusRule?: 'longest' | 'peak' | number;
  /** 基础字号 */
  fontSize?: number;
  /** 主题基色 [r, g, b] (0..1) */
  themeColor?: [number, number, number];
  /** 辉光或后处理强度 */
  glow?: number;
  /** 额外参数包 */
  [key: string]: any;
}

export interface RenderableLyric {
  /** 当前应当显示的文本（空字符串代表纯器乐间奏期） */
  text: string;
  /** 当前行索引 */
  lineIndex: number;
  /** 总行数 */
  totalLines: number;
  /** 渲染透明度 0.0 ~ 1.0 (平滑淡入淡出，器乐期自动降为 0) */
  opacity: number;
  /** 垂直转场偏移像素 (进入向上微移，退场继续向上浮动) */
  offsetY: number;
  /** 当前行微秒级发音进度 0.0 ~ 1.0 */
  progress: number;
  /** 当前正在唱的单词 */
  activeWord: Word | null;
  /** 是否处于纯器乐间奏/尾奏期 */
  isInstrumental: boolean;
  /** 动态调速系数 */
  speedScale: number;
  /** 阶段定义 */
  phase: 'lead-in' | 'singing' | 'hold' | 'lead-out';
  /** 局部归一化时间 0.0 ~ 1.0 */
  tau: number;
  /** 当前激活的具体 Line 对象 */
  activeLine: Line;
}

export type LyricPhaseInfo = RenderableLyric;

export class BespokeSceneHelper {
  /**
   * 动态解析当前场景所关联的歌词行列表
   */
  static resolveLines(ctx: SceneCtx, params?: GenericSceneParams): Line[] {
    if (params?.customLines && params.customLines.length > 0) {
      const dur = ctx.end - ctx.start;
      return params.customLines.map((text, idx) => {
        const lStart = ctx.start + (dur * idx) / params.customLines!.length;
        const lEnd = ctx.start + (dur * (idx + 1)) / params.customLines!.length;
        // Even slices are not CTC. Leave words empty so karaoke does not highlight a fake phoneme clock.
        return {
          i: idx,
          text,
          start: lStart,
          end: lEnd,
          words: [],
        };
      });
    }

    const matched = ctx.lyrics.linesIn(ctx.start - 0.25, ctx.end + 0.25);
    if (matched && matched.length > 0) return matched;

    return [];
  }

  /**
   * 终极多句歌词流式轮播与无人声自动渐隐引擎 (Fluid Lyric Carousel & Gap Muting)
   * 彻底解决：
   * 1. 多句歌词只显示第一句/文字重叠
   * 2. 无人声纯器乐期文字常驻僵死、视效无变化堵满视口
   */
  static getRenderableLyric(lines: Line[], t: number): RenderableLyric {
    if (!lines || lines.length === 0) {
      const dummyLine: Line = { i: 0, text: '', start: t, end: t + 1, words: [] };
      return {
        text: '',
        lineIndex: 0,
        totalLines: 0,
        opacity: 0.0,
        offsetY: 0,
        progress: 0.0,
        activeWord: null,
        isInstrumental: true,
        speedScale: 1.0,
        phase: 'hold',
        tau: 0.5,
        activeLine: dummyLine,
      };
    }

    // 1. 查找当前时间落在哪个歌词生命周期
    let curIdx = -1;
    let inLeadIn = false;
    let inLeadOut = false;
    let inGap = false;

    // 前奏检查
    if (t < lines[0]!.start) {
      curIdx = 0;
      inLeadIn = true;
    } else if (t > lines[lines.length - 1]!.end) {
      curIdx = lines.length - 1;
      inLeadOut = true;
    } else {
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i]!;
        if (t >= l.start && t <= l.end) {
          curIdx = i;
          break;
        }
        if (i < lines.length - 1 && t > l.end && t < lines[i + 1]!.start) {
          curIdx = i;
          inGap = true;
          break;
        }
      }
    }

    if (curIdx === -1) curIdx = lines.length - 1;
    const curLine = lines[curIdx]!;
    const dur = Math.max(0.4, curLine.end - curLine.start);
    const speedScale = clamp(3.5 / dur, 0.4, 2.8);
    const tau = (t - curLine.start) / dur;

    // 2. 计算淡入淡出透明度与位移
    let opacity = 1.0;
    let offsetY = 0;
    let isInstrumental = false;
    let phase: RenderableLyric['phase'] = 'singing';

    const FADE_IN = 0.25;  // 提前 0.25s 开始淡入
    const FADE_OUT = 0.35; // 唱完后持续 0.35s 淡出

    if (inLeadIn) {
      phase = 'lead-in';
      const dt = curLine.start - t;
      if (dt > FADE_IN) {
        opacity = 0.0;
        isInstrumental = true;
      } else {
        const f = 1.0 - dt / FADE_IN;
        opacity = ease.outQuad(f);
        offsetY = (1.0 - f) * 18;
      }
    } else if (inLeadOut) {
      phase = 'lead-out';
      const dt = t - curLine.end;
      if (dt > FADE_OUT) {
        opacity = 0.0;
        isInstrumental = true;
      } else {
        const f = 1.0 - dt / FADE_OUT;
        opacity = ease.outQuad(f);
        offsetY = -(1.0 - f) * 14;
      }
    } else if (inGap) {
      phase = 'hold';
      const nextLine = lines[curIdx + 1]!;
      const gapTotal = nextLine.start - curLine.end;
      const tFromEnd = t - curLine.end;
      const tToNext = nextLine.start - t;

      if (gapTotal > FADE_OUT + FADE_IN) {
        if (tFromEnd < FADE_OUT) {
          const f = 1.0 - tFromEnd / FADE_OUT;
          opacity = ease.outQuad(f);
          offsetY = -(1.0 - f) * 14;
        } else if (tToNext < FADE_IN) {
          const f = 1.0 - tToNext / FADE_IN;
          return {
            text: nextLine.text,
            lineIndex: curIdx + 1,
            totalLines: lines.length,
            opacity: ease.outQuad(f),
            offsetY: (1.0 - f) * 18,
            progress: 0.0,
            activeWord: null,
            isInstrumental: false,
            speedScale: clamp(3.5 / Math.max(0.4, nextLine.end - nextLine.start), 0.4, 2.8),
            phase: 'lead-in',
            tau: 0.0,
            activeLine: nextLine,
          };
        } else {
          opacity = 0.0;
          isInstrumental = true;
        }
      } else {
        const cross = tFromEnd / Math.max(1e-4, gapTotal);
        if (cross < 0.5) {
          opacity = 1.0 - cross * 2.0;
          offsetY = -cross * 20;
        } else {
          return {
            text: nextLine.text,
            lineIndex: curIdx + 1,
            totalLines: lines.length,
            opacity: (cross - 0.5) * 2.0,
            offsetY: (1.0 - (cross - 0.5) * 2.0) * 18,
            progress: 0.0,
            activeWord: null,
            isInstrumental: false,
            speedScale: clamp(3.5 / Math.max(0.4, nextLine.end - nextLine.start), 0.4, 2.8),
            phase: 'lead-in',
            tau: 0.0,
            activeLine: nextLine,
          };
        }
      }
    }

    // 3. 计算发音进度与活跃单词
    const progress = this.lineProgress(curLine, t);
    const activeWord = curLine.words?.find((w) => t >= w.start && t <= w.end) ?? null;

    return {
      text: curLine.text,
      lineIndex: curIdx,
      totalLines: lines.length,
      opacity: clamp(opacity, 0.0, 1.0),
      offsetY,
      progress,
      activeWord,
      isInstrumental,
      speedScale,
      phase,
      tau,
      activeLine: curLine,
    };
  }

  /** 兼容别名 */
  static getLyricPhaseInfo(lines: Line[], t: number): RenderableLyric {
    return this.getRenderableLyric(lines, t);
  }

  /**
   * 声学与语义焦点词提取算法
   */
  static extractFocusWord(
    line: Line,
    rule: 'longest' | 'peak' | number = 'peak',
    audio?: AudioData
  ): Word {
    if (!line.words || line.words.length === 0) {
      return { w: '', start: line.start, end: line.end, line: line.i, index: 0, gi: 0 };
    }

    if (typeof rule === 'number') {
      const idx = clamp(rule, 0, line.words.length - 1);
      return line.words[idx]!;
    }

    if (rule === 'longest') {
      return [...line.words].sort((a, b) => b.w.length - a.w.length)[0]!;
    }

    if (audio) {
      let maxBass = -1;
      let targetWord = line.words[0]!;
      for (const wd of line.words) {
        const midT = (wd.start + wd.end) * 0.5;
        const b = audio.env('bass', midT);
        if (b > maxBass) {
          maxBass = b;
          targetWord = wd;
        }
      }
      return targetWord;
    }

    return line.words[0]!;
  }

  /**
   * 单词级别微秒级发音进度计算
   */
  static wordProgress(w: Word, t: number): number {
    if (t <= w.start) return 0.0;
    if (t >= w.end) return 1.0;
    const dur = Math.max(1e-4, w.end - w.start);
    return clamp((t - w.start) / dur, 0.0, 1.0);
  }

  /**
   * 行级别综合发音完成度
   */
  static lineProgress(l: Line, t: number): number {
    if (t <= l.start) return 0.0;
    if (t >= l.end) return 1.0;
    if (!l.words || l.words.length === 0) return clamp((t - l.start) / Math.max(1e-4, l.end - l.start), 0.0, 1.0);

    let sungChars = 0;
    let totalChars = 0;
    for (const w of l.words) {
      const len = w.w.length;
      totalChars += len;
      sungChars += len * this.wordProgress(w, t);
    }
    return totalChars > 0 ? sungChars / totalChars : 0.0;
  }

  /**
   * 视口宽度安全自适应计算
   */
  static autoFitSize(totalChars: number, maxViewPx: number, baseSize: number): number {
    const estWidth = totalChars * baseSize * 0.58;
    if (estWidth <= maxViewPx) return baseSize;
    return Math.max(24, Math.floor(baseSize * (maxViewPx / estWidth)));
  }

  /**
   * 统一歌词分镜嵌入与绘制管线 (Universal Embedded Lyric Renderer)
   * 任何场景插件只需 1 行代码即可获得具备卡拉OK高亮、字级发音动画、下拍微动与平滑过渡的电影级排版
   */
  static renderEmbeddedLyric(
    ctx2d: CanvasRenderingContext2D,
    lyric: RenderableLyric,
    f: { t: number; beat: number; barPhase: number; a: { kick: number; snare: number; rms: number }; suppressLyrics?: boolean },
    options: {
      cx?: number;
      cy?: number;
      maxWidth?: number;
      baseSize?: number;
      fontFamily?: string;
      color?: string;
      activeColor?: string;
      glowColor?: string;
      align?: 'center' | 'left' | 'right';
      showTelemetry?: boolean; // default off: telemetry must not burn into the export frame
      telemetryTag?: string;
    } = {}
  ): void {
    if (f.suppressLyrics) return;
    if (lyric.isInstrumental || lyric.opacity <= 0.001 || !lyric.text) {
      return;
    }

    const cx = options.cx ?? 960;
    const cy = (options.cy ?? 540) + lyric.offsetY;
    const maxWidth = options.maxWidth ?? 1600;
    const baseSize = options.baseSize ?? 56;
    const fontFamily = options.fontFamily ?? '"Archivo", sans-serif';
    const align = options.align ?? 'center';

    const words = lyric.activeLine.words || [];
    const fullText = lyric.text;
    const actualSize = this.autoFitSize(fullText.length, maxWidth, baseSize);

    // 拍点微震 (Bass kick / Beat pulse)
    const kickPunch = f.a.kick * 4.0;
    const beatScale = 1.0 + f.a.kick * 0.035;

    ctx2d.save();
    ctx2d.translate(cx, cy);
    ctx2d.scale(beatScale, beatScale);

    ctx2d.font = `800 ${actualSize}px ${fontFamily}`;
    ctx2d.textAlign = align;
    ctx2d.textBaseline = 'middle';

    const alpha = lyric.opacity;

    // 辉光与背影阴影
    const glowCol = options.glowColor ?? 'rgba(0, 240, 255, ';
    const textCol = options.color ?? 'rgba(255, 255, 255, ';
    const actCol = options.activeColor ?? 'rgba(255, 220, 80, ';

    const strokeCol = `rgba(5, 8, 15, ${alpha * 0.95})`;
    const strokeWidth = Math.max(4, actualSize * 0.08);

    // 如果有词级时间戳，逐词绘制卡拉OK高亮
    if (words.length > 0 && align === 'center') {
      const metrics = words.map((w) => ctx2d.measureText(w.w));
      const spaceWidth = ctx2d.measureText(' ').width;
      const totalW = metrics.reduce((acc, m) => acc + m.width, 0) + spaceWidth * (words.length - 1);
      let curX = -totalW * 0.5;

      for (let wi = 0; wi < words.length; wi++) {
        const wd = words[wi]!;
        const wWidth = metrics[wi]!.width;
        const isSung = f.t >= wd.end;
        const isSinging = f.t >= wd.start && f.t < wd.end;
        const wProgress = this.wordProgress(wd, f.t);

        ctx2d.textAlign = 'left';
        ctx2d.lineJoin = 'round';

        // 1. 紧密深色轮廓描边（保护字形可读性，绝不阻挡背景画面）
        ctx2d.strokeStyle = strokeCol;
        ctx2d.lineWidth = strokeWidth;
        ctx2d.shadowBlur = 0;
        ctx2d.strokeText(wd.w, curX, 0);

        // 2. 字形填色与动态辉光
        if (isSinging) {
          ctx2d.fillStyle = `${actCol}${alpha})`;
          ctx2d.shadowColor = `${glowCol}${alpha * 0.9})`;
          ctx2d.shadowBlur = 28 + kickPunch * 4.0;
        } else if (isSung) {
          ctx2d.fillStyle = `${textCol}${alpha * 0.98})`;
          ctx2d.shadowColor = `rgba(0, 0, 0, ${alpha * 0.8})`;
          ctx2d.shadowBlur = 8;
        } else {
          ctx2d.fillStyle = `${textCol}${alpha * 0.42})`;
          ctx2d.shadowBlur = 0;
        }

        ctx2d.fillText(wd.w, curX, 0);

        // 发音下划线
        if (isSinging) {
          ctx2d.fillStyle = `${actCol}${alpha * 0.95})`;
          ctx2d.shadowColor = `${glowCol}${alpha})`;
          ctx2d.shadowBlur = 12;
          ctx2d.fillRect(curX, actualSize * 0.6, wWidth * wProgress, 4);
        }

        curX += wWidth + spaceWidth;
      }
    } else {
      // 整体单行文本绘制
      ctx2d.lineJoin = 'round';
      ctx2d.strokeStyle = strokeCol;
      ctx2d.lineWidth = strokeWidth;
      ctx2d.shadowBlur = 0;
      ctx2d.strokeText(fullText, 0, 0);

      ctx2d.fillStyle = `${textCol}${alpha})`;
      ctx2d.shadowColor = `${glowCol}${alpha * 0.8})`;
      ctx2d.shadowBlur = 20 + kickPunch * 2.5;
      ctx2d.fillText(fullText, 0, 0);
    }

    // 辅助遥测标签
    if (options.showTelemetry) {
      const tag = options.telemetryTag ?? `SCENE [${(lyric.lineIndex + 1).toString().padStart(2, '0')}/${lyric.totalLines.toString().padStart(2, '0')}]`;
      ctx2d.font = `600 16px "JetBrains Mono", monospace`;
      ctx2d.fillStyle = `rgba(180, 200, 220, ${alpha * 0.7})`;
      ctx2d.shadowBlur = 0;
      ctx2d.textAlign = align;
      ctx2d.fillText(tag, 0, -actualSize * 0.85);
    }

    ctx2d.restore();
  }
}

