"""Deleting one reviewer must never touch the rest of the history list."""

import unittest

import _support  # noqa: F401
import app as app_module


class HistoryDeleteTests(unittest.TestCase):
    def setUp(self):
        self.store = [
            {"id": "r1", "title": "Semaphores"},
            {"id": "r2", "title": "Deadlocks"},
            {"id": "r3", "title": "Paging"},
        ]
        self.saved = []
        self._orig_save = app_module.save_history
        self._orig_load = app_module.load_history
        app_module.save_history = lambda history: self.saved.append(history)
        app_module.load_history = lambda: [dict(item) for item in self.store]
        self.client = app_module.app.test_client()

    def tearDown(self):
        app_module.save_history = self._orig_save
        app_module.load_history = self._orig_load

    def test_delete_single_reviewer_keeps_every_other_record(self):
        response = self.client.delete("/api/history/r1")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload["success"])
        self.assertEqual(payload["deleted"], "r1")
        self.assertEqual(payload["remaining"], 2)

        self.assertEqual(len(self.saved), 1)
        self.assertEqual([item["id"] for item in self.saved[0]], ["r2", "r3"])

    def test_delete_middle_record_preserves_order(self):
        response = self.client.delete("/api/history/r2")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in self.saved[0]], ["r1", "r3"])

    def test_delete_unknown_id_returns_404_without_saving(self):
        response = self.client.delete("/api/history/does-not-exist")
        self.assertEqual(response.status_code, 404)
        payload = response.get_json()
        self.assertFalse(payload["success"])
        self.assertIn("error", payload)
        self.assertEqual(self.saved, [])

    def test_clear_all_history_still_works(self):
        response = self.client.delete("/api/history")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["success"])
        self.assertEqual(self.saved[-1], [])

    def test_delete_leaves_get_history_intact(self):
        self.client.delete("/api/history/r3")
        app_module.load_history = lambda: self.saved[-1]
        response = self.client.get("/api/history")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item["id"] for item in response.get_json()["history"]],
            ["r1", "r2"],
        )


if __name__ == "__main__":
    unittest.main()
