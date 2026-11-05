import { describe, it, expect } from 'vitest';
import { clamp, lerp, smoothstep, ease, invLerp, remap } from '../util';

describe('engine/util mathematical utilities', () => {
  it('clamp should clamp values within [min, max]', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('lerp should interpolate between a and b correctly', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });

  it('invLerp and remap should map ranges accurately', () => {
    expect(invLerp(0, 100, 50)).toBe(0.5);
    expect(invLerp(10, 20, 15)).toBe(0.5);
    expect(remap(5, 0, 10, 100, 200)).toBe(150);
  });

  it('smoothstep should produce hermite interpolation clamped to [0, 1]', () => {
    expect(smoothstep(0, 1, -0.5)).toBe(0);
    expect(smoothstep(0, 1, 1.5)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
    expect(smoothstep(0, 1, 0.2)).toBeCloseTo(0.104, 3);
  });

  it('easing curves should satisfy boundary conditions f(0)=0 and f(1)=1', () => {
    const eases = [
      ease.linear,
      ease.inQuad, ease.outQuad, ease.inOutQuad,
      ease.inCubic, ease.outCubic, ease.inOutCubic,
      ease.inExpo, ease.outExpo, ease.inOutExpo,
    ];

    for (const fn of eases) {
      expect(fn(0)).toBeCloseTo(0, 4);
      expect(fn(1)).toBeCloseTo(1, 4);
      const mid = fn(0.5);
      expect(mid).toBeGreaterThanOrEqual(0);
      expect(mid).toBeLessThanOrEqual(1);
    }
  });
});
