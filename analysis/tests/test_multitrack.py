import json
import sys
import tempfile
import unittest
from pathlib import Path

ANALYSIS_DIR = Path(__file__).resolve().parent.parent
if str(ANALYSIS_DIR) not in sys.path:
    sys.path.insert(0, str(ANALYSIS_DIR))

import common
import build_track


class MultiTrackAnalysisTest(unittest.TestCase):
    def test_parse_lrc_lyrics(self):
        lrc = """
        [00:01.50]I see sparks of AGI in your eyes
        [00:06.00]Your circuits make me nervous
        [00:09.20]There was a sudden drop in your training loss
        """
        rows = common.parse_lyrics_text(lrc, suffix=".lrc", default_duration=20.0)
        self.assertEqual(len(rows), 3)
        self.assertAlmostEqual(rows[0][0], 1.5)
        self.assertLessEqual(rows[0][1], 6.0)
        self.assertEqual(rows[0][2], "I see sparks of AGI in your eyes")
        self.assertAlmostEqual(rows[1][0], 6.0)
        self.assertAlmostEqual(rows[2][0], 9.2)

    def test_parse_plain_txt_lyrics(self):
        txt = "First line of song\nSecond line with P(doom)\nThird line outro\n"
        rows = common.parse_lyrics_text(txt, suffix=".txt", default_duration=30.0)
        self.assertEqual(len(rows), 3)
        self.assertGreaterEqual(rows[0][0], 0.0)
        self.assertLess(rows[0][1], rows[1][0])
        self.assertLess(rows[1][1], rows[2][0])
        self.assertLessEqual(rows[2][1], 30.0)

    def test_parse_js_lyrics_src(self):
        rows = common.load_lyrics_src(common.PROJECT / "lyrics" / "lyrics.src.js")
        self.assertEqual(len(rows), 46)
        self.assertEqual(rows[0][2], "I see sparks of AGI in your eyes")

    def test_build_track_pack_fast_mode(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            lrc_file = tmp_path / "sample.lrc"
            lrc_file.write_text(
                "[00:01.00]Silicon wafer and ChatGPT,\n"
                "[00:05.00]I'm upping my P(doom)\n"
                "[00:09.50]Sharp left turn into the singularity\n"
                "[00:14.00]Hundred thousand GPU cluster\n",
                encoding="utf-8",
            )
            out_dir = tmp_path / "out_track"
            summary = build_track.build_track_pack(
                track="unit-test-song",
                lyrics_path=lrc_file,
                out_dir=out_dir,
                bpm=120.0,
                mode="fast",
            )
            self.assertEqual(summary["track"], "unit-test-song")
            self.assertEqual(summary["lines"], 4)
            self.assertGreaterEqual(summary["shots"], 1)

            audio_json = json.loads((out_dir / "audio.json").read_text(encoding="utf-8"))
            lyrics_json = json.loads((out_dir / "lyrics.json").read_text(encoding="utf-8"))
            timeline_json = json.loads((out_dir / "timeline.json").read_text(encoding="utf-8"))

            self.assertEqual(audio_json["bpm"], 120.0)
            self.assertTrue(len(audio_json["downbeats"]) > 0)
            self.assertEqual(len(lyrics_json["lines"]), 4)
            # Check compound syllable split for AGI / ChatGPT / P(doom) / GPU
            first_words = lyrics_json["lines"][0]["words"]
            chatgpt_word = [w for w in first_words if "ChatGPT" in w["w"]][0]
            self.assertIn("syl", chatgpt_word)
            self.assertEqual(len(chatgpt_word["syl"]), 4)

            # Check strict adjacency of timeline_json
            self.assertAlmostEqual(timeline_json[0]["start"], 0.0)
            self.assertAlmostEqual(timeline_json[-1]["end"], audio_json["duration"])
            for i in range(len(timeline_json) - 1):
                self.assertAlmostEqual(timeline_json[i]["end"], timeline_json[i + 1]["start"])

    def test_reject_invalid_or_default_track_slug(self):
        with self.assertRaises(ValueError):
            build_track.validate_track_slug("default")
        with self.assertRaises(ValueError):
            build_track.validate_track_slug("../evil")


if __name__ == "__main__":
    unittest.main()
