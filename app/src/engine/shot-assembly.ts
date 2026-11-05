// Shot assembly algebra: beat-grid cuts, strict adjacency, layered roles.
// A shot is one time window. Layers inside a shot share that window.
// Neighbouring shots satisfy end[i] === start[i+1]. They do not cross-fade.

export interface ShotSpan {
  start: number;
  end: number;
  /** True when the window was invented because a lyric query missed. Not stretched to the song. */
  fallback: boolean;
}

export interface AssemblyReport {
  shots: number;
  maxGap: number;
  overlaps: number;
  covered: boolean;
}

/** Nearest grid time. Ties resolve toward the later grid point so a cut lands on the downbeat, not before it. */
export function nearestGrid(t: number, grid: number[]): number {
  if (!grid.length) return t;
  let best = grid[0]!;
  let bestD = Math.abs(best - t);
  for (let i = 1; i < grid.length; i++) {
    const g = grid[i]!;
    const d = Math.abs(g - t);
    if (d < bestD - 1e-6 || (Math.abs(d - bestD) <= 1e-6 && g > best)) {
      best = g;
      bestD = d;
    }
  }
  return best;
}

/**
 * Close gaps and overlaps between shots.
 * The cut is the next shot's start (Heaviside handoff).
 * The first shot is pulled to 0 only when it already starts inside one beat.
 * The last shot is pulled to `duration` only when it already ends within two beats of the song,
 * or when it runs past the song. A short fallback window is left alone.
 */
export function enforceAdjacency<T extends ShotSpan>(shots: T[], duration: number, beat = 0.5): T[] {
  if (!shots.length) return shots;
  const s = shots.slice().sort((a, b) => a.start - b.start || a.end - b.end);
  if (s[0]!.start > 0 && s[0]!.start <= beat + 1e-4) s[0]!.start = 0;
  for (let i = 0; i < s.length - 1; i++) {
    const cut = s[i + 1]!.start;
    s[i]!.end = cut > s[i]!.start ? cut : s[i]!.start + 1 / 60;
  }
  const last = s[s.length - 1]!;
  if (duration > 0) {
    if (last.end > duration) last.end = duration;
    else if (!last.fallback && duration - last.end <= beat * 2) last.end = duration;
  }
  if (last.end <= last.start) last.end = last.start + 1 / 60;
  return s;
}

export interface SnapAudio {
  downbeats: number[];
  duration: number;
  bpm?: number;
}

/** Snap each shot start onto the downbeat grid, then derive ends so shots abut and the last ends at the song. */
export function snapTimelineToDownbeats<T extends { start?: number; end?: number; startQuery?: string; endQuery?: string; startBar?: number; endBar?: number }>(
  dsl: T[],
  audio: SnapAudio,
): T[] {
  const grid = audio.downbeats.filter((d) => d >= -1e-3 && d <= audio.duration + 1e-3);
  if (grid.length < 2) return dsl.map((d) => ({ ...d }));
  const copy = dsl.map((d) => ({ ...d }));
  let prevIdx = -1;
  for (const item of copy) {
    const t = typeof item.start === 'number' ? item.start : 0;
    let idx = grid.indexOf(nearestGrid(t, grid));
    if (idx < 0) idx = 0;
    if (idx <= prevIdx) idx = Math.min(grid.length - 1, prevIdx + 1);
    item.start = grid[idx]!;
    prevIdx = idx;
    delete item.startQuery;
    delete item.endQuery;
    delete item.startBar;
    delete item.endBar;
  }
  for (let i = 0; i < copy.length; i++) {
    const next = copy[i + 1];
    copy[i]!.end = next && typeof next.start === 'number' ? next.start : audio.duration;
  }
  const beat = grid.length > 1 ? grid[1]! - grid[0]! : 0.5;
  if (copy[0] && typeof copy[0].start === 'number' && copy[0].start > 0 && copy[0].start <= beat + 1e-4) {
    copy[0].start = 0;
  }
  const last = copy[copy.length - 1];
  if (last && audio.duration > 0) last.end = audio.duration;
  return copy;
}

export function adjacencyReport(dsl: { start?: number; end?: number }[], duration = 0): AssemblyReport {
  const items = dsl
    .filter((d) => typeof d.start === 'number' && typeof d.end === 'number')
    .map((d) => ({ start: d.start as number, end: d.end as number }))
    .sort((a, b) => a.start - b.start);
  let maxGap = 0;
  let overlaps = 0;
  for (let i = 0; i < items.length - 1; i++) {
    const gap = items[i + 1]!.start - items[i]!.end;
    maxGap = Math.max(maxGap, Math.abs(gap));
    if (gap < -1e-4) overlaps++;
  }
  const covered = items.length > 0
    && items[0]!.start <= 1e-3
    && (duration <= 0 || Math.abs(items[items.length - 1]!.end - duration) <= 1e-2)
    && maxGap <= 1e-3
    && overlaps === 0;
  return { shots: items.length, maxGap, overlaps, covered };
}
