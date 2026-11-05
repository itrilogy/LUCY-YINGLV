import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractJsonObject, extractPluginSource, pluginSkeleton, readGeneratedHeader, stamp } from '../effect-source';
import { listTracks } from '../../../studio-server.ts';

describe('effect source extraction', () => {
  it('unwraps a typescript fence and rejects Math.random', () => {
    const code = extractPluginSource('```typescript\nexport default class A extends Scene {}\n```');
    expect(code).toContain('export default class A');
    expect(() => extractPluginSource('export default class A extends Scene { x(){ return Math.random(); } }')).toThrow(/随机数/);
  });

  it('reads the generated header and a fenced json object', () => {
    expect(readGeneratedHeader('// @pdoom-generated role=accent zh=光环\nexport default class X {}')?.role).toBe('accent');
    const next = readGeneratedHeader('// @pdoom-generated role=accent zh=冷色细环 owns=0 status=temporary\n');
    expect(next?.owns).toBe(false);
    expect(next?.status).toBe('temporary');
    expect(next?.zh).toBe('冷色细环');
    expect(extractJsonObject('```json\n{"ok":true}\n```')).toEqual({ ok: true });
  });

  it('stamps a typography skeleton that has no FSPass', () => {
    const code = pluginSkeleton('LyricLine', 'typography');
    expect(code.includes('FSPass')).toBe(false);
    const stamped = stamp('typography', '一行词', code, 'LyricLine');
    expect(stamped.startsWith('// @pdoom-generated')).toBe(true);
    expect(stamped.includes('paintShotLine')).toBe(true);
  });

  it('lists valid track packs under public/tracks with demo prioritized', () => {
    const appRoot = path.resolve(import.meta.dirname, '../../..');
    const tracks = listTracks(appRoot);
    expect(tracks.map((t) => t.id)).toContain('demo');
    expect(tracks.map((t) => t.id)).toContain('default');
    expect(tracks[0]?.id).toBe('demo');
  });
});
