"""Records must carry exactly one bounded copy of the extracted source material."""

import unittest

import _support  # noqa: F401
import app as app_module

MARKED_TEXT = """\
Operating systems manage hardware resources.

--- [Page 1] ---
A semaphore is an integer variable that controls access to a shared resource.
Semaphores must be protected from concurrent modification.

--- [Page 2] ---
Semaphores never guarantee the order in which waiting processes are granted access.
"""

PDF_SEGMENTS = [
    {
        "source_type": "pdf_page",
        "source_index": 1,
        "label": "Page 1",
        "text": "A semaphore is an integer variable that controls access to a shared resource.",
    },
    {
        "source_type": "pdf_page",
        "source_index": 2,
        "label": "Page 2",
        "text": "",
    },
]


class SourceViewerPayloadTests(unittest.TestCase):
    def setUp(self):
        self.saved = []
        self._orig_save = app_module.save_history
        self._orig_load = app_module.load_history
        app_module.save_history = lambda history: self.saved.append(history)
        app_module.load_history = lambda: []
        self.client = app_module.app.test_client()

    def tearDown(self):
        app_module.save_history = self._orig_save
        app_module.load_history = self._orig_load

    def test_upload_segments_are_stored_once_with_file_type(self):
        response = self.client.post(
            "/api/generate-reviewer",
            json={
                "text": MARKED_TEXT,
                "filename": "os_notes.pdf",
                "file_type": "pdf",
                "page_count": 2,
                "segments": PDF_SEGMENTS,
                "extraction_quality": "good",
                "extraction_warnings": [],
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()["data"]

        self.assertEqual(data["file_type"], "pdf")
        self.assertFalse(data["segments_truncated"])
        self.assertEqual(len(data["segments"]), 2)
        self.assertEqual(data["segments"][0]["label"], "Page 1")
        self.assertEqual(data["segments"][0]["source_type"], "pdf_page")
        self.assertEqual(data["segments"][1]["source_index"], 2)
        self.assertEqual(data["extraction_quality"], "good")

        saved = self.saved[-1][0]
        self.assertEqual(saved["segments"], data["segments"])
        self.assertEqual(saved["file_type"], "pdf")
        self.assertIn("segments_truncated", saved)

    def test_pasted_text_with_markers_becomes_page_segments(self):
        response = self.client.post(
            "/api/generate-reviewer",
            json={"text": MARKED_TEXT, "filename": "notes.txt"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()["data"]

        labels = [seg["label"] for seg in data["segments"]]
        self.assertEqual(labels[0], "Text")
        self.assertIn("Page 1", labels)
        self.assertIn("Page 2", labels)
        self.assertEqual(data["file_type"], "text")
        self.assertIn(data["extraction_quality"], {"good", "partial", "poor"})
        for segment in data["segments"]:
            self.assertIn(segment["source_type"], {"text", "page", "slide"})
            self.assertIsInstance(segment["text"], str)

    def test_segment_text_is_bounded_and_truncation_is_reported(self):
        oversized = [
            {
                "source_type": "pdf_page",
                "source_index": 1,
                "label": "Page 1",
                "text": "x" * (app_module.MAX_STORED_SEGMENT_CHARS + 5000),
            },
            {
                "source_type": "pdf_page",
                "source_index": 2,
                "label": "Page 2",
                "text": "kept page",
            },
        ]
        response = self.client.post(
            "/api/generate-reviewer",
            json={"text": "short", "filename": "big.pdf", "segments": oversized},
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()["data"]

        self.assertTrue(data["segments_truncated"])
        self.assertEqual(len(data["segments"]), 1)
        self.assertEqual(
            len(data["segments"][0]["text"]), app_module.MAX_STORED_SEGMENT_CHARS
        )
        self.assertEqual(data["segments"][0]["label"], "Page 1")

    def test_malformed_segments_are_dropped_not_crashing(self):
        response = self.client.post(
            "/api/generate-reviewer",
            json={
                "text": "plain lesson text",
                "filename": "notes.txt",
                "segments": ["junk", 7, {"label": "no type"}, None],
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()["data"]
        self.assertEqual(len(data["segments"]), 1)
        self.assertEqual(data["segments"][0]["source_type"], "text")

    def test_pasted_text_adopts_extractor_quality_and_warnings(self):
        response = self.client.post(
            "/api/generate-reviewer",
            json={"text": "Tiny note.", "filename": "note.txt"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()["data"]

        self.assertEqual(data["extraction_quality"], "partial")
        self.assertTrue(
            any("short" in warning for warning in data["extraction_warnings"])
        )
        self.assertTrue(
            any("short" in warning for warning in data["generation_meta"]["warnings"])
        )

    def test_invalid_extraction_quality_falls_back_to_unknown(self):
        response = self.client.post(
            "/api/generate-reviewer",
            json={
                "text": "plain lesson text",
                "filename": "notes.txt",
                "segments": PDF_SEGMENTS,
                "extraction_quality": "flawless",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["data"]["extraction_quality"], "unknown")


if __name__ == "__main__":
    unittest.main()
