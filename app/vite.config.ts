import { defineConfig, type Plugin } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { assembleShots, discardUnreferencedTemps, generateEffects, listPlugins, listTracks, promotePlugin, revertTimeline, runShotProgram, saveLyricsFile, studioSecrets, writeShotLayer } from './studio-server.ts';

function readJson(req: IncomingMessage, res: ServerResponse, maxBytes: number, done: (data: any) => void) {
  let body = '';
  let exceeded = false;
  req.on('data', (chunk) => {
    if (exceeded) return;
    body += chunk;
    if (Buffer.byteLength(body, 'utf8') > maxBytes) {
      exceeded = true;
      res.statusCode = 413;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Payload too large' }));
    }
  });
  req.on('end', () => {
    if (exceeded) return;
    try {
      done(body ? JSON.parse(body) : {});
    } catch (err: any) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function studioApiPlugin(): Plugin {
  const root = import.meta.dirname;
  return {
    name: 'studio-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url === '/api/llm-status' && req.method === 'GET') {
          const sec = studioSecrets(root);
          sendJson(res, 200, { ok: true, configured: !!sec.apiKey, model: sec.model });
          return;
        }

        if (url === '/api/assemble-shot' && req.method === 'POST') {
          readJson(req, res, 256 * 1024, async (data) => {
            try {
              const shots = await assembleShots(root, data);
              sendJson(res, 200, { ok: true, shots });
            } catch (err: any) {
              sendJson(res, 500, { ok: false, error: err.message });
            }
          });
          return;
        }

        if (url === '/api/generate-effect' && req.method === 'POST') {
          readJson(req, res, 256 * 1024, async (data) => {
            try {
              const files = await generateEffects(root, data);
              sendJson(res, 200, {
                ok: true,
                files: files.map((f) => ({ id: f.id, role: f.role, zh: f.zh })),
              });
            } catch (err: any) {
              sendJson(res, 500, { ok: false, error: err.message });
            }
          });
          return;
        }

        if (url === '/api/write-shot-layer' && req.method === 'POST') {
          readJson(req, res, 128 * 1024, async (data) => {
            try {
              const result = await writeShotLayer(root, data);
              sendJson(res, 200, { ok: true, ...result });
            } catch (err: any) {
              sendJson(res, Number(err.status) || 500, { ok: false, error: err.message || String(err) });
            }
          });
          return;
        }

        if (url === '/api/save-lyrics' && req.method === 'POST') {
          readJson(req, res, 2 * 1024 * 1024, (data) => {
            try {
              const track = String(data.track || 'demo');
              const target = saveLyricsFile(root, track, data.lyrics);
              sendJson(res, 200, { ok: true, path: target });
            } catch (err: any) {
              sendJson(res, 400, { ok: false, error: err.message });
            }
          });
          return;
        }

        if (url === '/api/save-timeline' && req.method === 'POST') {
          let body = '';
          let exceeded = false;
          const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2MB 上限

          req.on('data', (chunk) => {
            if (exceeded) return;
            body += chunk;
            if (Buffer.byteLength(body, 'utf8') > MAX_PAYLOAD_BYTES) {
              exceeded = true;
              res.statusCode = 413;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: 'Payload too large (exceeds 2MB limit)' }));
            }
          });

          req.on('end', () => {
            if (exceeded) return;
            try {
              const data = JSON.parse(body);
              const track = String(data.track || 'demo').trim();

              // 安全校验：防止路径穿越攻击，仅允许英文字母、数字、下划线和连字符
              if (!/^[a-zA-Z0-9_-]+$/.test(track)) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: false, error: 'Invalid track name: illegal characters detected' }));
                return;
              }
              if (track === 'default') {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: false, error: 'default 曲目走 makeTimeline()，不写 timeline.json' }));
                return;
              }

              const timeline = data.timeline;
              if (!Array.isArray(timeline)) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: false, error: 'Invalid timeline data: must be an array' }));
                return;
              }

              const tracksDir = path.resolve(import.meta.dirname, `public/tracks/${track}`);
              if (!fs.existsSync(tracksDir)) {
                fs.mkdirSync(tracksDir, { recursive: true });
              }

              const targetPath = path.resolve(tracksDir, 'timeline.json');
              fs.writeFileSync(targetPath, JSON.stringify(timeline, null, 2), 'utf8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, count: timeline.length, path: targetPath }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: err.message }));
            }
          });
          return;
        }

        if (url === '/api/shot-program' && req.method === 'POST') {
          readJson(req, res, 64 * 1024, async (data) => {
            const track = String(data.track || 'demo');
            if (track === 'default') {
              sendJson(res, 400, { ok: false, error: 'default 曲目走 makeTimeline()，不写 timeline.json' });
              return;
            }
            const ac = new AbortController();
            const onClose = () => ac.abort();
            req.on('close', onClose);
            let started = false;
            try {
              await runShotProgram(root, track, ac.signal, (event) => {
                if (!started) {
                  started = true;
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
                }
                res.write(`${JSON.stringify(event)}\n`);
              });
              if (!started) sendJson(res, 500, { ok: false, error: '分镜没有输出' });
              else res.end();
            } catch (err: any) {
              if (!started) {
                sendJson(res, Number(err.status) || 500, { ok: false, error: err.message || String(err) });
              } else if (!res.writableEnded) {
                res.write(`${JSON.stringify({ event: 'error', error: err.message || String(err) })}\n`);
                res.end();
              }
            } finally {
              req.off('close', onClose);
            }
          });
          return;
        }

        if (url === '/api/promote-plugin' && req.method === 'POST') {
          readJson(req, res, 64 * 1024, (data) => {
            try {
              const result = promotePlugin(root, data);
              sendJson(res, 200, { ok: true, ...result });
            } catch (err: any) {
              sendJson(res, Number(err.status) || 500, { ok: false, error: err.message || String(err) });
            }
          });
          return;
        }

        if (url === '/api/discard-unreferenced-temps' && req.method === 'POST') {
          try {
            const removed = discardUnreferencedTemps(root);
            sendJson(res, 200, { ok: true, removed });
          } catch (err: any) {
            sendJson(res, 500, { ok: false, error: err.message || String(err) });
          }
          return;
        }

        if (url === '/api/revert-timeline' && req.method === 'POST') {
          readJson(req, res, 64 * 1024, (data) => {
            const track = String(data.track || 'demo');
            if (track === 'default') {
              sendJson(res, 400, { ok: false, error: 'default 曲目走 makeTimeline()，不写 timeline.json' });
              return;
            }
            try {
              revertTimeline(root, track);
              sendJson(res, 200, { ok: true });
            } catch (err: any) {
              sendJson(res, Number(err.status) || 500, { ok: false, error: err.message || String(err) });
            }
          });
          return;
        }

        if (url === '/api/plugins' && req.method === 'GET') {
          try {
            const plugins = listPlugins(path.resolve(root, 'src/plugins'));
            sendJson(res, 200, { ok: true, plugins });
          } catch (err: any) {
            sendJson(res, 500, { ok: false, error: err.message });
          }
          return;
        }

        if (url === '/api/tracks' && req.method === 'GET') {
          try {
            const tracks = listTracks(root);
            sendJson(res, 200, { ok: true, tracks });
          } catch (err: any) {
            sendJson(res, 500, { ok: false, error: err.message });
          }
          return;
        }

        next();
      });
    },
  };
}

// The repo root holds audio/ and data/; serve them next to the app.
export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [studioApiPlugin()],
  // PDOOM_NO_HMR=1: no live reload (export renders must not reload mid-run when a file changes)
  server: {
    port: 5173,
    strictPort: false,
    hmr: process.env.PDOOM_NO_HMR ? false : undefined,
    fs: { allow: [path.resolve(import.meta.dirname, '..')] },
  },
  resolve: { alias: { '@root': path.resolve(import.meta.dirname, '..') } },
  build: {
    target: 'esnext',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        studio: path.resolve(import.meta.dirname, 'studio.html'),
      },
    },
  },
});
