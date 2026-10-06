"""The offline fallback must never invent facts that are absent from the source."""

import json
import unittest

import _support  # noqa: F401  (sys.path bootstrap)
from _support import REVIEWER_KEYS, in_source
from ai_engine import local_fallback_synthesizer

SEMAPHORE_SOURCE = """\
Semaphores in Operating Systems:

A semaphore is an integer variable that controls access to a shared resource by \
multiple processes in an operating system.
The wait operation decrements the semaphore value, and the signal operation \
increments the semaphore value.
A binary semaphore is restricted to the values zero and one, while a counting \
semaphore can hold a value greater than one.
Remember that semaphores must be protected from concurrent modification by the \
waiting and signaling processes.
Semaphores never guarantee the order in which waiting processes are granted access \
to the shared resource.
Note that the operating system scheduler may delay a signaling process, so timing \
is not guaranteed.
"""

BINARY_SEARCH_SOURCE = """\
Binary Search:

Binary search is an algorithm that finds the position of a target value within a \
sorted collection of elements.
The search procedure repeatedly divides the search interval in half until the \
target value is located or the interval becomes empty.
The collection must be sorted before a binary search can be performed.
"""

# Concepts that appear in generic OS material but are NOT in these sources.
FORBIDDEN_TERMS = [
    "deadlock",
    "mutex",
    "starvation",
    "priority inversion",
    "spinlock",
    "livelock",
    "peterson",
    "critical section",
    "producer",
    "space complexity",
    "linear search",
    "interpolation search",
    "worst case",
    "average case",
]


class FallbackStructureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reviewer = local_fallback_synthesizer(
            SEMAPHORE_SOURCE, filename="os_semaphores.txt"
        )

    def test_all_sections_are_always_present(self):
        for key in REVIEWER_KEYS:
            self.assertIn(key, self.reviewer)

    def test_subject_and_title_detected_from_source(self):
        self.assertEqual(self.reviewer["subject"], "Computer Science / IT")
        self.assertTrue(self.reviewer["lesson_title"])

    def test_quick_review_is_extracted_not_empty(self):
        self.assertTrue(self.reviewer["quick_review"])
        for line in self.reviewer["quick_review"]:
            self.assertTrue(
                in_source(SEMAPHORE_SOURCE, line),
                f"quick_review line not found in source: {line!r}",
            )

    def test_keywords_come_from_the_source(self):
        self.assertTrue(self.reviewer["keywords"])
        for keyword in self.reviewer["keywords"]:
            self.assertTrue(
                in_source(SEMAPHORE_SOURCE, keyword["term"]),
                f"keyword term invented: {keyword['term']!r}",
            )
            self.assertTrue(
                in_source(SEMAPHORE_SOURCE, keyword["definition"]),
                f"definition not found in source: {keyword['definition']!r}",
            )

    def test_must_remember_rules_come_from_the_source(self):
        for rule in self.reviewer["must_remember"]:
            self.assertTrue(
                in_source(SEMAPHORE_SOURCE, rule["text"]),
                f"rule not found in source: {rule['text']!r}",
            )

    def test_concepts_come_from_the_source(self):
        for concept in self.reviewer["core_concepts"]:
            self.assertTrue(
                in_source(SEMAPHORE_SOURCE, concept["concept"]),
                f"concept heading invented: {concept['concept']!r}",
            )
            if concept["explanation"]:
                self.assertTrue(
                    in_source(SEMAPHORE_SOURCE, concept["explanation"]),
                    f"explanation not found in source: {concept['explanation']!r}",
                )
            for point in concept["points"]:
                self.assertTrue(
                    in_source(SEMAPHORE_SOURCE, point),
                    f"concept point not found in source: {point!r}",
                )

    def test_one_minute_review_only_uses_source_terms(self):
        one_minute = self.reviewer["one_minute_review"]
        self.assertTrue(one_minute)
        for keyword in self.reviewer["keywords"]:
            self.assertIn(keyword["term"].lower(), one_minute.lower())


class FallbackAntiHallucinationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.semaphore = local_fallback_synthesizer(
            SEMAPHORE_SOURCE, filename="os_semaphores.txt"
        )
        cls.binary_search = local_fallback_synthesizer(
            BINARY_SEARCH_SOURCE, filename="binary_search.txt"
        )

    def _blob(self, reviewer):
        return json.dumps(reviewer, ensure_ascii=False).lower()

    def test_no_forbidden_concepts_in_semaphore_reviewer(self):
        blob = self._blob(self.semaphore)
        for term in FORBIDDEN_TERMS:
            self.assertNotIn(term, blob, f"fallback invented concept: {term!r}")

    def test_no_forbidden_concepts_in_binary_search_reviewer(self):
        blob = self._blob(self.binary_search)
        for term in FORBIDDEN_TERMS:
            self.assertNotIn(term, blob, f"fallback invented concept: {term!r}")

    def test_unsupported_sections_stay_empty(self):
        # The binary search source defines no formulas and draws no comparisons.
        self.assertEqual(self.binary_search["formulas_rules"], [])
        self.assertEqual(self.binary_search["compare"], [])

    def test_no_formulas_invented_for_semaphore_source(self):
        for formula in self.semaphore["formulas_rules"]:
            self.assertTrue(
                in_source(SEMAPHORE_SOURCE, formula["formula"])
                or in_source(SEMAPHORE_SOURCE, formula["name"]),
                f"formula not found in source: {formula!r}",
            )

    def test_empty_source_yields_empty_reviewer(self):
        reviewer = local_fallback_synthesizer("", filename="empty.txt")
        for key in ("quick_review", "keywords", "must_remember", "compare"):
            self.assertEqual(reviewer[key], [])


class FallbackProvenanceTests(unittest.TestCase):
    def test_page_markers_become_source_references(self):
        text = (
            "--- [Page 1] ---\n"
            "Networking Basics:\n"
            "A router forwards packets between computer networks.\n\n"
            "--- [Page 2] ---\n"
            "A switch is a networking device that forwards frames to a specific port.\n"
            "A hub is a networking device that broadcasts frames to every port.\n"
        )
        reviewer = local_fallback_synthesizer(text, filename="networking.txt")
        self.assertTrue(reviewer["keywords"], "expected at least one keyword")
        for keyword in reviewer["keywords"]:
            sources = keyword.get("sources") or []
            self.assertTrue(sources, f"missing provenance for {keyword['term']!r}")
            self.assertIn(sources[0].get("type"), {"page", "slide", "text"})
            self.assertEqual(sources[0].get("index"), 2)


if __name__ == "__main__":
    unittest.main()
