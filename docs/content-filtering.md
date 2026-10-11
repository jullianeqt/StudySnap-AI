# Study content filtering

Generated content previously passed through shape validation without metadata
filtering. The fallback consumed branded headers, history returned old records
unchanged, and quiz generation accepted those records as study material. Filtering
only a title or an AI instruction could not cover these paths.

## Implementation

- `backend/content_filter.py` filters generated text and nested reviewer/quiz data.
- `backend/content_rules.json` defines the common label, institution, administrative,
  advice, structural, and academic-context rules. `frontend/src/contentRules.json`
  mirrors the same specification so Vercel and Railway can deploy from separate
  roots. A regression test enforces equality of the two rule files.
- `backend/ai_engine.py` cleans generation input after extraction, reviewer
  normalization, and quiz normalization. AI, fallback, and transformations pass
  through these boundaries. Administrative quiz questions and invalid answer keys
  are discarded; IDs and provenance survive, and duplicate IDs/options are rejected.
- `backend/app.py` cleans old history at read time, quiz-generation input, transform
  responses, and PDF exports/download titles. Reading history does not rewrite it.
- `frontend/src/contentFilter.ts` implements the same rules at browser data
  boundaries. `App.tsx` cleans fetched records, generated quizzes, and transforms.
  Reviewer, history, study cards/mode, quiz, and results use cleaned data defensively.
  Reviewer search and copied exports derive from that cleaned reviewer.
- Uploaded text, original filenames, source segments, IDs, question types, step
  numbers, and source references are retained. History displays a cleaned filename
  label; the source viewer displays the original filename and source text.

## Examples

| Before | After |
| --- | --- |
| ABC University — Lesson 1: Algorithms | Algorithms |
| Computer Science 101: Data Structures | Data Structures |
| CS 101: Algorithm | Algorithm |
| An algorithm is an ordered sequence of steps. ABC University. Lesson: 1. It must terminate. | An algorithm is an ordered sequence of steps. It must terminate. |
| University / LESSON 01 / Lecture #101 (standalone) | Item removed |
| The University of Cambridge was founded in 1209. | Preserved |
| Step 101: Compare the values. | Preserved |

## Verification

The shared noisy fixture exercises every reviewer section, paragraph headers,
branding-only entries, lesson/course prefix variants, quiz payloads, legacy history,
formulas, procedures, and source references. Backend tests cover both generation
paths with mocked AI, transforms, original extraction, history reads, answer-key
integrity, and PDF text. Frontend tests render the full reviewer, study mode,
history, quiz, and results, and check copied export text and scoring.

Browser checks used an isolated backend whose history loaded the noisy fixture and
whose save operation was disabled. The complete reviewer, reopened history,
revealed flashcards, two-question quiz, and 100% (2/2) results were inspected. The
original branding and lesson labels remained visible in the source viewer only.
Copied reviewer text was checked separately. No paid API request was needed.

## Limits

Context detection is deterministic and conservative rather than a semantic
guarantee. Ambiguous institution mentions without enough academic context can need
additional fixtures/rules. This change removes administrative content; it does not
prove that every AI-generated academic claim is supported by a source. Existing
source-grounding and extraction warnings remain in place.

No push, merge, or deployment is part of this change.
