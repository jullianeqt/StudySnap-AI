"""Offline quizzes must be built only from grounded reviewer content."""

import unittest

import _support  # noqa: F401
from _support import in_source
from ai_engine import local_fallback_quiz_generator, local_fallback_synthesizer

GLOSSARY_SOURCE = """\
Data Structures Glossary:

Array is a collection of elements stored at contiguous memory locations.
Stack is a linear data structure that follows last in first out order.
Queue is a linear data structure that follows first in first out order.
Tree is a hierarchical data structure made of nodes connected by edges.
Graph is a set of vertices connected by edges that may be directed or undirected.
"""


def make_reviewer(keywords, quick_review=None, must_remember=None):
    return {
        "subject": "Computer Science / IT",
        "lesson_title": "Glossary",
        "quick_review": quick_review or [],
        "keywords": [
            {"term": term, "definition": definition, "importance": "high"}
            for term, definition in keywords
        ],
        "core_concepts": [],
        "must_remember": [{"text": text} for text in (must_remember or [])],
        "compare": [],
        "process_steps": [],
        "formulas_rules": [],
        "examples": [],
        "possible_quiz_points": [],
        "one_minute_review": "",
    }


RICH_REVIEWER = make_reviewer(
    keywords=[
        ("Semaphore", "An integer variable that controls access to a shared resource."),
        ("Deadlock", "A state where processes wait for each other indefinitely."),
        ("Thread", "A unit of execution that shares the memory of its process."),
        ("Scheduler", "The component that decides which process runs next."),
        ("Virtual Memory", "Memory that appears larger than the physical RAM installed."),
    ],
    quick_review=[
        "The scheduler decides which process runs next using a scheduling algorithm."
    ],
    must_remember=[
        "Threads must be synchronized when they share data structures."
    ],
)


class QuizFallbackStructureTests(unittest.TestCase):
    def test_multiple_choice_requires_real_distractors(self):
        questions = local_fallback_quiz_generator(RICH_REVIEWER, 10, "multiple_choice")
        self.assertTrue(questions)
        for question in questions:
            self.assertEqual(question["type"], "multiple_choice")
            self.assertEqual(len(question["options"]), 4)
            self.assertIn(question["correct_answer"], question["options"])
            self.assertEqual(len(set(question["options"])), 4)

    def test_no_multiple_choice_without_enough_definitions(self):
        thin = make_reviewer([("Semaphore", "An integer variable used for coordination.")])
        questions = local_fallback_quiz_generator(thin, 10, "multiple_choice")
        self.assertEqual(questions, [])

    def test_identification_answers_are_reviewer_terms(self):
        questions = local_fallback_quiz_generator(RICH_REVIEWER, 3, "identification")
        self.assertTrue(questions)
        terms = {kw["term"] for kw in RICH_REVIEWER["keywords"]}
        for question in questions:
            self.assertEqual(question["type"], "identification")
            self.assertIn(question["correct_answer"], terms)
            self.assertEqual(question["options"], [])

    def test_true_false_statements_come_from_the_reviewer(self):
        questions = local_fallback_quiz_generator(RICH_REVIEWER, 5, "true_false")
        self.assertTrue(questions)
        statements = list(RICH_REVIEWER["quick_review"]) + [
            entry["text"] for entry in RICH_REVIEWER["must_remember"]
        ]
        for question in questions:
            self.assertEqual(question["type"], "true_false")
            self.assertEqual(question["options"], ["True", "False"])
            self.assertEqual(question["correct_answer"], "True")
            statement = question["question"].replace("True or False: ", "")
            self.assertIn(statement, statements)

    def test_question_count_is_never_exceeded(self):
        for count in (1, 3, 7):
            questions = local_fallback_quiz_generator(RICH_REVIEWER, count, "mixed")
            self.assertLessEqual(len(questions), count)

    def test_ids_are_sequential_and_answers_are_settled(self):
        questions = local_fallback_quiz_generator(RICH_REVIEWER, 8, "mixed")
        self.assertEqual([q["id"] for q in questions], list(range(1, len(questions) + 1)))
        for question in questions:
            self.assertTrue(question["question"].strip())
            self.assertTrue(question["correct_answer"].strip())
            self.assertTrue(question["explanation"].strip())
            self.assertTrue(question["topic"].strip())

    def test_non_dict_reviewer_returns_no_questions(self):
        self.assertEqual(local_fallback_quiz_generator(None), [])
        self.assertEqual(local_fallback_quiz_generator("text"), [])


class QuizFallbackGroundednessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reviewer = local_fallback_synthesizer(
            GLOSSARY_SOURCE, filename="data_structures.txt"
        )
        cls.questions = local_fallback_quiz_generator(cls.reviewer, 10, "mixed")

    def test_quiz_is_built_from_source_grounded_reviewer(self):
        self.assertTrue(self.questions)
        for question in self.questions:
            answer = question["correct_answer"]
            if question["type"] == "true_false":
                statement = question["question"].replace("True or False: ", "")
                self.assertTrue(in_source(GLOSSARY_SOURCE, statement))
            else:
                self.assertTrue(
                    in_source(GLOSSARY_SOURCE, answer),
                    f"answer not grounded in source: {answer!r}",
                )

    def test_glossary_produced_enough_keywords_for_mcq(self):
        types = {question["type"] for question in self.questions}
        self.assertIn("multiple_choice", types)


if __name__ == "__main__":
    unittest.main()
