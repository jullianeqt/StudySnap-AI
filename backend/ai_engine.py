import os
import re
import json
import logging
import base64
from typing import Dict, Any, List, Optional, Tuple
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
load_dotenv()

GEMINI_MODEL = "gemini-2.5-flash"
LOW_TEMPERATURE = 0.1

# ---------------------------------------------------------------------------
# Source references (provenance)
# ---------------------------------------------------------------------------

_SOURCE_REF_TYPES = {"page", "slide", "text", "image"}
_SOURCE_REF_ALIASES = {
    "pdf_page": "page",
    "pptx_slide": "slide",
    "page": "page",
    "slide": "slide",
    "text": "text",
    "image": "image",
}


def _sources_schema() -> Dict[str, Any]:
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["page", "slide", "text", "image"]},
                "index": {"type": "integer"},
                "label": {"type": "string"},
            },
            "required": ["type"],
        },
    }


REVIEWER_JSON_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "subject": {"type": "string"},
        "lesson_title": {"type": "string"},
        "quick_review": {"type": "array", "items": {"type": "string"}},
        "keywords": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "term": {"type": "string"},
                    "definition": {"type": "string"},
                    "importance": {"type": "string", "enum": ["high", "medium"]},
                    "sources": _sources_schema(),
                },
                "required": ["term", "definition"],
            },
        },
        "core_concepts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "concept": {"type": "string"},
                    "explanation": {"type": "string"},
                    "points": {"type": "array", "items": {"type": "string"}},
                    "sources": _sources_schema(),
                },
                "required": ["concept", "explanation"],
            },
        },
        "must_remember": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "sources": _sources_schema(),
                },
                "required": ["text"],
            },
        },
        "compare": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "concept_a": {"type": "string"},
                    "concept_b": {"type": "string"},
                    "aspects": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "aspect": {"type": "string"},
                                "a_val": {"type": "string"},
                                "b_val": {"type": "string"},
                            },
                            "required": ["aspect", "a_val", "b_val"],
                        },
                    },
                    "sources": _sources_schema(),
                },
                "required": ["concept_a", "concept_b"],
            },
        },
        "process_steps": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "process_title": {"type": "string"},
                    "steps": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "step_number": {"type": "integer"},
                                "title": {"type": "string"},
                                "description": {"type": "string"},
                            },
                            "required": ["step_number", "title", "description"],
                        },
                    },
                    "sources": _sources_schema(),
                },
                "required": ["process_title", "steps"],
            },
        },
        "formulas_rules": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "formula": {"type": "string"},
                    "variables": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "symbol": {"type": "string"},
                                "meaning": {"type": "string"},
                            },
                            "required": ["symbol", "meaning"],
                        },
                    },
                    "when_to_use": {"type": "string"},
                    "example": {"type": "string"},
                    "sources": _sources_schema(),
                },
                "required": ["name", "formula"],
            },
        },
        "examples": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "concept": {"type": "string"},
                    "example": {"type": "string"},
                    "explanation": {"type": "string"},
                    "sources": _sources_schema(),
                },
                "required": ["concept", "example"],
            },
        },
        "possible_quiz_points": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question_clue": {"type": "string"},
                    "key_fact": {"type": "string"},
                    "question_type": {
                        "type": "string",
                        "enum": ["multiple_choice", "true_false", "identification"],
                    },
                    "sources": _sources_schema(),
                },
                "required": ["question_clue", "key_fact"],
            },
        },
        "one_minute_review": {"type": "string"},
        "source_flags": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
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
    ],
}

REVIEWER_SYSTEM_PROMPT = """You are StudySnap AI, a source-grounded academic extraction engine.
Your ONLY job is to transform the SUPPLIED SOURCE MATERIAL into a structured study reviewer.
You are NOT writing a reviewer about a topic from your own knowledge.

=== AUTHORITATIVE SOURCE RULES ===
1. The supplied source material is the single source of truth. Every factual statement in your output must be directly traceable to it.
2. Never use your own outside knowledge to fill gaps, complete lists, add background context, or explain anything the source does not say.
3. If a claim cannot be supported by the source, omit it. An empty section is ALWAYS better than fabricated content. Do not fill a section just to keep the format complete; return [] for unsupported sections.
4. Preserve exact names, dates, numbers, units, formulas, variables, code, terminology, qualifiers (may, often, approximately, typically), and negations (not, never, without) exactly as written in the source.
5. Do not silently correct or "improve" the professor/source. If the source appears contradictory, wrong, or ambiguous, do not pick a side: record the conflict in "source_flags" and keep the conflicting statements as they appear.
6. Do not convert uncertainty into certainty. Keep "may", "some", "typically", "is suggested to" as stated.
7. Never manufacture: examples, analogies, comparison tables, processes/steps, formulas, equations, variables, quiz facts, exam tips, mnemonics, verification steps, boundary-condition advice, or study advice.
   - Fill "compare" ONLY when the source explicitly compares two concepts. Never build a comparison merely because two concepts exist.
   - Fill "process_steps" ONLY from explicitly numbered or explicitly ordered steps written in the source.
   - Fill "formulas_rules" ONLY with formulas written in the source. Never derive, recall, or invent a formula.
   - Fill "examples" ONLY with examples that literally appear in the source. Never invent a scenario.
   - Fill "possible_quiz_points" ONLY by restating facts stated in the source. Never invent quiz facts.
8. Analogies are allowed ONLY when the selected tone is "eli5". Every analogy must start with the word "Analogy:" and must read as an explanatory analogy, never as a fact from the source.
9. Never strengthen a source statement into a rule, law, guarantee, or universal claim.
10. The source may contain markers such as "--- [Page 3] ---" or "--- [Slide 2] ---". Use them to populate the optional "sources" arrays on keywords, core_concepts, must_remember, formulas_rules, process_steps, examples, and possible_quiz_points. Only add a reference when the statement actually appears on that page/slide. Never invent a reference; if you cannot locate it, omit "sources".
11. If the source is missing or too thin to support a section, return [] for that section. Do not add filler to satisfy the format.

=== OUTPUT FORMAT ===
Return ONLY valid JSON with every top-level key present. Unsupported sections must be [].
The structure is:
{
  "subject": "e.g., Computer Science / Biology / Physics",
  "lesson_title": "Concise lesson topic title",
  "quick_review": ["3 to 7 high-yield bullet points that are restatements of source statements"],
  "keywords": [{"term": "...", "definition": "...", "importance": "high", "sources": [{"type": "page", "index": 3, "label": "Page 3"}]}],
  "core_concepts": [{"concept": "...", "explanation": "...", "points": ["..."], "sources": []}],
  "must_remember": [{"text": "verbatim high-yield source fact", "sources": []}],
  "compare": [{"concept_a": "...", "concept_b": "...", "aspects": [{"aspect": "...", "a_val": "...", "b_val": "..."}], "sources": []}],
  "process_steps": [{"process_title": "...", "steps": [{"step_number": 1, "title": "...", "description": "..."}], "sources": []}],
  "formulas_rules": [{"name": "...", "formula": "...", "variables": [{"symbol": "E", "meaning": "Energy"}], "when_to_use": "...", "example": "...", "sources": []}],
  "examples": [{"concept": "...", "example": "...", "explanation": "...", "sources": []}],
  "possible_quiz_points": [{"question_clue": "...", "key_fact": "...", "question_type": "multiple_choice", "sources": []}],
  "one_minute_review": "Ultra-condensed recap of only source-supported points.",
  "source_flags": ["Conflicts or unclear statements observed in the source"]
}

Style Instructions:
- If compression is 'quick': keep only the most important supported items and use compact wording.
- If compression is 'detailed': add more supported items from the source, never new facts.
- If tone is 'simpler': plainer vocabulary, but technical terms stay visible and accuracy is unchanged.
- If tone is 'eli5': beginner-friendly wording plus clearly labeled analogies, with all technical terms preserved.
- When an image is supplied: analyze ONLY what is visibly written/drawn in the image. Do not add anything that is not visible.
"""


def _parse_json_value(raw_text: Optional[str], default: Any) -> Any:
    if not raw_text:
        return default
    text = raw_text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    start = cleaned.find("{") if isinstance(default, dict) else cleaned.find("[")
    end = cleaned.rfind("}") if isinstance(default, dict) else cleaned.rfind("]")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(cleaned[start:end + 1])
        except json.JSONDecodeError:
            pass
    logger.warning("Model returned unparseable JSON; using default value.")
    return default


# ---------------------------------------------------------------------------
# Normalization / validation of reviewer payloads
# ---------------------------------------------------------------------------

REVIEWER_LIST_FIELDS = (
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

REVIEWER_SECTIONS = REVIEWER_LIST_FIELDS + ("one_minute_review",)


def _safe_str(value: Any, default: str = "", max_len: int = 2000) -> str:
    if isinstance(value, str):
        return value.strip()[:max_len]
    if isinstance(value, bool):
        return default
    if isinstance(value, (int, float)):
        return str(value)[:max_len]
    return default


def _safe_str_list(value: Any, max_items: int = 50, max_len: int = 600) -> List[str]:
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        return []
    out: List[str] = []
    seen = set()
    for item in value:
        text = _safe_str(item, max_len=max_len)
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
        if len(out) >= max_items:
            break
    return out


def _normalize_sources(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    out: List[Dict[str, Any]] = []
    seen = set()
    for item in value:
        if not isinstance(item, dict):
            continue
        raw_type = item.get("type")
        if not isinstance(raw_type, str):
            continue
        ref_type = _SOURCE_REF_ALIASES.get(raw_type.strip().lower())
        if ref_type not in _SOURCE_REF_TYPES:
            continue
        ref: Dict[str, Any] = {"type": ref_type}
        index = item.get("index")
        if isinstance(index, bool):
            index = None
        if isinstance(index, float) and index.is_integer():
            index = int(index)
        if isinstance(index, int) and index > 0:
            ref["index"] = index
        elif isinstance(index, str) and index.strip().isdigit():
            ref["index"] = int(index.strip())
        label = _safe_str(item.get("label"), max_len=80)
        if label:
            ref["label"] = label
        key = (ref["type"], ref.get("index"), ref.get("label"))
        if key in seen:
            continue
        seen.add(key)
        out.append(ref)
        if len(out) >= 10:
            break
    return out


def _with_sources(entry: Dict[str, Any], raw: Dict[str, Any]) -> Dict[str, Any]:
    sources = _normalize_sources(raw.get("sources"))
    if sources:
        entry["sources"] = sources
    return entry


def _normalize_keywords(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    out: List[Dict[str, Any]] = []
    seen = set()
    for item in value:
        if not isinstance(item, dict):
            continue
        term = _safe_str(item.get("term"), max_len=120)
        definition = _safe_str(item.get("definition"), max_len=600)
        if not term or not definition:
            continue
        key = term.lower()
        if key in seen:
            continue
        seen.add(key)
        importance = item.get("importance")
        entry = {
            "term": term,
            "definition": definition,
            "importance": "high" if importance == "high" else "medium",
        }
        out.append(_with_sources(entry, item))
        if len(out) >= 30:
            break
    return out


def _normalize_concepts(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    out: List[Dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        concept = _safe_str(item.get("concept"), max_len=200)
        explanation = _safe_str(item.get("explanation"), max_len=1500)
        if not concept:
            continue
        entry = {
            "concept": concept,
            "explanation": explanation,
            "points": _safe_str_list(item.get("points"), max_items=10, max_len=400),
        }
        out.append(_with_sources(entry, item))
        if len(out) >= 30:
            break
    return out


def _normalize_must_remember(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    out: List[Dict[str, Any]] = []
    for item in value:
        if isinstance(item, str):
            text = _safe_str(item, max_len=600)
            if text:
                out.append({"text": text})
        elif isinstance(item, dict):
            text = _safe_str(item.get("text"), max_len=600)
            if not text:
                continue
            out.append(_with_sources({"text": text}, item))
        if len(out) >= 30:
            break
    return out


def _normalize_comparisons(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    out: List[Dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        concept_a = _safe_str(item.get("concept_a"), max_len=120)
        concept_b = _safe_str(item.get("concept_b"), max_len=120)
        if not concept_a or not concept_b:
            continue
        aspects = []
        raw_aspects = item.get("aspects")
        if isinstance(raw_aspects, list):
            for aspect in raw_aspects:
                if not isinstance(aspect, dict):
                    continue
                label = _safe_str(aspect.get("aspect"), max_len=200)
                a_val = _safe_str(aspect.get("a_val"), max_len=600)
                b_val = _safe_str(aspect.get("b_val"), max_len=600)
                if not label or not a_val or not b_val:
                    continue
                aspects.append({"aspect": label, "a_val": a_val, "b_val": b_val})
                if len(aspects) >= 20:
                    break
        if not aspects:
            continue
        entry = {"concept_a": concept_a, "concept_b": concept_b, "aspects": aspects}
        out.append(_with_sources(entry, item))
        if len(out) >= 10:
            break
    return out


def _normalize_processes(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    out: List[Dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        title = _safe_str(item.get("process_title"), max_len=200)
        raw_steps = item.get("steps")
        steps = []
        if isinstance(raw_steps, list):
            for position, step in enumerate(raw_steps, start=1):
                if not isinstance(step, dict):
                    continue
                number = step.get("step_number")
                if isinstance(number, bool):
                    number = None
                if isinstance(number, str) and number.strip().isdigit():
                    number = int(number.strip())
                if not isinstance(number, int) or number <= 0:
                    number = position
                step_title = _safe_str(step.get("title"), max_len=300)
                description = _safe_str(step.get("description"), max_len=1000)
                if not step_title:
                    step_title = f"Step {number}"
                if not step_title and not description:
                    continue
                steps.append({
                    "step_number": number,
                    "title": step_title,
                    "description": description,
                })
                if len(steps) >= 30:
                    break
        if not steps:
            continue
        entry = {
            "process_title": title or "Numbered Steps",
            "steps": steps,
        }
        out.append(_with_sources(entry, item))
        if len(out) >= 10:
            break
    return out


def _normalize_formulas(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    out: List[Dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        name = _safe_str(item.get("name"), max_len=200)
        formula = _safe_str(item.get("formula"), max_len=600)
        if not name or not formula:
            continue
        variables = []
        raw_variables = item.get("variables")
        if isinstance(raw_variables, list):
            for var in raw_variables:
                if not isinstance(var, dict):
                    continue
                symbol = _safe_str(var.get("symbol"), max_len=60)
                meaning = _safe_str(var.get("meaning"), max_len=300)
                if symbol and meaning:
                    variables.append({"symbol": symbol, "meaning": meaning})
                if len(variables) >= 30:
                    break
        entry = {
            "name": name,
            "formula": formula,
            "variables": variables,
            "when_to_use": _safe_str(item.get("when_to_use"), max_len=600),
            "example": _safe_str(item.get("example"), max_len=600),
        }
        out.append(_with_sources(entry, item))
        if len(out) >= 20:
            break
    return out


def _normalize_examples(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    out: List[Dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        concept = _safe_str(item.get("concept"), max_len=200)
        example = _safe_str(item.get("example"), max_len=1200)
        if not concept or not example:
            continue
        entry = {
            "concept": concept,
            "example": example,
            "explanation": _safe_str(item.get("explanation"), max_len=800),
        }
        out.append(_with_sources(entry, item))
        if len(out) >= 20:
            break
    return out


def _normalize_quiz_points(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    valid_types = {"multiple_choice", "true_false", "identification"}
    out: List[Dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        clue = _safe_str(item.get("question_clue"), max_len=500)
        fact = _safe_str(item.get("key_fact"), max_len=800)
        if not clue or not fact:
            continue
        question_type = item.get("question_type")
        if question_type not in valid_types:
            question_type = "multiple_choice"
        entry = {
            "question_clue": clue,
            "key_fact": fact,
            "question_type": question_type,
        }
        out.append(_with_sources(entry, item))
        if len(out) >= 30:
            break
    return out


def normalize_reviewer(data: Any) -> Dict[str, Any]:
    """Coerce model output into a safe, frontend-proof reviewer structure.

    Never trusts AI JSON: malformed values become safe defaults, unsupported
    structures are dropped, and missing sections are always present as [].
    """
    if not isinstance(data, dict):
        data = {}

    reviewer: Dict[str, Any] = {
        "subject": _safe_str(data.get("subject"), default="General Study", max_len=120) or "General Study",
        "lesson_title": _safe_str(data.get("lesson_title"), max_len=200),
        "quick_review": _safe_str_list(data.get("quick_review"), max_items=20, max_len=600),
        "keywords": _normalize_keywords(data.get("keywords")),
        "core_concepts": _normalize_concepts(data.get("core_concepts")),
        "must_remember": _normalize_must_remember(data.get("must_remember")),
        "compare": _normalize_comparisons(data.get("compare")),
        "process_steps": _normalize_processes(data.get("process_steps")),
        "formulas_rules": _normalize_formulas(data.get("formulas_rules")),
        "examples": _normalize_examples(data.get("examples")),
        "possible_quiz_points": _normalize_quiz_points(data.get("possible_quiz_points")),
        "one_minute_review": _safe_str(data.get("one_minute_review"), max_len=2000),
    }

    source_flags = _safe_str_list(data.get("source_flags"), max_items=20, max_len=400)
    if source_flags:
        reviewer["source_flags"] = source_flags

    return reviewer


def normalize_quiz(questions: Any, question_count: int = 20) -> List[Dict[str, Any]]:
    """Validate model quiz output; drop anything untrustworthy or malformed."""
    if not isinstance(questions, list):
        return []
    valid_types = {"multiple_choice", "true_false", "identification"}
    out: List[Dict[str, Any]] = []
    seen_questions = set()
    for item in questions:
        if len(out) >= max(1, int(question_count)):
            break
        if not isinstance(item, dict):
            continue
        qtype = item.get("type")
        if qtype not in valid_types:
            continue
        question = _safe_str(item.get("question"), max_len=700)
        answer = _safe_str(item.get("correct_answer"), max_len=400)
        if not question or not answer:
            continue
        key = question.lower()
        if key in seen_questions:
            continue

        raw_options = item.get("options")
        options: List[str] = []
        if isinstance(raw_options, list):
            for option in raw_options:
                text = _safe_str(option, max_len=400)
                if text:
                    options.append(text)

        if qtype == "multiple_choice":
            if len(options) < 2 or answer not in options:
                continue
            options = options[:6]
        elif qtype == "true_false":
            answer = "True" if answer.strip().lower().startswith("t") else "False"
            options = ["True", "False"]
        else:
            options = []

        seen_questions.add(key)
        out.append({
            "id": len(out) + 1,
            "type": qtype,
            "question": question,
            "options": options,
            "correct_answer": answer,
            "explanation": _safe_str(item.get("explanation"), max_len=800),
            "topic": _safe_str(item.get("topic"), max_len=150) or "General",
        })
    return out


def build_generation_meta(
    reviewer: Dict[str, Any],
    source_characters: int = 0,
    source_segments: int = 0,
    warnings: Optional[List[str]] = None,
    provider: str = "unknown",
) -> Dict[str, Any]:
    """Diagnostics about how the reviewer was produced. No accuracy percentages."""
    sections_empty = [name for name in REVIEWER_LIST_FIELDS if not reviewer.get(name)]
    if not reviewer.get("one_minute_review"):
        sections_empty.append("one_minute_review")
    clean_warnings = []
    for warning in warnings or []:
        if isinstance(warning, str) and warning.strip() and warning.strip() not in clean_warnings:
            clean_warnings.append(warning.strip())
    return {
        "source_characters": int(source_characters or 0),
        "source_segments": int(source_segments or 0),
        "sections_generated": len(REVIEWER_SECTIONS) - len(sections_empty),
        "sections_empty": sections_empty,
        "warnings": clean_warnings[:20],
        "provider": provider or "unknown",
    }


# ---------------------------------------------------------------------------
# Gemini generation
# ---------------------------------------------------------------------------

def _generate_reviewer_content(client, contents, system_instruction: str):
    from google.genai import types

    base_config = {
        "system_instruction": system_instruction,
        "response_mime_type": "application/json",
        "temperature": LOW_TEMPERATURE,
    }
    try:
        return client.models.generate_content(
            model=GEMINI_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                response_json_schema=REVIEWER_JSON_SCHEMA,
                **base_config,
            ),
        )
    except Exception as schema_error:
        logger.warning(
            "Structured schema request failed (%s); retrying without response_json_schema.",
            schema_error,
        )
        return client.models.generate_content(
            model=GEMINI_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(**base_config),
        )


def generate_reviewer_gemini(
    text: str,
    image_b64: Optional[str] = None,
    mime_type: Optional[str] = None,
    compression: str = "standard",
    tone: str = "standard",
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """Call Google Gemini Flash using google-genai SDK. Output is validated."""
    from google import genai
    from google.genai import types

    resolved_key = api_key or os.environ.get("GEMINI_API_KEY")
    if not resolved_key:
        raise ValueError("No Gemini API key provided.")

    client = genai.Client(api_key=resolved_key)

    compression = compression if compression in {"quick", "standard", "detailed"} else "standard"
    tone = tone if tone in {"standard", "simpler", "eli5"} else "standard"

    user_instructions = f"""Please transform this learning material into the Study Reviewer.
Settings:
- Compression Level: {compression} (quick / standard / detailed)
- Explanation Tone: {tone} (standard / simpler / eli5)

Apply both settings to every section, but never at the cost of source fidelity:
- quick: keep only the most important source-supported items, compact wording.
- standard: balanced coverage of what the source actually contains.
- detailed: include more source-supported items; never new facts.
- simpler: plainer vocabulary, technical terms stay visible, accuracy unchanged.
- eli5: beginner-friendly wording; analogies must be prefixed with "Analogy:".
Do not default to standard if a different setting is selected.

Remember: only claims traceable to the source below may appear in your output.

Source Material:
{text}
"""

    contents = []
    if image_b64:
        img_bytes = base64.b64decode(image_b64)
        contents.append(
            types.Part.from_bytes(
                data=img_bytes,
                mime_type=mime_type or "image/jpeg"
            )
        )
    contents.append(user_instructions)

    response = _generate_reviewer_content(client, contents, REVIEWER_SYSTEM_PROMPT)
    data = _parse_json_value(response.text, {})
    return normalize_reviewer(data)


def generate_quiz_gemini(
    reviewer_data: Dict[str, Any],
    question_count: int = 10,
    question_type: str = "mixed",
    api_key: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Generate quiz questions from reviewer data using Gemini Flash."""
    from google import genai
    from google.genai import types

    resolved_key = api_key or os.environ.get("GEMINI_API_KEY")
    if not resolved_key:
        raise ValueError("No Gemini API key provided.")

    client = genai.Client(api_key=resolved_key)

    prompt = f"""Generate at most {question_count} practice quiz questions based ONLY on the study reviewer below.

HARD RULES:
- Use ONLY facts stated in the reviewer. No outside knowledge, ever.
- Distractors must be other real statements or definitions taken from the reviewer. Never invent a plausible-sounding fact as a distractor.
- true/false statements must be directly supported by the reviewer.
- Every explanation must rest on reviewer content only.
- If you cannot produce {question_count} trustworthy questions, return FEWER questions. Never pad with generic or fabricated questions. Returning 7 grounded questions instead of 10 is correct.

Format requirements:
- Question types: {question_type} (options: multiple_choice, true_false, identification, or mixed)
- For multiple_choice: 4 options drawn from the reviewer, 1 unambiguously correct, correct answer must appear verbatim in options.
- For true_false: statement with 'True' or 'False' as correct answer.
- For identification: short phrase or term as correct answer.
- Provide a concise explanation quoting/paraphrasing the reviewer.
- Provide a 'topic' string indicating which section or concept this question tests.

Return a JSON array of objects:
[
  {{
    "id": 1,
    "type": "multiple_choice",
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "Option A",
    "explanation": "Explanation of the correct answer.",
    "topic": "Keyword / Concept tested"
  }}
]

Reviewer Data:
{json.dumps(reviewer_data, indent=2)}
"""

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.2,
        )
    )

    questions = _parse_json_value(response.text, [])
    return normalize_quiz(questions, question_count)


TRANSFORM_ACTION_INSTRUCTIONS = {
    "make_simpler": (
        "Rewrite explanations, definitions, and points in plainer, more accessible language "
        "while keeping every fact, number, term, negation, and equation identical. "
        "Technical terms must remain visible."
    ),
    "eli5": (
        "Rewrite explanations for a complete beginner. Keep every fact and technical term "
        "visible. Any analogy must start with 'Analogy:' and must read as an explanatory "
        "analogy rather than a source fact. Do not add any new factual content."
    ),
    "make_shorter": (
        "Keep only the most essential entries and remove repetition and verbosity. "
        "Do not change, add, or drop any fact other than by omitting whole entries."
    ),
    "make_detailed": (
        "Clarify and reorganize the existing content: expand bullet points into clearer "
        "sentences and improve flow using ONLY facts already present in the reviewer. "
        "Do NOT add new facts, examples, tips, formulas, or quiz points."
    ),
}


def transform_reviewer_gemini(
    reviewer_data: Dict[str, Any],
    action: str = "make_simpler",
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """Genuine AI rewrite of an existing reviewer that preserves factual content."""
    from google import genai
    from google.genai import types

    if action not in TRANSFORM_ACTION_INSTRUCTIONS:
        raise ValueError(f"Unsupported transform action: {action}")

    resolved_key = api_key or os.environ.get("GEMINI_API_KEY")
    if not resolved_key:
        raise ValueError("No Gemini API key provided.")

    client = genai.Client(api_key=resolved_key)

    prompt = f"""Rewrite the study reviewer below according to this transformation:
{TRANSFORM_ACTION_INSTRUCTIONS[action]}

NON-NEGOTIABLE RULES:
- Preserve every fact, name, number, unit, formula, equation, code fragment, term, qualifier, and negation exactly.
- Do not add any factual content that is not already in the reviewer.
- Do not remove factual content except by omitting whole entries (for make_shorter).
- Do not invent examples, analogies (except labeled "Analogy:" for eli5), tips, or quiz facts.
- Return ONLY valid JSON with every top-level key present; use [] for empty sections.

Reviewer JSON:
{json.dumps(reviewer_data, indent=2)}
"""

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=LOW_TEMPERATURE,
        )
    )
    data = _parse_json_value(response.text, {})
    if not isinstance(data, dict) or not data:
        raise ValueError("Transform returned no usable reviewer JSON.")
    return normalize_reviewer(data)


# ---------------------------------------------------------------------------
# Offline extractive fallback (no generation, extraction only)
# ---------------------------------------------------------------------------

SOURCE_MARKER_RE = re.compile(r"^---\s*\[(Page|Slide)\s+(\d+)\]\s*---$")
_MD_HEADING_RE = re.compile(r"^#{1,6}\s+(.+)$")
_BULLET_RE = re.compile(r"^[-*•○▪◦]\s+(.*)$")
_NUMBERED_RE = re.compile(r"^(\d{1,2})[\.\)]\s+(.*)$")

_GENERIC_TERM_STOPLIST = {
    "note", "notes", "example", "examples", "table", "figure", "summary",
    "introduction", "conclusion", "chapter", "section", "slide", "page",
    "title", "contents", "objectives", "objective", "overview", "tip", "tips",
    "warning", "remember", "review", "definition", "important", "exam", "quiz",
    "agenda", "outline", "references", "appendix", "homework", "exercise",
    "exercises", "problem", "problems", "question", "questions", "answer",
    "answers", "lesson", "topic", "topics", "key", "points", "recall",
}

_DEFINITION_PATTERNS = [
    re.compile(r"^(?:#{1,6}\s*)?\*\*([^*]{2,50})\*\*\s*[-–—:]?\s+(.{10,})$"),
    re.compile(
        r"^(?:#{1,6}\s*)?([A-Za-z][A-Za-z0-9 \-/'()]{1,45})\s+is\s+"
        r"(?:defined\s+as\s+|an?\s+|the\s+)?(.{10,})$"
    ),
    re.compile(r"^(?:#{1,6}\s*)?([A-Za-z][A-Za-z0-9 \-/'()]{1,45})\s*[-–—:]\s+(.{10,})$"),
]

_EMPHASIS_RE = re.compile(
    r"\b(?:must|never|always|required|requires?|should|shouldn't|do not|don't|"
    r"avoid|ensure|remember|important|note that|critical|essential|only|not|"
    r"prohibited|forbidden|guarantee)\b",
    re.I,
)

_FORMULA_STOPWORDS = {
    "if", "then", "else", "when", "that", "this", "these", "those", "there",
    "here", "are", "is", "was", "were", "be", "been", "being", "the", "a",
    "an", "and", "or", "but", "not", "for", "with", "to", "of", "in", "on",
    "at", "by", "from", "as", "it", "its", "we", "you", "they", "he", "she",
    "can", "will", "would", "should", "may", "might", "must", "do", "does",
    "did", "have", "has", "had", "because", "therefore", "means", "refers",
    "note", "however", "which", "what", "where", "who", "how", "than", "using",
    "used", "use", "between", "into", "than", "all", "any", "each", "every",
}

_VS_PATTERNS = [
    re.compile(
        r"^(?:#{1,6}\s*)?(?:difference between|comparison (?:between|of)|compare)\s+"
        r"(.+?)\s+(?:vs\.?|versus|and)\s+(.+?)\s*:?$",
        re.I,
    ),
    re.compile(r"^(?:#{1,6}\s*)?(.+?)\s+(?:vs\.?|versus)\s+(.+?)\s*:?$", re.I),
]

_EXAMPLE_RE = re.compile(
    r"^(?:#{1,6}\s*)?(?:for\s+)?(?:example|e\.g\.|sample)(?:\s*\d+)?"
    r"\s*(?:of\s+([A-Za-z0-9 \-/()]{2,60}))?\s*[:.\-–—]\s*(.{12,})$",
    re.I,
)

_LABELLED_EXPR_RE = re.compile(r"^(?:#{1,6}\s*)?([A-Za-z][A-Za-z0-9 \-/ ]{1,39})\s*:\s+(\S.*)$")


def _source_lines(text: str) -> List[Tuple[str, Optional[Dict[str, Any]]]]:
    """Split source text into non-empty lines tagged with their page/slide marker."""
    current: Optional[Dict[str, Any]] = None
    lines: List[Tuple[str, Optional[Dict[str, Any]]]] = []
    for raw in (text or "").splitlines():
        line = raw.strip()
        if not line:
            continue
        marker = SOURCE_MARKER_RE.match(line)
        if marker:
            kind = marker.group(1)
            number = int(marker.group(2))
            current = {
                "type": "page" if kind == "Page" else "slide",
                "index": number,
                "label": f"{kind} {number}",
            }
            continue
        lines.append((line, current))
    return lines


def _sentences(text: str) -> List[str]:
    parts = re.split(r"(?<=[.!?])\s+", text)
    return [part.strip() for part in parts if part.strip()]


def _is_heading(line: str) -> bool:
    if not line:
        return False
    if _MD_HEADING_RE.match(line):
        return True
    if _BULLET_RE.match(line) or _NUMBERED_RE.match(line):
        return False
    if line.startswith(("http://", "https://", "---")):
        return False
    stripped = line.rstrip()
    if 2 < len(stripped) <= 80 and stripped.endswith(":"):
        return True
    if stripped.isupper() and len(stripped) <= 70 and sum(c.isalpha() for c in stripped) >= 4:
        return True
    return False


def _heading_text(line: str) -> str:
    match = _MD_HEADING_RE.match(line)
    text = match.group(1) if match else line
    return text.strip().rstrip(":").strip()[:80]


def _clean_bullet(line: str) -> str:
    match = _BULLET_RE.match(line)
    return (match.group(1) if match else line).strip()


def _looks_like_formula(expression: str) -> bool:
    if not expression or len(expression) > 110:
        return False
    if expression.startswith(("http://", "https://", "---")):
        return False
    if "|" in expression:
        return False
    words = re.findall(r"[A-Za-z]+", expression)
    if any(word.lower() in _FORMULA_STOPWORDS for word in words):
        return False
    if len(words) > 14:
        return False

    has_big_o = bool(re.search(r"\bO\s*\(\s*[A-Za-z0-9]+", expression))
    has_symbol = any(sym in expression for sym in ("≈", "≤", "≥", "∑", "√", "∫", "→", "∆", "π", "µ"))
    has_caret = bool(re.search(r"[A-Za-z0-9\)]\s*\^|\^\s*[0-9A-Za-z]", expression))
    has_equals = "=" in expression

    if has_big_o:
        return True
    if has_equals and (has_symbol or has_caret):
        return True
    if has_equals and re.search(r"[A-Za-z0-9\)]\s*=\s*\S", expression) and len(words) <= 10:
        return True
    if has_symbol and len(words) <= 6:
        return True
    return False


def _extract_title(lines: List[Tuple[str, Optional[Dict[str, Any]]]], filename: str) -> str:
    title = filename.replace("_", " ").replace("-", " ").strip() or "Study Material"
    for line, _ref in lines[:5]:
        if len(line) < 60 and not line.startswith("http") and not _BULLET_RE.match(line):
            candidate = _heading_text(line)
            if len(candidate) > 3:
                return candidate
    return title


def _detect_subject(text: str) -> str:
    text_lower = (text or "").lower()
    cs_terms = ["algorithm", "data structure", "cpu", "memory", "function", "variable",
                "code", "sql", "network", "software", "semaphore", "thread", "process"]
    bio_terms = ["cell", "dna", "protein", "organism", "mitochondria", "photosynthesis",
                 "species", "biology"]
    physics_terms = ["velocity", "force", "energy", "mass", "gravity", "electric",
                     "circuit", "equation"]
    if any(term in text_lower for term in cs_terms):
        return "Computer Science / IT"
    if any(term in text_lower for term in bio_terms):
        return "Biological Sciences"
    if any(term in text_lower for term in physics_terms):
        return "Physics & Engineering"
    return "General Academic Review"


def _extract_keywords(lines, limit: int) -> List[Dict[str, Any]]:
    keywords: List[Dict[str, Any]] = []
    seen = set()
    for line, ref in lines:
        if len(keywords) >= limit:
            break
        if _is_heading(line):
            continue
        for pattern in _DEFINITION_PATTERNS:
            match = pattern.match(line)
            if not match:
                continue
            term = match.group(1).strip().strip("*").strip()
            definition = match.group(2).strip()
            term = re.sub(r"^(?:A|An|The)\s+", "", term)
            if term:
                term = term[0].upper() + term[1:]
            if term.lower() in _GENERIC_TERM_STOPLIST:
                break
            if not (1 < len(term) < 45) or term.lower() in seen:
                break
            if len(definition) < 10:
                break
            seen.add(term.lower())
            entry = {
                "term": term,
                "definition": definition[:220] + ("..." if len(definition) > 220 else ""),
                "importance": "high" if len(keywords) < 3 else "medium",
            }
            if ref:
                entry["sources"] = [ref]
            keywords.append(entry)
            break
    return keywords


def _extract_important_sentences(lines, min_len: int = 30, max_len: int = 300):
    results = []
    seen = set()
    for line, ref in lines:
        if _is_heading(line) or line.startswith(("http://", "https://")):
            continue
        if _NUMBERED_RE.match(_clean_bullet(line)):
            continue
        for sentence in _sentences(_clean_bullet(line)):
            if not (min_len <= len(sentence) <= max_len):
                continue
            if sentence.endswith(":") or "|" in sentence:
                continue
            key = sentence.lower()
            if key in seen:
                continue
            seen.add(key)
            results.append((sentence, ref))
    return results


def _extract_rule_sentences(lines, limit: int):
    rules = []
    seen = set()
    for line, ref in lines:
        if len(rules) >= limit:
            break
        if _is_heading(line) or line.startswith(("http://", "https://")):
            continue
        for sentence in _sentences(_clean_bullet(line)):
            if len(rules) >= limit:
                break
            if not (25 <= len(sentence) <= 300):
                continue
            if "|" in sentence or sentence.endswith(":"):
                continue
            if not _EMPHASIS_RE.search(sentence):
                continue
            key = sentence.lower()
            if key in seen:
                continue
            seen.add(key)
            entry = {"text": sentence}
            if ref:
                entry["sources"] = [ref]
            rules.append(entry)
    return rules


def _heading_groups(lines):
    groups = []
    current = None
    for line, ref in lines:
        if _is_heading(line):
            if current is not None:
                groups.append(current)
            current = {"heading": _heading_text(line), "body": [], "ref": ref}
        elif current is not None:
            current["body"].append((line, ref))
    if current is not None:
        groups.append(current)
    return [group for group in groups if group["heading"] and group["body"]]


def _extract_concepts(lines, keywords, limit: int) -> List[Dict[str, Any]]:
    concepts: List[Dict[str, Any]] = []
    for group in _heading_groups(lines):
        if len(concepts) >= limit:
            break
        body_lines = [line for line, _ref in group["body"]]
        explanation_text = ""
        for body_line in body_lines:
            if "|" in body_line:
                continue
            cleaned = _clean_bullet(body_line)
            if _NUMBERED_RE.match(cleaned) or _EXAMPLE_RE.match(cleaned):
                continue
            candidate_sentences = [s for s in _sentences(cleaned) if len(s) >= 15]
            if candidate_sentences:
                explanation_text = candidate_sentences[0][:300]
                break
            if len(cleaned) >= 15:
                explanation_text = cleaned[:300]
                break
        points = []
        for line in body_lines:
            bullet = _BULLET_RE.match(line)
            if bullet and "|" not in line:
                points.append(bullet.group(1).strip()[:300])
            if len(points) >= 4:
                break
        if not explanation_text and not points:
            continue
        entry = {
            "concept": group["heading"],
            "explanation": explanation_text,
            "points": points,
        }
        if group["ref"]:
            entry["sources"] = [group["ref"]]
        concepts.append(entry)

    # Supplement with source definitions when headings alone are too sparse.
    known = {concept["concept"].lower() for concept in concepts}
    for keyword in keywords:
        if len(concepts) >= limit:
            break
        if keyword["term"].lower() in known:
            continue
        known.add(keyword["term"].lower())
        entry = {
            "concept": keyword["term"],
            "explanation": keyword["definition"],
            "points": [],
        }
        if keyword.get("sources"):
            entry["sources"] = keyword["sources"]
        concepts.append(entry)
    return concepts


def _extract_processes(lines) -> List[Dict[str, Any]]:
    processes: List[Dict[str, Any]] = []
    run: List[Dict[str, Any]] = []
    pending_heading: Optional[str] = None
    pending_ref: Optional[Dict[str, Any]] = None

    def flush():
        nonlocal run
        if len(run) >= 2:
            title = pending_heading
            if not title:
                label = run[0].get("ref", {}).get("label") if run[0].get("ref") else None
                title = f"Numbered Steps ({label})" if label else "Numbered Steps"
            steps = []
            for item in run:
                content = item["content"]
                step_title = ""
                description = content
                if ":" in content:
                    prefix, remainder = content.split(":", 1)
                    if 0 < len(prefix.strip()) <= 50 and remainder.strip():
                        step_title = prefix.strip()
                        description = remainder.strip()
                if not step_title:
                    step_title = f"Step {item['number']}"
                steps.append({
                    "step_number": item["number"],
                    "title": step_title,
                    "description": description[:600],
                })
            entry = {"process_title": title[:200], "steps": steps}
            refs = [step_ref for step_ref in (item.get("ref") for item in run) if step_ref]
            if refs:
                entry["sources"] = refs[:5]
            processes.append(entry)
        run = []

    for line, ref in lines:
        if len(processes) >= 5:
            break
        numbered = _NUMBERED_RE.match(line)
        if numbered and numbered.group(2).strip():
            run.append({"number": int(numbered.group(1)), "content": numbered.group(2).strip(), "ref": ref})
            continue
        flush()
        if _is_heading(line):
            pending_heading = _heading_text(line)
            pending_ref = ref
    flush()
    return processes


def _extract_formulas(lines, limit: int) -> List[Dict[str, Any]]:
    formulas: List[Dict[str, Any]] = []
    seen = set()
    pending_heading: Optional[str] = None
    for line, ref in lines:
        if len(formulas) >= limit:
            break
        if _is_heading(line):
            pending_heading = _heading_text(line)
            continue
        for candidate_sentence in _sentences(_clean_bullet(line)):
            if len(formulas) >= limit:
                break
            candidate = candidate_sentence.strip()
            label = None
            expression = candidate
            label_match = _LABELLED_EXPR_RE.match(candidate)
            if label_match and len(label_match.group(1).split()) <= 4:
                label = label_match.group(1).strip()
                expression = label_match.group(2).strip()

            if not _looks_like_formula(expression):
                continue
            expression = expression.rstrip().rstrip(".").rstrip()
            if not expression:
                continue

            key = expression.lower()
            if key in seen:
                continue
            seen.add(key)

            name = label or pending_heading or "Formula"
            entry = {
                "name": name[:200],
                "formula": expression[:400],
                "variables": [],
                "when_to_use": "",
                "example": "",
            }
            if ref:
                entry["sources"] = [ref]
            formulas.append(entry)
    return formulas


def _extract_comparisons(lines, limit: int) -> List[Dict[str, Any]]:
    comparisons: List[Dict[str, Any]] = []
    index = 0
    while index < len(lines) and len(comparisons) < limit:
        line, ref = lines[index]
        concept_a = concept_b = None
        for pattern in _VS_PATTERNS:
            match = pattern.match(line)
            if match:
                candidate_a = match.group(1).strip().strip("*").strip()[:60]
                candidate_b = match.group(2).strip().strip("*").strip()[:60]
                if candidate_a and candidate_b and "|" not in line:
                    concept_a, concept_b = candidate_a, candidate_b
                break
        if not concept_a:
            index += 1
            continue

        aspects = []
        cursor = index + 1
        while cursor < len(lines) and len(aspects) < 12:
            row_line, _row_ref = lines[cursor]
            if _is_heading(row_line) or _VS_PATTERNS[1].match(row_line):
                break
            cells = [cell.strip() for cell in row_line.split("|")] if "|" in row_line else []
            if len(cells) >= 3 and cells[1].lower() not in {concept_a.lower(), concept_b.lower()}:
                aspects.append({"aspect": cells[0][:120], "a_val": cells[1][:400], "b_val": cells[2][:400]})
            else:
                labelled = re.match(r"^(.+?):\s*(.+?)\s*\|\s*(.+)$", row_line)
                if labelled:
                    aspects.append({
                        "aspect": labelled.group(1).strip()[:120],
                        "a_val": labelled.group(2).strip()[:400],
                        "b_val": labelled.group(3).strip()[:400],
                    })
            cursor += 1

        if aspects:
            entry = {"concept_a": concept_a, "concept_b": concept_b, "aspects": aspects}
            if ref:
                entry["sources"] = [ref]
            comparisons.append(entry)
        index += 1
    return comparisons


def _extract_examples(lines, title: str, limit: int) -> List[Dict[str, Any]]:
    examples: List[Dict[str, Any]] = []
    seen = set()
    pending_heading: Optional[str] = None
    for line, ref in lines:
        if len(examples) >= limit:
            break
        if _is_heading(line):
            pending_heading = _heading_text(line)
            continue
        match = _EXAMPLE_RE.match(_clean_bullet(line))
        if not match:
            continue
        concept = (match.group(1) or pending_heading or title).strip()
        example = match.group(2).strip()
        key = example.lower()
        if key in seen:
            continue
        seen.add(key)
        entry = {
            "concept": concept[:200],
            "example": example[:600],
            "explanation": "",
        }
        if ref:
            entry["sources"] = [ref]
        examples.append(entry)
    return examples


def _extract_quiz_points(keywords, formulas, limit: int) -> List[Dict[str, Any]]:
    points: List[Dict[str, Any]] = []
    for keyword in keywords:
        if len(points) >= limit:
            break
        entry = {
            "question_clue": f"What is the definition of '{keyword['term']}'?",
            "key_fact": keyword["definition"],
            "question_type": "multiple_choice",
        }
        if keyword.get("sources"):
            entry["sources"] = keyword["sources"]
        points.append(entry)
    for formula in formulas:
        if len(points) >= limit:
            break
        if formula["name"] in {"Formula"}:
            continue
        entry = {
            "question_clue": f"State the formula for {formula['name']}.",
            "key_fact": formula["formula"],
            "question_type": "identification",
        }
        if formula.get("sources"):
            entry["sources"] = formula["sources"]
        points.append(entry)
    return points


def _compress_sections(sections: Dict[str, Any], compression: str) -> Dict[str, Any]:
    limits = {
        "quick": {
            "quick_review": 3, "keywords": 4, "core_concepts": 3, "must_remember": 3,
            "compare": 1, "process_steps": 2, "formulas_rules": 3, "examples": 1,
            "possible_quiz_points": 2,
        },
        "standard": {
            "quick_review": 5, "keywords": 8, "core_concepts": 4, "must_remember": 4,
            "compare": 2, "process_steps": 3, "formulas_rules": 5, "examples": 3,
            "possible_quiz_points": 4,
        },
        "detailed": {
            "quick_review": 7, "keywords": 12, "core_concepts": 6, "must_remember": 5,
            "compare": 3, "process_steps": 5, "formulas_rules": 8, "examples": 5,
            "possible_quiz_points": 5,
        },
    }
    active = limits.get(compression, limits["standard"])
    for name, cap in active.items():
        if isinstance(sections.get(name), list):
            sections[name] = sections[name][:cap]
    return sections


def local_fallback_synthesizer(
    text: str,
    filename: str = "Study Material",
    compression: str = "standard",
    tone: str = "standard"
) -> Dict[str, Any]:
    """Offline EXTRACTIVE engine.

    It only extracts what the source actually contains (definitions, important
    sentences, headings, explicit numbered steps, explicit formulas, explicit
    comparisons, explicit examples, repeated terminology). It never generates
    content, and unsupported sections stay empty.
    """
    compression = compression if compression in {"quick", "standard", "detailed"} else "standard"
    # `tone` is intentionally unused: rewriting text is not extraction.

    lines = _source_lines(text)
    title = _extract_title(lines, filename)
    subject = _detect_subject(text)

    keywords = _extract_keywords(lines, limit=12)
    important = _extract_important_sentences(lines)
    quick_review = [sentence for sentence, _ref in important[:5]]

    must_remember = _extract_rule_sentences(lines, limit=5)
    core_concepts = _extract_concepts(lines, keywords, limit=6)
    process_steps = _extract_processes(lines)
    formulas_rules = _extract_formulas(lines, limit=5)
    compare = _extract_comparisons(lines, limit=2)
    examples = _extract_examples(lines, title, limit=3)
    possible_quiz_points = _extract_quiz_points(keywords, formulas_rules, limit=4)

    one_minute_parts = [
        f"{keyword['term']}: {keyword['definition']}".rstrip(".")
        for keyword in keywords[:3]
    ]
    if quick_review:
        one_minute_parts.append(quick_review[0])
    one_minute_review = ". ".join(one_minute_parts)[:700]

    sections = _compress_sections({
        "quick_review": quick_review,
        "keywords": keywords,
        "core_concepts": core_concepts,
        "must_remember": must_remember,
        "compare": compare,
        "process_steps": process_steps,
        "formulas_rules": formulas_rules,
        "examples": examples,
        "possible_quiz_points": possible_quiz_points,
    }, compression)

    reviewer = {
        "subject": subject,
        "lesson_title": title,
        "one_minute_review": one_minute_review,
        **sections,
    }
    return normalize_reviewer(reviewer)


def local_fallback_quiz_generator(
    reviewer_data: Dict[str, Any],
    question_count: int = 10,
    question_type: str = "mixed"
) -> List[Dict[str, Any]]:
    """Offline quiz builder. Uses ONLY reviewer content; never pads with filler."""
    if not isinstance(reviewer_data, dict):
        return []
    reviewer = normalize_reviewer(reviewer_data)

    keywords = [
        keyword for keyword in reviewer["keywords"]
        if len(keyword.get("definition", "")) >= 15
    ]
    definitions = []
    for keyword in keywords:
        if keyword["definition"] not in definitions:
            definitions.append(keyword["definition"])

    questions: List[Dict[str, Any]] = []
    used_terms = set()
    wanted = max(1, int(question_count))

    # 1. Multiple choice: only when real distractors exist in the reviewer.
    if question_type in ("mixed", "multiple_choice") and len(definitions) >= 4:
        for keyword in keywords:
            if len(questions) >= wanted:
                break
            correct = keyword["definition"]
            distractors = [definition for definition in definitions if definition != correct][:3]
            if len(distractors) < 3:
                continue
            options = [correct] + distractors
            shift = len(questions) % len(options)
            options = options[shift:] + options[:shift]
            questions.append({
                "id": len(questions) + 1,
                "type": "multiple_choice",
                "question": f"Which statement best defines '{keyword['term']}'?",
                "options": options,
                "correct_answer": correct,
                "explanation": f"The reviewer defines '{keyword['term']}' as: {correct}",
                "topic": keyword["term"],
            })
            used_terms.add(keyword["term"])

    # 2. Identification: direct term recall from reviewer definitions.
    if question_type in ("mixed", "identification"):
        for keyword in keywords:
            if len(questions) >= wanted:
                break
            if keyword["term"] in used_terms:
                continue
            questions.append({
                "id": len(questions) + 1,
                "type": "identification",
                "question": f"Identify the term described: '{keyword['definition']}'",
                "options": [],
                "correct_answer": keyword["term"],
                "explanation": f"In this lesson, '{keyword['term']}' matches that definition.",
                "topic": keyword["term"],
            })
            used_terms.add(keyword["term"])

    # 3. True/false: only from statements already present in the reviewer.
    if question_type in ("mixed", "true_false"):
        statements = [entry["text"] for entry in reviewer["must_remember"]]
        statements += list(reviewer["quick_review"])
        seen_statements = set()
        for statement in statements:
            if len(questions) >= wanted:
                break
            if not (25 <= len(statement) <= 240):
                continue
            key = statement.lower()
            if key in seen_statements:
                continue
            seen_statements.add(key)
            questions.append({
                "id": len(questions) + 1,
                "type": "true_false",
                "question": f"True or False: {statement}",
                "options": ["True", "False"],
                "correct_answer": "True",
                "explanation": "This statement appears verbatim in the source-grounded reviewer.",
                "topic": "Key Facts",
            })

    for position, question in enumerate(questions, start=1):
        question["id"] = position
    return questions[:wanted]
