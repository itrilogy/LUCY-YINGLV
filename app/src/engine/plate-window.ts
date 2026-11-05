// Whether a film plate's authored lyric set is exactly the shot window.
// A plate that only knows its own lines cannot carousel a foreign sentence.
import type { Line, Lyrics } from './lyrics.ts';

/** Lines the shot actually owns. A few tenths of bleed from the next cut does not count. */
export function residentLines(lyrics: Lyrics, start: number, end: number): Line[] {
  return lyrics.linesIn(start, end).filter((l) => {
    const overlap = Math.min(l.end, end) - Math.max(l.start, start);
    const dur = Math.max(1e-3, l.end - l.start);
    return overlap >= 0.35 && overlap >= 0.3 * dur;
  });
}

/** Plates whose scene reads one line from the window and never advances. */
const SINGLE_LINE = new Set([
  'plate-hook-1', 'plate-hook-2', 'plate-hook-3', 'plate-hook-4',
  'plate-prompt-chatgpt', 'plate-prompt-sydney', 'plate-prompt-gato',
]);

/**
 * Phrases that `lyrics.get` locks inside each multi-line plate.
 * The film cut that contains exactly these lines still plays the original scene.
 */
const ANCHORS: Record<string, string[]> = {
  'plate-open': ['sparks of AGI', 'circuits make me', 'no surprise'],
  'plate-loss': ['sudden drop', 'your servant'],
  'plate-room': ['future goes', 'Chinese room', 'bag of shrooms'],
  'plate-shoggoth': ['shoggoth', 'shinigami'],
  'plate-spacetime': ['stable training', 'singularity', 'optimizing', 'atoms'],
  'plate-ascent': ['basilisk', 'to the moon', 'Omega', 'FLOPs'],
  'plate-bureau': ['safe enough', 'Forward MLP', 'Neumann'],
  'plate-leftturn': ['Sharp left', 'single CDR'],
  'plate-paperclips': ['paperclips', 'Killswitch', 'nowhere left'],
  'plate-fuse': ['lit the fuse', 'Orthogonality'],
  'plate-stack': ['transformers all the way', 'disobey'],
  'plate-dense': ['Post-Chinchilla', 'safety fence', 'Hundred thousand', 'RLHF'],
  'plate-loom': ['foretold by Loom', 'masked pre-training', 'recursive self-upgrade'],
  'plate-ilya': ['What did Ilya', 'all for show'],
};

export function plateCoversWindow(moduleName: string, lyrics: Lyrics, start: number, end: number): boolean {
  const residents = residentLines(lyrics, start, end);
  // The ending montage has no line of its own. Any sung line in the window needs a carousel instead.
  if (moduleName === 'plate-outro') return residents.length === 0;
  if (SINGLE_LINE.has(moduleName)) return residents.length === 1;
  const anchors = ANCHORS[moduleName];
  if (!anchors) return false;
  const found = anchors.map((phrase) => lyrics.find(phrase)[0]).filter((l): l is Line => !!l);
  if (found.length !== anchors.length) return false;
  if (residents.length !== found.length) return false;
  const ids = new Set(found.map((l) => l.i));
  return residents.every((l) => ids.has(l.i));
}
