import { describe, expect, it } from 'vitest';
import { glyphAlphas } from '../shot-glyph';
import type { Line } from '../lyrics';

function line(words: { w: string; start: number; end: number }[], text?: string): Line {
  return {
    i: 0,
    text: text ?? words.map((w) => w.w).join(' '),
    start: words[0]?.start ?? 0,
    end: words[words.length - 1]?.end ?? 0,
    words: words.map((w, index) => ({ ...w, line: 0, index, gi: index })),
  };
}

describe('glyphAlphas', () => {
  it('fills the last glyph of a word at word.end and not before', () => {
    const row = line([{ w: 'ab', start: 0, end: 2 }]);
    expect(glyphAlphas(row, 0)).toEqual([0, 0]);
    expect(glyphAlphas(row, 1)[1]).toBe(0);
    expect(glyphAlphas(row, 2)).toEqual([1, 1]);
  });

  it('draws nothing when the line has no word times', () => {
    expect(glyphAlphas({ i: 0, text: 'hi', start: 0, end: 1, words: [] }, 0.5)).toEqual([]);
  });
});
