"""Shared bootstrap + helpers for StudySnap backend regression tests."""

import os
import re
import sys

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


def norm(text) -> str:
    """Lowercase, unify whitespace, drop trailing ellipsis/punctuation noise."""
    text = (text or "").replace("\u2026", "...")
    text = re.sub(r"\s+", " ", str(text)).strip().lower()
    return text


def in_source(source: str, text: str) -> bool:
    """True when `text` appears verbatim (modulo case/whitespace) in `source`."""
    hay = norm(source)
    needle = norm(text)
    if needle.endswith("..."):
        needle = needle[:-3].rstrip()
    needle = needle.rstrip(".")
    return bool(needle) and needle in hay


REVIEWER_KEYS = (
    "subject",
    "lesson_title",
    "quick_review",
    "keywords",
    "core_concepts",
    "must_remember",
    "compare",
    "process_steps",
    "formulas_rules",
    "examples",
    "possible_quiz_points",
    "one_minute_review",
)

REVIEWER_LIST_KEYS = (
    "quick_review",
    "keywords",
    "core_concepts",
    "must_remember",
    "compare",
    "process_steps",
    "formulas_rules",
    "examples",
    "possible_quiz_points",
)
