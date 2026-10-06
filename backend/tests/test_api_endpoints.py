"""Endpoint-level guarantees: honest providers, warnings, and error handling."""

import io
import unittest

import _support  # noqa: F401
import app as app_module

LESSON_TEXT = """\
Semaphores in Operating Systems:

A semaphore is an integer variable that controls access to a shared resource by \
multiple processes in an operating system.
Remember that semaphores must be protected from concurrent modification by the \
waiting and signaling processes.
Semaphores never guarantee the order in which waiting processes are granted access.
"""


class ApiEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._orig_save = app_module.save_history
        cls._orig_load = app_module.load_history
        app_module.save_history = lambda *_args, **_kwargs: None
        app_module.load_history = lambda *_args, **_kwargs: []
        cls.client = app_module.app.test_client()

    @classmethod
    def tearDownClass(cls):
        app_module.save_history = cls._orig_save
        app_module.load_history = cls._orig_load

    def test_health(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "healthy")
        self.assertEqual(payload["default_model"], "gemini-2.5-flash")

    def test_generate_reviewer_without_key_is_source_grounded(self):
        response = self.client.post(
            "/api/generate-reviewer",
            json={"text": LESSON_TEXT, "filename": "os_notes.txt"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()["data"]

        self.assertEqual(data["ai_provider"], "local_extractive")
        self.assertNotIn("%", data["ai_provider"])

        meta = data["generation_meta"]
        self.assertEqual(meta["provider"], "local_extractive")
        self.assertGreater(meta["source_characters"], 0)
        self.assertTrue(
            any("offline extractive engine" in w for w in meta["warnings"]),
            meta["warnings"],
        )
        for key in meta:
            self.assertNotRegex(key, r"accuracy|percent|faithful")

        self.assertIn(data["extraction_quality"], {"good", "partial", "poor", "unknown"})
        self.assertIsInstance(data["extraction_warnings"], list)

        reviewer = data["reviewer"]
        self.assertTrue(reviewer["quick_review"])
        self.assertTrue(reviewer["keywords"])
        for keyword in reviewer["keywords"]:
            self.assertIn(keyword["term"].lower(), LESSON_TEXT.lower())

    def test_generate_reviewer_rejects_empty_input(self):
        response = self.client.post("/api/generate-reviewer", json={"text": "   "})
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.get_json())

    def test_image_without_api_key_is_rejected_honestly(self):
        response = self.client.post(
            "/api/generate-reviewer",
            json={"image_b64": "aGVsbG8=", "mime_type": "image/png"},
        )
        self.assertEqual(response.status_code, 400)
        error = response.get_json()["error"]
        self.assertIn("AI vision provider", error)

    def test_extract_endpoint_returns_quality_aliases(self):
        response = self.client.post(
            "/api/extract",
            data={"file": (io.BytesIO(LESSON_TEXT.encode("utf-8")), "notes.txt")},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload["success"])
        self.assertIn(payload["extraction_quality"], {"good", "partial", "poor"})
        self.assertIsInstance(payload["extraction_warnings"], list)
        self.assertEqual(payload["quality"], payload["extraction_quality"])
        self.assertTrue(payload["segments"])

    def test_transform_without_key_is_conservative_and_says_so(self):
        generated = self.client.post(
            "/api/generate-reviewer",
            json={"text": LESSON_TEXT, "filename": "os_notes.txt"},
        ).get_json()["data"]

        response = self.client.post(
            "/api/transform",
            json={"reviewer": generated["reviewer"], "action": "eli5"},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["provider"], "local_conservative")
        self.assertTrue(payload["note"])
        self.assertEqual(
            payload["reviewer"]["lesson_title"], generated["reviewer"]["lesson_title"]
        )

    def test_quiz_endpoint_reports_when_fewer_questions_are_possible(self):
        generated = self.client.post(
            "/api/generate-reviewer",
            json={"text": LESSON_TEXT, "filename": "os_notes.txt"},
        ).get_json()["data"]

        response = self.client.post(
            "/api/generate-quiz",
            json={
                "reviewer": generated["reviewer"],
                "question_count": 10,
                "question_type": "mixed",
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertLessEqual(payload["count"], 10)
        if payload["count"] < 10:
            self.assertTrue(payload["message"])
        for question in payload["questions"]:
            if question["type"] == "true_false":
                statement = question["question"].replace("True or False: ", "")
                self.assertIn(statement.lower(), LESSON_TEXT.lower())
            else:
                self.assertIn(question["correct_answer"].lower(), LESSON_TEXT.lower())

    def test_history_endpoint_returns_list(self):
        response = self.client.get("/api/history")
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.get_json()["history"], list)

    def test_pdf_export_survives_empty_sections(self):
        record = self.client.post(
            "/api/generate-reviewer",
            json={"text": LESSON_TEXT, "filename": "os_notes.txt"},
        ).get_json()["data"]
        for key in (
            "quick_review",
            "keywords",
            "core_concepts",
            "must_remember",
            "compare",
            "process_steps",
            "formulas_rules",
            "examples",
            "possible_quiz_points",
        ):
            record["reviewer"][key] = []
        record["reviewer"]["one_minute_review"] = ""

        response = self.client.post("/api/export-pdf", json=record)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["Content-Type"], "application/pdf")
        self.assertTrue(response.data.startswith(b"%PDF"))


if __name__ == "__main__":
    unittest.main()
