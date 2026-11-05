import { describe, expect, it } from 'vitest';
import { fitStage2Prompt, fitWindows, seal, type ArrangeShot } from '../shot-program';
import type { Line, Word } from '../lyrics';

const grid = [0, 5.692, 7.51, 9, 10, 12.4, 20, 30];

function word(w: string, start: number, end: number): Word {
  return { w, start, end, line: 0, index: 0, gi: 0 };
}

function lyric(i: number, start: number, end: number, text: string): Line {
  return { i, text, start, end, words: [word(text, start, end)] };
}

function shot(indexes: number[]): ArrangeShot {
  return {
    lineIndexes: indexes,
    instrumental: false,
    style: 'style_cyber_brutalism',
    imagery: 'img_singularity',
    acoustic: 'ac_kick_impact',
    pace: 'medium',
    colorGrade: 'cold-industrial',
    plateSolo: null,
    layers: {
      background: { source: 'reuse', id: 'terrain' },
      imagery: { source: 'omit' },
      accent: { source: 'reuse', id: 'ping-ring' },
      typography: { source: 'reuse', id: 'lyric-line' },
    },
  };
}

describe('fitWindows', () => {
  it('keeps a zero gap on one shot across downbeats 5.692 and 7.51', () => {
    const lines = [lyric(0, 1.407, 5.88, 'a'), lyric(1, 5.88, 7.72, 'b')];
    const fitted = fitWindows([shot([0]), shot([1])], lines, { duration: 30, bpm: 132.007, downbeats: grid });
    seal(fitted.shots, lines, 30);
    const vocal = fitted.shots.filter((s) => !s.instrumental);
    expect(vocal).toHaveLength(1);
    expect(vocal[0]!.lineIndexes).toEqual([0, 1]);
    expect(vocal[0]!.start).toBeLessThanOrEqual(5.88);
    expect(vocal[0]!.end).toBeGreaterThanOrEqual(7.72);
    expect(fitted.shots.every((s) => s.fallback === false)).toBe(true);
    expect(fitted.shots.some((s) => Math.abs(s.start - 7.51) < 1e-6 && s.lineIndexes.includes(1) && !s.lineIndexes.includes(0))).toBe(false);
  });

  it('inserts one terrain shot in a hole left after a long gap', () => {
    const lines = [lyric(0, 10, 12, 'a'), lyric(1, 20, 22, 'b')];
    const fitted = fitWindows([shot([0]), shot([1])], lines, { duration: 40, bpm: 132.007, downbeats: grid });
    seal(fitted.shots, lines, 40);
    const between = fitted.shots.filter((s) => s.start >= 12.4 - 1e-6 && s.end <= 20 + 1e-6 && s.instrumental);
    expect(between).toHaveLength(1);
    expect(between[0]!.background).toBe('terrain');
    expect(fitted.shots.every((s) => s.fallback === false)).toBe(true);
    const first = fitted.shots.find((s) => s.lineIndexes.includes(0))!;
    const second = fitted.shots.find((s) => s.lineIndexes.includes(1))!;
    expect(first.end).toBeLessThanOrEqual(second.start);
    expect(second.start).toBeLessThanOrEqual(20);
    expect(second.end).toBeGreaterThanOrEqual(22);
  });

  it('allows reusing compliant bespoke plugins across all four orthogonal roles', () => {
    const lines = [lyric(0, 1.407, 5.88, 'silicon wafer')];
    const custom: ArrangeShot = {
      ...shot([0]),
      layers: {
        background: { source: 'reuse', id: 'room-terminal' },
        imagery: { source: 'reuse', id: 'hardware-stack' },
        accent: { source: 'reuse', id: 'fuse-spark' },
        typography: { source: 'reuse', id: 'kinetic-press' },
      },
    };
    const fitted = fitWindows([custom], lines, { duration: 10, bpm: 132.007, downbeats: grid });
    expect(fitted.warnings).toEqual([]);
    const vocal = fitted.shots.find((s) => !s.instrumental)!;
    expect(vocal.background).toBe('room-terminal');
    expect(vocal.imagery).toBe('hardware-stack');
    expect(vocal.accent).toBe('fuse-spark');
    expect(vocal.typography).toBe('kinetic-press');
  });
});

describe('fitStage2Prompt', () => {
  it('drops exemplar comments only after the prompt passes 24000 characters', () => {
    const kept = fitStage2Prompt('role=accent', '// note\nfragColor = vec4(col, a);');
    expect(kept).toContain('// note');
    const exemplar = `${'// note\n'.repeat(4000)}fragColor = vec4(col, a);\n`;
    expect(exemplar.length).toBeGreaterThan(24000);
    const dropped = fitStage2Prompt('role=accent', exemplar);
    expect(dropped.includes('// note')).toBe(false);
    expect(dropped).toContain('fragColor = vec4(col, a);');
    expect(() => fitStage2Prompt('x'.repeat(24001), 'fragColor = vec4(col, a);')).toThrow(/prompt_too_long/);
  });
});
