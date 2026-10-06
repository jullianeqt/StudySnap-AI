"""AI output must be coerced into a safe, frontend-proof structure."""

import unittest

import _support  # noqa: F401
from _support import REVIEWER_KEYS, REVIEWER_LIST_KEYS
from ai_engine import build_generation_meta, normalize_quiz, normalize_reviewer


class NormalizeReviewerShapeTests(unittest.TestCase):
    def test_none_input_returns_full_safe_shape(self):
        reviewer = normalize_reviewer(None)
        for key in REVIEWER_KEYS:
            self.assertIn(key, reviewer)
        for key in REVIEWER_LIST_KEYS:
            self.assertEqual(reviewer[key], [], f"{key} should default to []")
        self.assertIsInstance(reviewer["subject"], str)

    def test_junk_types_are_coerced(self):
        reviewer = normalize_reviewer({
            "subject": None,
            "lesson_title": 12345,
            "quick_review": "not a list",
            "keywords": {"term": "x"},
            "core_concepts": 7,
            "must_remember": "just a string",
            "one_minute_review": ["list", "instead"],
        })
        self.assertEqual(reviewer["subject"], "General Study")
        self.assertIsInstance(reviewer["lesson_title"], str)
        for key in REVIEWER_LIST_KEYS:
            self.assertIsInstance(reviewer[key], list)
        self.assertIsInstance(reviewer["one_minute_review"], str)

    def test_legacy_string_must_remember_supported(self):
        reviewer = normalize_reviewer({
            "must_remember": [
                "Always verify the source before trusting a claim.",
                {"text": "Second rule.", "sources": [{"type": "page", "index": 3}]},
                42,
            ],
        })
        texts = [entry["text"] for entry in reviewer["must_remember"]]
        self.assertEqual(
            texts,
            ["Always verify the source before trusting a claim.", "Second rule."],
        )
        self.assertEqual(reviewer["must_remember"][1]["sources"][0]["index"], 3)

    def test_keywords_require_term_and_definition(self):
        reviewer = normalize_reviewer({
            "keywords": [
                {"term": "", "definition": "something"},
                {"term": "Missing definition"},
                {"term": "Semaphore", "definition": "A variable controlling access."},
                {"term": "Semaphore", "definition": "Duplicate term."},
            ],
        })
        terms = [kw["term"] for kw in reviewer["keywords"]]
        self.assertEqual(terms, ["Semaphore"])

    def test_comparison_without_aspects_is_dropped(self):
        reviewer = normalize_reviewer({
            "compare": [
                {"concept_a": "A", "concept_b": "B", "aspects": []},
                {
                    "concept_a": "Stack",
                    "concept_b": "Queue",
                    "aspects": [{"aspect": "Order", "a_val": "LIFO", "b_val": "FIFO"}],
                },
            ],
        })
        self.assertEqual(len(reviewer["compare"]), 1)
        self.assertEqual(reviewer["compare"][0]["concept_a"], "Stack")

    def test_source_flags_kept_only_when_present(self):
        self.assertNotIn("source_flags", normalize_reviewer({}))
        reviewer = normalize_reviewer({"source_flags": ["Page 2 contradicts Page 1"]})
        self.assertEqual(reviewer["source_flags"], ["Page 2 contradicts Page 1"])


class NormalizeQuizTests(unittest.TestCase):
    def test_non_list_is_dropped(self):
        self.assertEqual(normalize_quiz("nonsense"), [])
        self.assertEqual(normalize_quiz(None), [])

    def test_invalid_type_and_missing_answer_dropped(self):
        questions = normalize_quiz([
            {"type": "essay", "question": "Explain everything", "correct_answer": "yes"},
            {"type": "multiple_choice", "question": "", "correct_answer": "a"},
            {"type": "true_false", "question": "The sky is blue.", "correct_answer": "True"},
        ])
        self.assertEqual(len(questions), 1)
        self.assertEqual(questions[0]["type"], "true_false")

    def test_multiple_choice_answer_must_be_in_options(self):
        questions = normalize_quiz([
            {
                "type": "multiple_choice",
                "question": "Which term matches?",
                "options": ["A", "B"],
                "correct_answer": "C",
            },
            {
                "type": "multiple_choice",
                "question": "Which term matches again?",
                "options": ["A", "B", "C"],
                "correct_answer": "C",
            },
        ])
        self.assertEqual(len(questions), 1)
        self.assertIn(questions[0]["correct_answer"], questions[0]["options"])

    def test_duplicates_removed_and_count_respected(self):
        raw = [
            {
                "type": "true_false",
                "question": "Same question",
                "correct_answer": "True",
            },
            {
                "type": "true_false",
                "question": "Same question",
                "correct_answer": "False",
            },
            {"type": "identification", "question": "Name it", "correct_answer": "Term"},
            {"type": "identification", "question": "Name it 2", "correct_answer": "Other"},
        ]
        questions = normalize_quiz(raw, question_count=2)
        self.assertEqual(len(questions), 2)
        self.assertEqual([q["id"] for q in questions], [1, 2])


class GenerationMetaTests(unittest.TestCase):
    def test_reports_empty_sections_without_accuracy_claims(self):
        reviewer = normalize_reviewer({
            "quick_review": ["A sentence long enough to be kept as a bullet point."],
            "keywords": [{"term": "Term", "definition": "A definition of the term."}],
        })
        meta = build_generation_meta(
            reviewer,
            source_characters=1234,
            source_segments=3,
            warnings=["Some warning", "Some warning", ""],
            provider="local_extractive",
        )
        self.assertEqual(meta["source_characters"], 1234)
        self.assertEqual(meta["source_segments"], 3)
        self.assertEqual(meta["provider"], "local_extractive")
        self.assertEqual(meta["warnings"], ["Some warning"])
        self.assertIn("compare", meta["sections_empty"])
        self.assertIn("one_minute_review", meta["sections_empty"])
        self.assertNotIn("quick_review", meta["sections_empty"])
        self.assertNotIn("keywords", meta["sections_empty"])
        for key in meta:
            self.assertNotRegex(key, r"accuracy|percent|faithful|guarantee")

    def test_sections_generated_matches_non_empty_sections(self):
        reviewer = normalize_reviewer({"quick_review": ["A bullet point with text."]})
        meta = build_generation_meta(reviewer)
        self.assertEqual(meta["sections_generated"], 1)
        self.assertEqual(
            len(meta["sections_empty"]), 9
        )  # 8 empty list fields + one_minute_review


if __name__ == "__main__":
    unittest.main()
