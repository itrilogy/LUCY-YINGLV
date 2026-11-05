// One lyric line, timed by word ends. No shot-progress clock and no opaque plate.
import type * as THREE from 'three';
import type { Compositor, Layer2D } from './gl';
import { Lyrics, type Line, type Word } from './lyrics';
import { rgba } from './palette';
import type { Frame } from './scene';
import { BespokeSceneHelper } from '../plugins/bespoke-helper';

export interface ShotGlyphHost {
  layer: Layer2D;
  comp: Compositor;
  renderer: THREE.WebGLRenderer;
  W: number;
  H: number;
}

/** Per-character ink in [0,1]. Empty when the line has no word times. */
export function glyphAlphas(line: Line, t: number): number[] {
  const words = line.words ?? [];
  if (words.length === 0 || !line.text) return [];
  const text = line.text;
  const alphas: number[] = [];
  let cursor = 0;
  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi]!;
    let at = text.indexOf(word.w, cursor);
    if (at < 0) at = cursor;
    const prev = wi > 0 ? words[wi - 1]! : null;
    while (cursor < at && cursor < text.length) {
      alphas.push(prev && Lyrics.wordProgress(prev, t) >= 1 ? 1 : 0);
      cursor++;
    }
    pushWord(alphas, word, t);
    cursor += word.w.length;
  }
  const last = words[words.length - 1]!;
  while (cursor < text.length) {
    alphas.push(Lyrics.wordProgress(last, t) >= 1 ? 1 : 0);
    cursor++;
  }
  return alphas;
}

function pushWord(alphas: number[], word: Word, t: number) {
  const n = Math.max(1, word.w.length);
  const p = Lyrics.wordProgress(word, t);
  for (let i = 0; i < word.w.length; i++) {
    alphas.push(Math.min(1, Math.max(0, p * n - i)));
  }
}

/**
 * Draw the one line `getRenderableLyric` returns. Glyphs outside the sung
 * word stay at ink 0. The last glyph of a word is full at `word.end`.
 */
export function paintShotLine(
  host: ShotGlyphHost,
  lines: Line[],
  f: Frame,
  out: THREE.WebGLRenderTarget,
  opts?: { color?: string; baseSize?: number },
): void {
  const lyric = BespokeSceneHelper.getRenderableLyric(lines, f.t);
  if (lyric.isInstrumental || lyric.opacity <= 0.001 || !lyric.text) return;
  const line = lyric.activeLine;
  const alphas = glyphAlphas(line, f.t);
  if (alphas.length === 0 || !alphas.some((a) => a > 0)) return;

  const text = line.text;
  const maxW = host.W * 0.6;
  const size = BespokeSceneHelper.autoFitSize(text.length, maxW, opts?.baseSize ?? 64);
  const ctx = host.layer.ctx;
  host.layer.clear();
  ctx.save();
  ctx.font = `700 ${size}px "Archivo", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const widths = Array.from(text).map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((s, w) => s + w, 0);
  const scale = total > maxW ? maxW / total : 1;
  const drawW = total * scale;
  let x = (host.W - drawW) / 2;
  const y = host.H * 0.5;
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const ink = alphas[i] ?? 0;
    const w = (widths[i] ?? 0) * scale;
    if (ink > 0) {
      const full = ink >= 0.999;
      ctx.globalAlpha = lyric.opacity * ink;
      ctx.fillStyle = opts?.color ?? (full ? rgba('signal', 1) : rgba('bone', 1));
      ctx.fillText(chars[i]!, x, y);
    }
    x += w;
  }
  ctx.restore();
  host.comp.draw(host.renderer, host.layer.upload(true), out, { mode: 'normal' });
}
