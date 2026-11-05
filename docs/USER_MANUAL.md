# 应律 · YingLv (`BeatStream` / `itrilogy/LUCY-YINGLV`) User & Engineering Manual

> **Product**: 应律 · YingLv (`BeatStream`) · **Matrix**: 知行·五动 · **Slogan**: 循声应律，逐拍成画 (*Following the beat, shaping sound into vision.*)

This manual covers the **应律 · YingLv** multi-track studio workbench (`studio.html`), the 5-layer orthogonal lens composition engine, the two-stage AI shot program, the multi-track builder CLI (`analysis/build_track.py`), and offline video export (`app/scripts/render.ts`).

---

## 1. Quick Start

```bash
cd app
bun install
bun run dev
```

Open in Google Chrome:
- **LUXI V-LOOM Studio Workbench**: `http://localhost:5173/studio.html?track=demo` (or `http://localhost:5173/?mode=studio`)
- **Full-Screen Preview Player (Custom Track)**: `http://localhost:5173/?track=demo&preview=full`
- **Original Bespoke Film (`makeTimeline()`)**: `http://localhost:5173/?track=default`
- **Single-Plugin Isolated Sandbox**: `http://localhost:5173/?track=demo&preview=effect&effect=hardware-stack`

### Player Keyboard Shortcuts
| Key | Action |
| :---: | :--- |
| `Space` / Click | Play / Pause |
| `←` / `→` | Seek ±1 s (`Shift` for ±5 s) |
| `,` / `.` | Step ±1 frame (`1/60` s) |
| `[` / `]` | Jump to previous / next shot boundary |
| `l` | Loop current shot window |
| `h` | Hide / show bottom player HUD |

---

## 2. Building a New Track Pack (`analysis/build_track.py`)

Every track pack lives under `app/public/tracks/<track>/` and consists of three synchronized assets:
1. `audio.mp3` & `audio.json` (BPM, beats, downbeats, sections, 100 fps envelopes, kick/snare/hat/vocal onsets)
2. `lyrics.json` (line and word-level timings with syllable splits `syl` and confidence scores `conf`)
3. `timeline.json` (beat-snapped, strictly adjacent shot timeline DSL)

### Fast Mode (Zero 4GB Model Weights Required)
Supports `.lrc`, `.txt`, `.js`, and `.json` lyrics files:
```bash
python3 analysis/build_track.py \
  --track my-song \
  --audio /path/to/song.mp3 \
  --lyrics /path/to/song.lrc \
  --bpm 128 \
  --mode fast
```

### Full DSP / CTC Mode (With `uv` Environment)
```bash
cd analysis
uv run python build_track.py \
  --track my-song \
  --audio /path/to/song.mp3 \
  --lyrics /path/to/song.txt \
  --bpm-range 90,150 \
  --mode auto
```

Once built, refresh `http://localhost:5173/studio.html` and select `🎵 曲目: my-song` from the top-right track selector.

---

## 3. Studio Workbench Guide (`studio.html`)

### 3.1 Five-Layer Orthogonal Shot Architecture
Each shot window `[start, end]` in `timeline.json` can either mount a solo plate (`plugin: "plate-open"`) or compose up to 4 orthogonal visual passes plus a color grade profile:
- **Layer 0 — `background`**: Full-frame opaque pass (`clearRT(..., 1)`), e.g. `terrain`, `tunnel`, `room-terminal`.
- **Layer 1 — `imagery`**: Primary subject motif (luma-keyed via `keyPass`, blended with `normal`), e.g. `hardware-stack`, `spacetime-lens`, `cyber-shoggoth`, `dense-cluster`, `gantt-maneuver`, `infinite-clips`, `ascent-odometer`, `matrix-loom`, `bureau-stamps`.
- **Layer 2 — `accent`**: High-frequency transient/line overlay (luma-keyed via `keyPass`, blended with `screen`), e.g. `ping-ring`, `acoustic-loss`, `fuse-spark`, `glitch`.
- **Layer 3 — `typography`**: Word-synced lyric layer rendered over the radial safe-rect ink shield (`scrimPass`), e.g. `lyric-line`, `typography`, `kinetic-press`, `cyber-prompt`, `kinetic-hook`.
- **Layer 4 — `colorGrade`**: Post-processing mood preset (`cold-industrial`, `warning-crimson`, `cyber-green`, `void-monochrome`, `noir-gold`).

### 3.2 AI Orchestration & Code Generation
Configure `DEEPSEEK_API_KEY` in `app/.env.local`, then use:
- **`智能分镜` (Two-Stage Shot Program)**:
  - **Stage 1**: Groups lyric lines semantically and assigns closed-set style/imagery/acoustic tags; the server exclusively computes beat-snapped, zero-gap windows (`fitWindows` & `seal`).
  - **Stage 2**: Generates new TypeScript/GLSL layer plugins (`tmp-<track>-s<idx>-<role>.ts`) verified by static paradigm gates (`assertUsablePlugin`, `assertParadigm`) and `bun build --no-bundle` syntax check.
  - Streams live progress via NDJSON and supports instant cancellation (`⏹ 取消分镜`) or rollback (`撤回上一版分镜`).
- **`✨ AI 写单层` (Per-Shot Layer Targeted Codegen)**:
  - Located on every shot card; generates and mounts a single layer (`background`, `imagery`, `accent`, or `typography`) tailored to that shot's exact lyric time window.
- **Asset Promotion (`晋升为固定资产`)**:
  - In the **视效库** tab, promote any `tmp-*` plugin to a permanent asset ID. The server runs `bun run typecheck` (`tsc --noEmit`), registers the asset in `generated-catalog.ts`, and rewrites all `timeline.json` references atomically.

---

## 4. Offline Video & Stills Export (`app/scripts/render.ts`)

```bash
cd app

# Render stills for a specific track
bun scripts/render.ts stills --track demo --t 5.0,25.0,60.0 --out ../out/stills_demo

# Render contact sheet across all shot boundaries
bun scripts/render.ts sheet --track demo --cuts --cols 4 --out ../out/demo_cuts.png

# Export 1080p60 MP4 with adaptive motion blur
bun scripts/render.ts video --track demo --samples auto --shutter 0.2 --out ../out/demo_1080p60.mp4

# Export native 4K60 (3840x2160) MP4
bun scripts/render.ts video --track demo --scale 2 --samples auto --shutter 0.2 --crf 18 --out ../out/demo_4k60.mp4
```

---

## 5. Verification & Testing

```bash
cd app && bun run typecheck
cd app && bun run test
cd app && bun run build
python3 -m unittest discover -s analysis/tests -v
```
