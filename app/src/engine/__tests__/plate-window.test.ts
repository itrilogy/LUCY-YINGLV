import { describe, expect, it } from 'vitest';
import type { Line, Lyrics } from '../lyrics';
import { plateCoversWindow, residentLines } from '../plate-window';

function fake(rows: { text: string; start: number; end: number }[]): Lyrics {
  const lines: Line[] = rows.map((row, i) => ({ ...row, i, words: [] }));
  return {
    lines,
    linesIn(t0: number, t1: number) {
      return lines.filter((l) => l.end > t0 && l.start < t1);
    },
    find(s: string) {
      const q = s.toLowerCase();
      return lines.filter((l) => l.text.toLowerCase().includes(q));
    },
  } as unknown as Lyrics;
}

const song = fake([
  { text: 'I see sparks of AGI in your eyes', start: 2, end: 6 },
  { text: 'Your circuits make me nervous,', start: 6, end: 9 },
  { text: "that's no surprise", start: 9, end: 12 },
  { text: 'Too late now, we lit the fuse', start: 80, end: 86 },
  { text: 'Orthogonality thesis blues', start: 86, end: 92 },
  { text: "I'm upping my P(doom)", start: 100, end: 104 },
  { text: "I'm upping my P(doom)", start: 110, end: 114 },
]);

describe('plateCoversWindow', () => {
  it('keeps a plate whose resident lines are exactly its authored set', () => {
    expect(plateCoversWindow('plate-open', song, 0, 12.2)).toBe(true);
    expect(plateCoversWindow('plate-fuse', song, 79.5, 92.2)).toBe(true);
  });

  it('refuses a plate dropped on another sentence, so init cannot run off-window', () => {
    expect(plateCoversWindow('plate-fuse', song, 100, 114)).toBe(false);
    expect(plateCoversWindow('plate-open', song, 80, 92)).toBe(false);
  });

  it('treats a one-line plate as a carousel once the window holds two lines', () => {
    expect(plateCoversWindow('plate-hook-2', song, 99.5, 104.2)).toBe(true);
    expect(plateCoversWindow('plate-hook-2', song, 99.5, 114.2)).toBe(false);
    expect(plateCoversWindow('plate-prompt-chatgpt', song, 0, 3)).toBe(false);
  });

  it('plays the outro montage only on a span with no sung line', () => {
    expect(plateCoversWindow('plate-outro', song, 120, 130)).toBe(true);
    expect(plateCoversWindow('plate-outro', song, 99, 105)).toBe(false);
  });

  it('ignores a short bleed from the neighbouring cut', () => {
    const residents = residentLines(song, 79.5, 92.2);
    expect(residents.map((l) => l.i)).toEqual([3, 4]);
    const bleed = residentLines(song, 91.9, 99);
    expect(bleed).toEqual([]);
  });
});
