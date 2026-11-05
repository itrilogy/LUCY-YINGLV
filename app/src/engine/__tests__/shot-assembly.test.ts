import { describe, it, expect } from 'vitest';
import { adjacencyReport, enforceAdjacency, nearestGrid, snapTimelineToDownbeats } from '../shot-assembly';

describe('shot assembly', () => {
  it('picks the later grid point on a tie', () => {
    expect(nearestGrid(1, [0, 2])).toBe(2);
    expect(nearestGrid(0.4, [0, 2])).toBe(0);
  });

  it('closes a gap without stretching a short timeline to the song', () => {
    const shots = enforceAdjacency(
      [
        { start: 0, end: 10, fallback: false },
        { start: 12, end: 18, fallback: false },
      ],
      120,
      0.5,
    );
    expect(shots[0]!.end).toBe(12);
    expect(shots[1]!.end).toBe(18);
    expect(adjacencyReport(shots, 120).overlaps).toBe(0);
    expect(adjacencyReport(shots, 120).maxGap).toBe(0);
  });

  it('cuts an overlap on the later shot start', () => {
    const shots = enforceAdjacency(
      [
        { start: 0, end: 15, fallback: false },
        { start: 10, end: 20, fallback: false },
      ],
      30,
      0.5,
    );
    expect(shots[0]!.end).toBe(10);
    expect(shots[1]!.start).toBe(10);
  });

  it('snaps starts onto downbeats and abuts through the song', () => {
    const out = snapTimelineToDownbeats(
      [
        { id: 'a', start: 0.2, end: 3.2, startQuery: 'keep-me-not' },
        { id: 'b', start: 3.1, end: 7 },
      ],
      { downbeats: [0, 2, 4, 6, 8], duration: 8, bpm: 120 },
    );
    expect(out[0]!.start).toBe(0);
    expect(out[0]!.end).toBe(out[1]!.start);
    expect(out[1]!.end).toBe(8);
    expect(out[0]!.startQuery).toBeUndefined();
    expect(adjacencyReport(out, 8).covered).toBe(true);
  });
});
