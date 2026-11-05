"""Shared paths / cache setup and multi-track configuration for analysis scripts.

Import this module FIRST (before torch / huggingface / mlx imports) so that all
model downloads land in analysis/.cache/.
"""
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent          # analysis/
PROJECT = ROOT.parent                            # pdoom-video/
CACHE = ROOT / ".cache"
for var, sub in [("TORCH_HOME", "torch"), ("HF_HOME", "hf"), ("HF_HUB_CACHE", "hf/hub"),
                 ("XDG_CACHE_HOME", "xdg"), ("HUGGINGFACE_HUB_CACHE", "hf/hub"),
                 ("TRANSFORMERS_CACHE", "hf/transformers"), ("MPLCONFIGDIR", "mpl"),
                 ("NUMBA_CACHE_DIR", "numba"), ("UV_CACHE_DIR", "uv")]:
    os.environ.setdefault(var, str(CACHE / sub))
    (CACHE / sub).mkdir(parents=True, exist_ok=True)

TRACK = os.environ.get("PDOOM_TRACK", "pdoom").strip() or "pdoom"
AUDIO = Path(os.environ["PDOOM_AUDIO"]) if "PDOOM_AUDIO" in os.environ else (PROJECT / "audio" / "pdoom.mp3")
STEMS = Path(os.environ["PDOOM_STEMS"]) if "PDOOM_STEMS" in os.environ else (ROOT / "stems" / "htdemucs_ft" / TRACK)
LYRICS_SRC = Path(os.environ["PDOOM_LYRICS"]) if "PDOOM_LYRICS" in os.environ else (PROJECT / "lyrics" / "lyrics.src.js")
DATA = Path(os.environ["PDOOM_OUT_DIR"]) if "PDOOM_OUT_DIR" in os.environ else (
    PROJECT / "data" if TRACK == "pdoom" else PROJECT / "app" / "public" / "tracks" / TRACK
)
QA = ROOT / "qa" if TRACK == "pdoom" else (ROOT / "qa" / TRACK)
WORK = ROOT / "work" if TRACK == "pdoom" else (ROOT / "work" / TRACK)
QA.mkdir(parents=True, exist_ok=True)
WORK.mkdir(parents=True, exist_ok=True)
DATA.mkdir(parents=True, exist_ok=True)

# The Demucs stems for the original pdoom.mp3 were rendered from an mp3 decode
# that did NOT trim the LAME encoder delay (1015 samples @ 44.1 kHz).
# Custom tracks default to 0 offset unless PDOOM_STEM_OFFSET_SAMPLES is set.
STEM_OFFSET_SAMPLES = int(
    os.environ.get("PDOOM_STEM_OFFSET_SAMPLES", "1015" if TRACK == "pdoom" else "0")
)
STEM_OFFSET_SEC = STEM_OFFSET_SAMPLES / 44100


def configure_track(
    track: str = "pdoom",
    audio_path: str | Path | None = None,
    lyrics_path: str | Path | None = None,
    out_dir: str | Path | None = None,
    stems_dir: str | Path | None = None,
    stem_offset_samples: int | None = None,
):
    """Dynamically rebind global paths for a target track."""
    global TRACK, AUDIO, STEMS, LYRICS_SRC, DATA, QA, WORK, STEM_OFFSET_SAMPLES, STEM_OFFSET_SEC
    TRACK = track
    AUDIO = Path(audio_path) if audio_path else (
        PROJECT / "audio" / "pdoom.mp3" if track == "pdoom" else PROJECT / "app" / "public" / "tracks" / track / "audio.mp3"
    )
    STEMS = Path(stems_dir) if stems_dir else (ROOT / "stems" / "htdemucs_ft" / track)
    LYRICS_SRC = Path(lyrics_path) if lyrics_path else (PROJECT / "lyrics" / "lyrics.src.js")
    DATA = Path(out_dir) if out_dir else (
        PROJECT / "data" if track == "pdoom" else PROJECT / "app" / "public" / "tracks" / track
    )
    QA = ROOT / "qa" if track == "pdoom" else (ROOT / "qa" / track)
    WORK = ROOT / "work" if track == "pdoom" else (ROOT / "work" / track)
    STEM_OFFSET_SAMPLES = (
        stem_offset_samples if stem_offset_samples is not None else (1015 if track == "pdoom" else 0)
    )
    STEM_OFFSET_SEC = STEM_OFFSET_SAMPLES / 44100
    QA.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    DATA.mkdir(parents=True, exist_ok=True)


_LRC_TAG = re.compile(r"\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]")


def parse_lyrics_text(raw: str, suffix: str = ".txt", default_duration: float = 120.0) -> list[tuple[float, float, str]]:
    """Parse lyrics from .js, .json, .lrc, or plain .txt into [(start, end, text), ...]."""
    ext = suffix.lower()
    text = raw.strip()
    if not text:
        return []

    # 1. JS array format (lyrics.src.js)
    if ext == ".js" or (text.startswith("const ") and "[" in text and "]" in text):
        body = text[text.index("["): text.rindex("]") + 1]
        rows = json.loads(body)
        return [(float(r[0]), float(r[1]), str(r[2]).strip()) for r in rows if str(r[2]).strip()]

    # 2. JSON format (either {"lines": [...]} or [[start, end, text], ...])
    if ext == ".json" or text.startswith("{") or text.startswith("["):
        try:
            doc = json.loads(text)
            if isinstance(doc, dict) and isinstance(doc.get("lines"), list):
                out = []
                for line in doc["lines"]:
                    t_str = str(line.get("text", "")).strip()
                    if t_str:
                        out.append((float(line.get("start", 0.0)), float(line.get("end", 0.0)), t_str))
                return out
            if isinstance(doc, list):
                out = []
                for item in doc:
                    if isinstance(item, (list, tuple)) and len(item) >= 3:
                        out.append((float(item[0]), float(item[1]), str(item[2]).strip()))
                    elif isinstance(item, dict) and item.get("text"):
                        out.append((float(item.get("start", 0.0)), float(item.get("end", 0.0)), str(item["text"]).strip()))
                return out
        except json.JSONDecodeError:
            pass

    # 3. LRC timestamped format ([mm:ss.xx] line)
    lrc_entries: list[tuple[float, str]] = []
    for line in text.splitlines():
        line_s = line.strip()
        if not line_s:
            continue
        matches = list(_LRC_TAG.finditer(line_s))
        if not matches:
            continue
        lyric_body = _LRC_TAG.sub("", line_s).strip()
        if not lyric_body:
            continue
        for m in matches:
            mins = int(m.group(1))
            secs = float(m.group(2))
            lrc_entries.append((mins * 60.0 + secs, lyric_body))

    if lrc_entries:
        lrc_entries.sort(key=lambda x: x[0])
        result: list[tuple[float, float, str]] = []
        for idx, (s, ltext) in enumerate(lrc_entries):
            if idx + 1 < len(lrc_entries):
                nxt_s = lrc_entries[idx + 1][0]
                e = max(s + 0.4, min(nxt_s - 0.05, s + max(2.0, len(ltext.split()) * 0.45)))
                if e > nxt_s:
                    e = nxt_s
            else:
                e = min(default_duration, s + max(2.5, len(ltext.split()) * 0.45))
            result.append((round(s, 3), round(e, 3), ltext))
        return result

    # 4. Plain text lines (distribute evenly across [1.0, default_duration * 0.92])
    raw_lines = [ln.strip() for ln in text.splitlines() if ln.strip() and not ln.strip().startswith("#")]
    if not raw_lines:
        return []
    span_start = min(1.0, default_duration * 0.05)
    span_end = max(span_start + 1.0, default_duration * 0.92)
    step = (span_end - span_start) / len(raw_lines)
    out_plain: list[tuple[float, float, str]] = []
    for i, ln in enumerate(raw_lines):
        s = span_start + i * step
        e = s + max(0.4, step * 0.88)
        out_plain.append((round(s, 3), round(e, 3), ln))
    return out_plain


def load_lyrics_src(path: str | Path | None = None, default_duration: float = 156.65):
    """Parse lyrics file (.js, .json, .lrc, or .txt) -> list of (start, end, text)."""
    target = Path(path) if path else LYRICS_SRC
    src = target.read_text(encoding="utf-8")
    return parse_lyrics_text(src, suffix=target.suffix, default_duration=default_duration)


def has_stems() -> bool:
    return all((STEMS / f"{name}.wav").exists() for name in ("vocals", "drums", "bass", "other"))


def load_stem(name, sr=None, mono=True):
    """Load a Demucs stem, time-aligned to the gapless mp3 decode."""
    import soundfile as sf
    import numpy as np
    y, s = sf.read(STEMS / f"{name}.wav", dtype="float32", always_2d=True)
    if STEM_OFFSET_SAMPLES > 0 and len(y) > STEM_OFFSET_SAMPLES:
        y = y[STEM_OFFSET_SAMPLES:]
    y = y.mean(axis=1) if mono else y.T
    if sr and sr != s:
        import soxr
        y = soxr.resample(y, s, sr) if mono else np.stack([soxr.resample(c, s, sr) for c in y])
        s = sr
    return y, s


KARAOKE = ROOT / "stems" / "karaoke"


def load_lead(sr=None, mono=True):
    """Lead vocal only (mel-band-roformer karaoke model run on the mp3; already
    in gapless-mp3 time, no offset)."""
    import soundfile as sf
    import numpy as np
    lead_file = KARAOKE / "lead.wav" if TRACK == "pdoom" else (STEMS / "lead.wav")
    if not lead_file.exists():
        return load_stem("vocals", sr=sr, mono=mono)
    y, s = sf.read(lead_file, dtype="float32", always_2d=True)
    y = y.mean(axis=1) if mono else y.T
    if sr and sr != s:
        import soxr
        y = soxr.resample(y, s, sr) if mono else np.stack([soxr.resample(c, s, sr) for c in y])
        s = sr
    return y, s


def load_vocal_source(name, sr=None):
    """'vocals' = Demucs vocal stem (mono sum), 'vocL'/'vocR' = its left/right
    channel (choruses are double-tracked and panned L/R, so each channel is
    closer to a single voice), 'lead' = karaoke lead."""
    if name == "lead":
        return load_lead(sr)
    if name in ("vocL", "vocR"):
        y, s = load_stem("vocals", sr=sr, mono=False)
        if y.ndim == 1:
            return y, s
        return y[0 if name == "vocL" else min(1, y.shape[0] - 1)], s
    return load_stem("vocals", sr=sr)


def load_mix(sr=44100, mono=True):
    import librosa
    y, s = librosa.load(str(AUDIO), sr=sr, mono=mono)
    return y, s
