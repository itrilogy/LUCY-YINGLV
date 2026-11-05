// Entry: preview player (default) or export mode (?export=1, driven by scripts/render.ts).
import { Engine, type AdaptiveSampling } from './engine/engine';
import { PW, PH, SCALE } from './engine/gl';
import { makeTimeline } from './timeline';
import './studio.css';

import { errorCollector } from './engine/error-collector';

export function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const params = new URLSearchParams(location.search);
const EXPORT = params.has('export');
const ONLY = params.get('only'); // comma-separated scene ids to load (faster stills)
const FROM = params.get('t') ? parseFloat(params.get('t')!) : null;
const PREVIEW = params.get('preview'); // 'full' | 'effect' | null
const EFFECT = params.get('effect');
const LOOP_PARAM = params.has('loop');
const MODE = params.get('mode'); // 'studio' | 'player'

const canvas = document.getElementById('c') as HTMLCanvasElement;
// physical size: 1920x1080 times ?scale= (the page CSS keeps showing it at 1920x1080)
canvas.width = PW;
canvas.height = PH;

const engine = new Engine(canvas, makeTimeline);

declare global {
  interface Window {
    __pdoom: any;
    __pdoom_seek?: (t: number) => void;
    __pdoom_loop?: (start: number, end: number) => void;
    __pdoom_play?: () => void;
  }
}

let TIMELINE: typeof engine.timeline = [];
let TRACK = params.get('track') || 'demo';
let TRACK_BASE = `tracks/${TRACK}`;
let renderMarksFn: (() => void) | null = null;

async function boot() {
  if (MODE === 'studio') {
    location.replace(`/studio.html?track=${encodeURIComponent(TRACK)}`);
    return;
  }

  const onlySet = ONLY ? new Set(ONLY.split(',')) : null;
  let timelineDSL: any[] | undefined = undefined;

  // 1. 如果是独立单一视效沙箱模式 (Single Effect Sandbox)
  if (PREVIEW === 'effect' && EFFECT) {
    timelineDSL = [
      {
        id: `sandbox_${EFFECT}`,
        plugin: EFFECT,
        start: 0,
        end: 156.7,
        params: {},
      },
    ];
  } else {
    // 2. 检查是否有本地工作台暂存的自定义编排
    const cachedCustom = localStorage.getItem(`pdoom_custom_timeline:${TRACK}`);
    if (cachedCustom && (PREVIEW === 'full' || params.has('custom'))) {
      try {
        timelineDSL = JSON.parse(cachedCustom);
      } catch (err: any) {
        errorCollector.report({
          source: 'workbench',
          severity: 'warning',
          context: 'localStorage',
          message: `Failed to parse cached custom timeline: ${err.message}`,
        });
      }
    }

    // 3. 否则读取服务端 tracks/{track}/timeline.json
    if (!timelineDSL && TRACK_BASE) {
      try {
        const r = await fetch(`${TRACK_BASE}/timeline.json`);
        if (r.ok) {
          timelineDSL = await r.json();
        } else {
          errorCollector.report({
            source: 'timeline',
            severity: 'info',
            context: 'fetch',
            message: `No server timeline found at ${TRACK_BASE}/timeline.json (status: ${r.status})`,
          });
        }
      } catch (err: any) {
        errorCollector.report({
          source: 'timeline',
          severity: 'warning',
          context: 'fetch',
          message: `Error fetching timeline from ${TRACK_BASE}/timeline.json: ${err.message}`,
        });
      }
    }
  }

  await engine.init({
    only: onlySet ? (e) => onlySet.has(e.id) : undefined,
    audioUrl: `${TRACK_BASE}/audio.json`,
    lyricsUrl: `${TRACK_BASE}/lyrics.json`,
    timelineDSL,
  });

  TIMELINE = engine.timeline;

  if (EXPORT) {
    setupExport();
  } else {
    setupPlayer();
    setupPreviewBanner();
  }
}

// ------------------------------------------------------------------ 预览模式轻量顶栏 (XSS 安全加固)
function setupPreviewBanner() {
  const banner = document.createElement('div');
  banner.className = 'studio-preview-top-banner';

  const safeEffect = escapeHtml(EFFECT);
  const safeTrack = escapeHtml(TRACK);
  const safeTrackUri = encodeURIComponent(TRACK);

  if (PREVIEW === 'effect') {
    banner.innerHTML = `
      <div class="banner-left">
        <img class="banner-brand-icon" src="/favicon.svg" alt="应律 · YingLv" />
        <span class="badge live">应律 · 视效沙箱</span>
        <span class="title">正在测试效果器: <strong>${safeEffect}</strong></span>
        <span class="meta">1080p60 确定性渲染 · 循声应律，逐拍成画</span>
      </div>
      <div class="banner-right">
        <button class="banner-btn" onclick="window.close()">✕ 关闭标签页</button>
        <a class="banner-btn primary" href="/studio.html?track=${safeTrackUri}" target="_blank">打开应律工作台 ↗</a>
      </div>
    `;
  } else {
    banner.innerHTML = `
      <div class="banner-left">
        <img class="banner-brand-icon" src="/favicon.svg" alt="应律 · YingLv" />
        <span class="badge live">应律 · 全屏预览</span>
        <span class="title">曲目: <strong>${safeTrack}</strong> (${TIMELINE.length} 幕无缝接壤)</span>
        <span class="meta">空格键 播放/暂停 · 方向键 快进/快退</span>
      </div>
      <div class="banner-right">
        <button class="banner-btn" onclick="window.close()">✕ 关闭标签页</button>
        <a class="banner-btn primary" href="/studio.html?track=${safeTrackUri}" target="_blank">返回应律工作台 ↗</a>
      </div>
    `;
  }
  document.body.appendChild(banner);
}

// ------------------------------------------------------------------ export API
function setupExport() {
  document.body.classList.add('export');
  window.__pdoom = {
    engine,
    duration: engine.duration,
    errors: engine.errors,
    scale: SCALE,
    width: PW,
    height: PH,
    timeline: TIMELINE.map(({ id, start, end }) => ({ id, start, end })),
    still(t: number, samples: number | AdaptiveSampling = 1, shutter = 0.5) {
      return engine.render(t, 1 / 60, true, samples, shutter);
    },
    async png() {
      const px = await engine.readPixelsAsync(), row = PW * 4;
      const img = new ImageData(PW, PH);
      for (let y = 0; y < PH; y++) img.data.set(px.subarray((PH - 1 - y) * row, (PH - y) * row), y * row);
      const oc = new OffscreenCanvas(PW, PH);
      oc.getContext('2d')!.putImageData(img, 0, 0);
      const b = new Uint8Array(await (await oc.convertToBlob({ type: 'image/png' })).arrayBuffer());
      let s = '';
      for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
      return btoa(s);
    },
    async stream(opts: { from: number; to: number; fps: number; ws: string; samples?: number | AdaptiveSampling; shutter?: number; inflight?: number }) {
      const ws = new WebSocket(opts.ws);
      ws.binaryType = 'arraybuffer';
      let acked = 0;
      ws.onmessage = (e) => { if (typeof e.data === 'string') acked = Math.max(acked, +e.data || 0); };
      await new Promise<void>((res, rej) => { ws.onopen = () => res(); ws.onerror = (e) => rej(e); });
      const dt = 1 / opts.fps;
      const n0 = Math.round(opts.from * opts.fps), n1 = Math.round(opts.to * opts.fps);
      const buf = new Uint8Array(PW * PH * 4);
      const S = opts.samples ?? 1, SH = opts.shutter ?? 0.5;
      if (n0 > 0) engine.render((n0 - 1) * dt, dt, false, typeof S === 'number' ? S : 1, SH);
      const used: Record<number, number> = {};
      for (let n = n0; n < n1; n++) {
        const k = engine.render(n * dt, dt, false, S, SH);
        used[k] = (used[k] ?? 0) + 1;
        await engine.readPixelsAsync(buf);
        if (opts.inflight) while (n - n0 - acked >= opts.inflight) await new Promise((r) => setTimeout(r, 2));
        while (ws.bufferedAmount > 64 * 1024 * 1024) await new Promise((r) => setTimeout(r, 2));
        ws.send(buf);
        if (n % 30 === 0) await new Promise((r) => setTimeout(r, 0));
      }
      while (ws.bufferedAmount > 0) await new Promise((r) => setTimeout(r, 5));
      ws.close();
      return used;
    },
  };
  window.__pdoom.ready = true;
}

function setupPlayer() {
  const audioSrc = TRACK_BASE ? `${TRACK_BASE}/audio.mp3` : 'audio/pdoom.mp3';
  const audio = new Audio(audioSrc);
  audio.preload = 'auto';
  const ui = document.getElementById('ui')!;
  const scrub = document.getElementById('scrub') as HTMLInputElement;
  const info = document.getElementById('info')!;
  const marks = document.getElementById('marks')!;
  const errs = document.getElementById('errs')!;
  scrub.max = String(engine.duration);
  scrub.step = '0.001';
  if (engine.errors.length) { errs.textContent = engine.errors.join('\n\n'); errs.style.display = 'block'; }

  let t = FROM ?? 0;
  let playing = false;
  let loop: [number, number] | null = null;
  let lastAudioT = 0, lastPerf = 0;

  const seek = (x: number) => {
    t = Math.max(0, Math.min(engine.duration - 0.001, x));
    audio.currentTime = t;
  };

  const renderMarks = () => {
    marks.innerHTML = '';
    for (const e of TIMELINE) {
      const m = document.createElement('div');
      m.className = 'mark';
      m.style.left = `${(e.start / engine.duration) * 100}%`;
      m.style.width = `${((e.end - e.start) / engine.duration) * 100}%`;
      m.title = `${e.id} ${e.start.toFixed(2)}–${e.end.toFixed(2)}`;
      m.textContent = e.id.replace(/^entry_\d+_/, '');
      m.onclick = () => seek(e.start);
      marks.appendChild(m);
    }
  };
  renderMarksFn = renderMarks;
  renderMarks();

  // 若开启单句/单切片 loop
  if (LOOP_PARAM && FROM !== null) {
    const matchedCut = TIMELINE.find(x => FROM >= x.start && FROM < x.end);
    if (matchedCut) {
      loop = [matchedCut.start, matchedCut.end];
    }
  }

  seek(t);

  const toggle = () => {
    playing = !playing;
    if (playing) {
      audio.currentTime = t;
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  };

  canvas.onclick = toggle;
  scrub.oninput = () => seek(parseFloat(scrub.value));

  window.__pdoom_seek = seek;
  window.__pdoom_loop = (start: number, end: number) => { loop = [start, end]; seek(start); };
  window.__pdoom_play = () => { if (!playing) toggle(); };

  window.addEventListener('keydown', (ev) => {
    if (ev.key === ' ') { ev.preventDefault(); toggle(); }
    if (ev.key === 'ArrowRight') seek(t + (ev.shiftKey ? 5 : 1));
    if (ev.key === 'ArrowLeft') seek(t - (ev.shiftKey ? 5 : 1));
    if (ev.key === '.') seek(t + 1 / 60);
    if (ev.key === ',') seek(t - 1 / 60);
    if (ev.key === 'l') {
      const e = TIMELINE.find((x) => t >= x.start && t < x.end);
      loop = loop ? null : e ? [e.start, e.end] : null;
    }
    if (ev.key === 'h') ui.classList.toggle('hidden');
    if (ev.key === ']') { const e = TIMELINE.find((x) => x.start > t + 0.01); if (e) seek(e.start); }
    if (ev.key === '[') { const es = TIMELINE.filter((x) => x.start < t - 0.3); const e = es[es.length - 1]; if (e) seek(e.start); }
  });

  let frames = 0, fpsT = performance.now(), fps = 0;
  const tick = () => {
    if (playing) {
      const now = performance.now();
      if (audio.currentTime !== lastAudioT) { lastAudioT = audio.currentTime; lastPerf = now; }
      t = lastAudioT + (audio.paused ? 0 : (now - lastPerf) / 1000);
      if (loop && t >= loop[1]) seek(loop[0]);
      if (audio.ended) playing = false;
    }
    engine.render(t, 1 / 60);
    scrub.value = String(t);
    frames++;
    const now = performance.now();
    if (now - fpsT > 500) { fps = (frames * 1000) / (now - fpsT); frames = 0; fpsT = now; }
    const e = TIMELINE.find((x) => t >= x.start && t < x.end);
    const l = engine.lyrics.lineAt(t);
    info.textContent = `${t.toFixed(2)}s  beat ${engine.audio.beatAt(t).toFixed(2)}  bar ${engine.audio.barAt(t).toFixed(2)}  [${e?.id ?? '—'}]  ${fps.toFixed(0)}fps   ${l ? '“' + l.text + '”' : ''}${loop ? '  LOOP' : ''}`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // Vite HMR: re-instantiate scenes or plugins whose module changed
  if (import.meta.hot) {
    import.meta.hot.on('vite:afterUpdate', (payload: any) => {
      for (const u of payload.updates ?? []) {
        const m = /(?:scenes|plugins)\/([\w-]+)\.ts/.exec(u.path ?? '');
        if (m) {
          for (const e of TIMELINE) {
            if (e.id === m[1] || e.module === m[1] || (e as any).file === m[1]) {
              void engine.reload(e.id);
            }
          }
        }
      }
    });
  }
}

boot().catch((e) => {
  const errText = String(e?.stack ?? e);
  errorCollector.report({
    source: 'engine',
    severity: 'error',
    context: 'boot',
    message: String(e?.message ?? e),
    stack: e?.stack,
  });

  const pre = document.createElement('pre');
  pre.style.cssText = 'color:#f55;position:fixed;top:0;left:0;padding:16px;background:rgba(0,0,0,0.9);z-index:999999;font-family:monospace;white-space:pre-wrap;';
  pre.textContent = errText;
  document.body.appendChild(pre);

  window.__pdoom = { error: errText };
});
