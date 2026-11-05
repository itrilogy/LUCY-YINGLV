import { describe, it, expect } from 'vitest';
import { parseTimelineDSL, type TimelineDSLItem } from '../timeline-loader';
import type { Lyrics } from '../lyrics';
import type { AudioData } from '../audio';

describe('engine/timeline-loader parseTimelineDSL', () => {
  const dummyLyrics = {
    get: (q: string) => {
      if (q === 'valid') {
        return { start: 10, end: 15, words: [{ start: 10, end: 12, word: 'hello' }] };
      }
      throw new Error(`Lyrics query not found: ${q}`);
    },
    lineAt: () => null,
    lastLine: () => null,
  } as unknown as Lyrics;

  const dummyAudio = {
    duration: 120,
    downbeats: [0, 2, 4, 6],
    timeOfBeat: (b: number) => b * 0.5,
    beatAt: (t: number) => t * 2,
    sample: () => ({ kick: 0, snare: 0, hat: 0, rms: 0, low: 0, high: 0, bass: 0 }),
  } as unknown as AudioData;

  it('should parse single scene timeline entries correctly', () => {
    const dsl: TimelineDSLItem[] = [
      { id: 'cut_01', plugin: 'terrain', start: 0, end: 10 },
      { id: 'cut_02', plugin: 'glitch', start: 10, end: 20 },
    ];

    const entries = parseTimelineDSL(dsl, dummyLyrics, dummyAudio);
    expect(entries.length).toBe(2);
    expect(entries[0]!.module).toBe('terrain');
    expect(entries[0]!.id).toBe('cut_01');
    expect(entries[0]!.start).toBe(0);
    expect(entries[0]!.end).toBe(10);
    expect(entries[1]!.id).toBe('cut_02');
    expect(entries[1]!.start).toBe(10);
    expect(entries[1]!.end).toBe(20);
  });

  it('should split layered lens into separate entries for each active layer', () => {
    const dsl: TimelineDSLItem[] = [
      {
        id: 'layered_lens',
        start: 5,
        end: 15,
        background: 'terrain',
        imagery: 'hardware-stack',
        accent: 'fuse-spark',
        typography: 'cyber-prompt',
        colorGrade: 'cold-industrial',
      },
    ];

    const entries = parseTimelineDSL(dsl, dummyLyrics, dummyAudio);
    expect(entries.length).toBe(4);

    const bg = entries.find((e) => e.layerIndex === 0);
    const imagery = entries.find((e) => e.layerIndex === 1);
    const accent = entries.find((e) => e.layerIndex === 2);
    const typo = entries.find((e) => e.layerIndex === 3);

    expect(bg).toBeDefined();
    expect(imagery).toBeDefined();
    expect(accent).toBeDefined();
    expect(typo).toBeDefined();

    expect(bg!.colorGrade).toBe('cold-industrial');
    expect(accent!.blend?.mode).toBe('screen');
    expect(bg!.module).toBe('terrain');
    expect(typo!.module).toBe('cyber-prompt');
    expect(bg!.suppressLyrics).toBe(true);
    expect(imagery!.suppressLyrics).toBe(true);
    expect(accent!.suppressLyrics).toBe(true);
    expect(typo!.suppressLyrics).toBe(false);
    expect(bg!.end).toBe(typo!.end);
  });

  it('closes a numeric gap and leaves a short last shot unstretched', () => {
    const entries = parseTimelineDSL(
      [
        { id: 'a', plugin: 'terrain', start: 0, end: 10 },
        { id: 'b', plugin: 'glitch', start: 12, end: 18 },
      ],
      dummyLyrics,
      dummyAudio,
    );
    expect(entries.map((e) => [e.start, e.end])).toEqual([
      [0, 12],
      [12, 18],
    ]);
  });

  it('skips a shot whose lyric anchors both miss and does not move the next cut', () => {
    const dsl: TimelineDSLItem[] = [
      { id: 'cut_invalid', plugin: 'terrain', startQuery: 'non_existent_lyric' },
      { id: 'cut_next', plugin: 'glitch', start: 10, end: 20 },
    ];

    const entries = parseTimelineDSL(dsl, dummyLyrics, dummyAudio);
    expect(entries.map((e) => e.id)).toEqual(['cut_next']);
    expect(entries[0]!.start).toBe(10);
    expect(entries[0]!.end).toBe(20);
  });

  it('keeps a four-second window when the start is known and the end is not', () => {
    const entries = parseTimelineDSL(
      [{ id: 'cut_open', plugin: 'terrain', start: 30 }],
      dummyLyrics,
      dummyAudio,
    );
    expect(entries.length).toBe(1);
    expect(entries[0]!.start).toBe(30);
    expect(entries[0]!.end).toBe(34);
  });

  it('wraps a sung solo that declares ownsLyrics false and leaves a plate solo alone', () => {
    const sung = {
      get: () => { throw new Error('no query'); },
      lineAt: () => null,
      lastLine: () => null,
      linesIn: () => [{ i: 0, text: 'hello', start: 1, end: 4, words: [] }],
    } as unknown as Lyrics;
    const wrapped = parseTimelineDSL(
      [{ id: 'solo', plugin: 'ping-ring', start: 0, end: 10, params: { ownsLyrics: false, layerRole: 'accent' } }],
      sung,
      dummyAudio,
    );
    expect(wrapped.map((e) => e.module).sort()).toEqual(['lyric-line', 'ping-ring']);
    expect(wrapped.find((e) => e.module === 'ping-ring')!.suppressLyrics).toBe(true);
    expect(wrapped.find((e) => e.module === 'lyric-line')!.suppressLyrics).toBe(false);
    expect(wrapped.every((e) => e.start === 0 && e.end === 10)).toBe(true);

    const plate = parseTimelineDSL(
      [{ id: 'film', plugin: 'plate-open', start: 0, end: 10, params: { ownsLyrics: false } }],
      sung,
      dummyAudio,
    );
    expect(plate.map((e) => e.module)).toEqual(['plate-open']);
  });
});
