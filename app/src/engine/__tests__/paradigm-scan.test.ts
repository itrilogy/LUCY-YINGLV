import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const plugins = path.resolve(import.meta.dirname, '../../plugins');

function source(name: string) {
  return fs.readFileSync(path.join(plugins, name), 'utf8');
}

describe('old plugin alignment', () => {
  it('keeps the thin ring on coverage alpha', () => {
    const code = source('ping-ring.ts');
    expect(code).not.toContain('vec4(col, 1.0)');
    expect(code).toContain('clearRT(this.ctx.renderer, out, [0, 0, 0], 0)');
    expect(code).toContain('fragColor = vec4(col, a)');
  });

  it('paints typography with paintShotLine and no shot-progress clock', () => {
    const code = source('typography.ts');
    expect(code).toContain('paintShotLine');
    expect(code).not.toMatch(/\bfillText\b|\bstrokeText\b|\bf\.p\b/);
    expect(code).toContain('if (f.suppressLyrics) return');
  });

  it('gates kinetic press glyphs and drops the kick envelope from shake', () => {
    const press = source('kinetic-press.ts');
    expect(press).toContain('!f.suppressLyrics');
    expect(press).not.toContain('STAGE:');
    expect(press).not.toContain('* 8 * bass');
    const hook = source('kinetic-hook.ts');
    expect(hook).not.toContain('* 8 * kick');
    expect(hook).toContain('!f.suppressLyrics');
  });

  it('forbids non-deterministic wall-clock and Math.random across all plugins', () => {
    const files = fs.readdirSync(plugins).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      const code = source(file);
      expect(code, `${file} must not use Math.random / Date / performance.now`).not.toMatch(
        /\bMath\.random\s*\(|\bDate\.now\s*\(|\bnew\s+Date\s*\(|\bperformance\.now\s*\(/,
      );
    }
  });

  it('guards every custom fillText lyric renderer with f.suppressLyrics', () => {
    const customLyricPlugins = [
      'acoustic-loss.ts',
      'matrix-loom.ts',
      'spacetime-lens.ts',
      'cyber-prompt.ts',
      'kinetic-hook.ts',
      'kinetic-press.ts',
      'typography.ts',
      'lyric-line.ts',
    ];
    for (const file of customLyricPlugins) {
      const code = source(file);
      expect(code, `${file} must respect f.suppressLyrics`).toContain('f.suppressLyrics');
    }
  });
});
