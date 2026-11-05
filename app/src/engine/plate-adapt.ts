// Portable stand-in for a film plate whose window is not the shot it was authored on.
// One lyric line at a time, same carousel as the bespoke plugins. Motif stays up in the gaps.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx } from './scene';
import { Layer2D, W, H } from './gl';
import type { Line } from './lyrics';
import { BespokeSceneHelper, type RenderableLyric } from '../plugins/bespoke-helper';

export type PlateFamily = 'hook' | 'prompt' | 'press' | 'fuse' | 'chart' | 'void' | 'grid';

export function plateFamily(moduleName: string): PlateFamily {
  if (moduleName.startsWith('plate-hook')) return 'hook';
  if (moduleName.startsWith('plate-prompt')) return 'prompt';
  if (moduleName === 'plate-dense' || moduleName === 'plate-stack' || moduleName === 'plate-bureau') return 'press';
  if (moduleName === 'plate-fuse' || moduleName === 'plate-loss') return 'fuse';
  if (moduleName === 'plate-open' || moduleName === 'plate-outro') return 'void';
  if (moduleName === 'plate-ascent' || moduleName === 'plate-spacetime' || moduleName === 'plate-ilya') return 'chart';
  return 'grid';
}

const INK: Record<PlateFamily, string> = {
  hook: '255, 64, 96',
  prompt: '80, 230, 120',
  press: '240, 150, 50',
  fuse: '255, 120, 40',
  chart: '80, 170, 255',
  void: '190, 200, 220',
  grid: '120, 190, 210',
};

export class AdaptedPlate extends Scene {
  private hud = new Layer2D();
  private lines: Line[] = [];
  private family: PlateFamily;

  constructor(ctx: SceneCtx, private moduleName: string) {
    super(ctx);
    this.family = plateFamily(moduleName);
  }

  override init() {
    this.lines = BespokeSceneHelper.resolveLines(this.ctx, this.ctx.params);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const c = this.hud.ctx;
    this.hud.clear('#0c1016');
    this.drawMotif(c, f);
    if (!f.suppressLyrics) {
      const lyric = BespokeSceneHelper.getRenderableLyric(this.lines, f.t);
      this.drawLyric(c, lyric, f);
    }
    this.ctx.comp.draw(this.ctx.renderer, this.hud.upload(), out, { mode: 'replace' });
  }

  private drawMotif(c: CanvasRenderingContext2D, f: Frame) {
    const ink = INK[this.family];
    const horizon = H * 0.58 + Math.sin(f.beat * 0.35) * 10;
    const wash = c.createLinearGradient(0, horizon - 40, 0, H);
    wash.addColorStop(0, 'rgba(0, 0, 0, 0)');
    wash.addColorStop(1, `rgba(${ink}, 0.22)`);
    c.fillStyle = wash;
    c.fillRect(0, horizon, W, H - horizon);

    c.strokeStyle = `rgba(${ink}, 0.28)`;
    c.lineWidth = 1;
    const scroll = (f.beat * 36) % 56;
    c.beginPath();
    for (let x = -scroll; x <= W + 56; x += 56) {
      c.moveTo(x, H);
      c.lineTo(W * 0.5 + (x - W * 0.5) * 0.15, horizon);
    }
    const row = 28;
    const y0 = horizon + ((f.beat * 22) % row);
    for (let y = y0; y < H; y += row) {
      const k = (y - horizon) / Math.max(1, H - horizon);
      c.moveTo(W * 0.5 - W * 0.55 * k, y);
      c.lineTo(W * 0.5 + W * 0.55 * k, y);
    }
    c.stroke();

    const rings = this.family === 'hook' ? 4 : 2;
    for (let i = 0; i < rings; i++) {
      const radius = ((f.beat * 70 + i * 140) % 640) + 40;
      c.beginPath();
      c.arc(W * 0.5, H * 0.46, radius, 0, Math.PI * 2);
      c.strokeStyle = `rgba(${ink}, ${Math.max(0, 0.45 - radius / 1400)})`;
      c.lineWidth = this.family === 'hook' ? 2.5 : 1.25;
      c.stroke();
    }

    if (this.family === 'prompt') {
      c.strokeStyle = `rgba(${ink}, 0.45)`;
      c.strokeRect(140, 160, W - 280, H - 320);
      c.fillStyle = 'rgba(8, 14, 12, 0.55)';
      c.fillRect(141, 161, W - 282, 36);
    }
  }

  private drawLyric(c: CanvasRenderingContext2D, lyric: RenderableLyric, f: Frame) {
    if (lyric.isInstrumental || lyric.opacity <= 0.01 || !lyric.text.trim()) return;
    const ink = INK[this.family];
    const text = this.family === 'hook' || this.family === 'press' ? lyric.text.toUpperCase() : lyric.text;
    const size = BespokeSceneHelper.autoFitSize(text.length, W * 0.6, this.family === 'hook' ? 120 : 64);
    c.save();
    c.globalAlpha = lyric.opacity;
    c.translate(W * 0.5, H * 0.46 + lyric.offsetY);
    c.textAlign = 'center';
    c.textBaseline = 'middle';

    if (this.family === 'prompt') {
      const typed = text.slice(0, Math.floor(text.length * Math.min(1, Math.max(0, lyric.progress))));
      c.font = `700 ${size}px "Courier New", monospace`;
      c.textAlign = 'left';
      c.fillStyle = `rgb(${ink})`;
      const width = c.measureText(typed || ' ').width;
      c.fillText('> ' + typed, -Math.min(W * 0.28, width * 0.5), 0);
      if (Math.sin(f.t * 12) > 0 || lyric.phase === 'singing') {
        c.fillRect(-Math.min(W * 0.28, width * 0.5) + c.measureText('> ' + typed).width + 8, -size * 0.45, size * 0.45, size * 0.9);
      }
    } else if (this.family === 'press') {
      const squash = 0.82 + f.a.kick * 0.12;
      c.scale(squash, 1.08);
      c.font = `900 ${size}px "Archivo", "Impact", sans-serif`;
      c.fillStyle = 'rgba(8, 8, 10, 0.9)';
      c.fillText(text, 0, 8);
      c.fillStyle = '#fff';
      c.fillText(text, 0, 0);
    } else if (this.family === 'hook') {
      const burst = 1 + f.a.kick * 0.12;
      c.scale(burst, burst);
      c.font = `900 ${size}px "Impact", "Archivo", sans-serif`;
      c.lineWidth = 10;
      c.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      c.strokeText(text, 0, 0);
      c.fillStyle = '#fff';
      c.fillText(text, 0, 0);
      const bar = c.measureText(text).width;
      c.fillStyle = `rgb(${ink})`;
      c.fillRect(-bar * 0.5, size * 0.62, bar * Math.min(1, Math.max(0, lyric.progress)), 6);
    } else {
      c.restore();
      BespokeSceneHelper.renderEmbeddedLyric(c, lyric, f, {
        cx: W * 0.5,
        cy: H * 0.46,
        maxWidth: W * 0.6,
        baseSize: 64,
        color: 'rgba(255, 255, 255, ',
        activeColor: `rgba(${ink}, `,
        glowColor: `rgba(${ink}, `,
      });
      return;
    }
    c.restore();
  }
}

let muteDepth = 0;
let savedFill: typeof CanvasRenderingContext2D.prototype.fillText | null = null;
let savedStroke: typeof CanvasRenderingContext2D.prototype.strokeText | null = null;

/** Film plates paint their own captions with canvas text. Mute that while another layer owns the line. */
export function runWithCanvasTextMuted(draw: () => void) {
  if (muteDepth === 0) {
    savedFill = CanvasRenderingContext2D.prototype.fillText;
    savedStroke = CanvasRenderingContext2D.prototype.strokeText;
    CanvasRenderingContext2D.prototype.fillText = () => {};
    CanvasRenderingContext2D.prototype.strokeText = () => {};
  }
  muteDepth++;
  try {
    draw();
  } finally {
    muteDepth--;
    if (muteDepth === 0 && savedFill && savedStroke) {
      CanvasRenderingContext2D.prototype.fillText = savedFill;
      CanvasRenderingContext2D.prototype.strokeText = savedStroke;
      savedFill = null;
      savedStroke = null;
    }
  }
}
