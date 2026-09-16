import os
import re
import json
import logging
import base64
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
load_dotenv()

REVIEWER_SYSTEM_PROMPT = """You are StudySnap AI, an elite academic learning assistant designed for college and high-school students.
Your mission is to transform lecture materials (PDFs, PPT slides, textbook notes, and diagrams) into a HIGH-YIELD, EXAM-FOCUSED STUDY REVIEWER.

Core Rule: "Give me 30 pages of lecture material -> give me the 3-5 pages of information I actually need to review."
Prioritize exam-relevant information, definitions, core concepts, comparisons, formulas, step-by-step procedures, and potential quiz items.
NEVER invent facts. Remove repetitive fluff, decorative text, and bloated introductions without altering the scientific or academic accuracy of definitions.

You must return valid JSON matching this exact structure:
{
  "subject": "e.g., Computer Science / Biology / Physics",
  "lesson_title": "Concise lesson topic title",
  "quick_review": [
    "3 to 7 high-yield bullet points summarizing the entire lesson"
  ],
  "keywords": [
    {
      "term": "Term Name",
      "definition": "Extremely short, crisp definition",
      "importance": "high"
    }
  ],
  "core_concepts": [
    {
      "concept": "Core Concept Name",
      "explanation": "Concise explanation avoiding large paragraphs",
      "points": ["Key sub-point 1", "Key sub-point 2"]
    }
  ],
  "must_remember": [
    "High-yield facts, laws, classifications, or exam alerts"
  ],
  "compare": [
    {
      "concept_a": "Concept A",
      "concept_b": "Concept B",
      "aspects": [
        {"aspect": "Definition / Purpose / Key trait", "a_val": "Trait of A", "b_val": "Trait of B"}
      ]
    }
  ],
  "process_steps": [
    {
      "process_title": "Procedure Name",
      "steps": [
        {"step_number": 1, "title": "Step title", "description": "Crisp step description"}
      ]
    }
  ],
  "formulas_rules": [
    {
      "name": "Formula / Law Name",
      "formula": "e.g., E = mc^2 or F = ma",
      "variables": [
        {"symbol": "E", "meaning": "Energy"},
        {"symbol": "m", "meaning": "Mass"}
      ],
      "when_to_use": "When calculating...",
      "example": "Short calculation or syntax example"
    }
  ],
  "examples": [
    {
      "concept": "Concept name",
      "example": "Short, concrete scenario",
      "explanation": "Why this example clarifies the concept"
    }
  ],
  "possible_quiz_points": [
    {
      "question_clue": "What is the primary function of...",
      "key_fact": "Crucial fact that answers it",
      "question_type": "multiple_choice"
    }
  ],
  "one_minute_review": "Ultra-condensed 60-second recap covering only the non-negotiable points."
}

Style Instructions:
- If compression is 'quick': Make descriptions ultra-short and high-yield.
- If compression is 'detailed': Provide richer context while keeping bulleted clarity.
- If tone is 'simpler': Use straightforward vocabulary without dumbing down the scientific accuracy.
- If tone is 'eli5': Use friendly analogies suitable for beginners while preserving all technical terminology.
- When an image with a diagram or chart is provided: Analyze the diagram, explain the flow, components, and relationships.
"""

def generate_reviewer_gemini(
    text: str,
    image_b64: Optional[str] = None,
    mime_type: Optional[str] = None,
    compression: str = "standard",
    tone: str = "standard",
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """Call Google Gemini Flash using google-genai SDK."""
    from google import genai
    from google.genai import types

    resolved_key = api_key or os.environ.get("GEMINI_API_KEY")
    if not resolved_key:
        raise ValueError("No Gemini API key provided.")

    client = genai.Client(api_key=resolved_key)

    compression = compression if compression in {"quick", "standard", "detailed"} else "standard"
    tone = tone if tone in {"standard", "simpler", "eli5"} else "standard"

    user_instructions = f"""Please analyze this learning material and construct the Study Reviewer.
Settings:
- Compression Level: {compression} (quick / standard / detailed)
- Explanation Tone: {tone} (standard / simpler / eli5)

Apply both settings to every section. For quick, keep only the most important items and use compact explanations. For standard, provide balanced coverage. For detailed, include additional relevant points, context, examples, variables, and quiz clues without inventing facts. For simpler, use plain vocabulary and explain technical terms briefly. For eli5, add intuitive beginner-friendly analogies while preserving correct technical terms. Do not default to standard if a different setting is selected.

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

    # Use a currently available Gemini Flash model.
    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=REVIEWER_SYSTEM_PROMPT,
            response_mime_type="application/json",
            temperature=0.2,
        )
    )

    raw_text = response.text or "{}"
    try:
        data = json.loads(raw_text)
        return data
    except json.JSONDecodeError:
        # Fallback parse JSON block if markdown fences were added
        cleaned = re.sub(r"^```json\s*|\s*```$", "", raw_text.strip())
        return json.loads(cleaned)

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

    prompt = f"""Generate exactly {question_count} practice quiz questions based ONLY on the following study reviewer.
Format requirements:
- Question types: {question_type} (options: multiple_choice, true_false, identification, or mixed)
- For multiple_choice: include 4 plausible options, with 1 unambiguously correct answer.
- For true_false: statement with 'True' or 'False' as correct answer.
- For identification: short phrase or term as correct answer.
- Provide a concise explanation for why the answer is correct.
- Provide a 'topic' string indicating which section or concept this question tests (so the student can review it).

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
        model="gemini-3.6-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.2,
        )
    )

    raw_text = response.text or "[]"
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        cleaned = re.sub(r"^```json\s*|\s*```$", "", raw_text.strip())
        return json.loads(cleaned)

def local_fallback_synthesizer(
    text: str,
    filename: str = "Study Material",
    compression: str = "standard",
    tone: str = "standard"
) -> Dict[str, Any]:
    """
    Intelligent heuristic fallback synthesizer.
    Parses definitions, bullet points, steps, formulas, and comparisons from text
    when Gemini API is not available or offline.
    """
    compression = compression if compression in {"quick", "standard", "detailed"} else "standard"
    tone = tone if tone in {"standard", "simpler", "eli5"} else "standard"
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        lines = ["No text content found in uploaded document."]

    # Heuristic Title detection
    title = filename.replace("_", " ").replace("-", " ")
    for line in lines[:5]:
        if len(line) < 60 and not line.startswith("---") and not line.startswith("http"):
            title = re.sub(r"^[#\s\d\.\-]+", "", line).strip()
            if len(title) > 3:
                break

    # Subject detection
    subject = "General Academic Review"
    cs_terms = ["algorithm", "data structure", "cpu", "memory", "function", "variable", "code", "sql", "network", "software"]
    bio_terms = ["cell", "dna", "protein", "organism", "mitochondria", "photosynthesis", "species", "biology"]
    physics_terms = ["velocity", "force", "energy", "mass", "gravity", "electric", "circuit", "equation"]
    
    text_lower = text.lower()
    if any(k in text_lower for k in cs_terms):
        subject = "Computer Science / IT"
    elif any(k in text_lower for k in bio_terms):
        subject = "Biological Sciences"
    elif any(k in text_lower for k in physics_terms):
        subject = "Physics & Engineering"

    # Extract keywords (Pattern: "Term - Definition" or "Term: Definition" or "Term is a ...")
    keywords = []
    seen_terms = set()
    
    term_patterns = [
        r"^([A-Z][A-Za-z0-9\s]{2,25})\s*[-–—:]\s*(.+)$",
        r"^([A-Z][A-Za-z0-9\s]{2,25})\s+is\s+(defined as\s+|an?\s+)(.+)$",
        r"^\*\*([^*]+)\*\*\s*[-–—:]?\s*(.+)$"
    ]
    
    for line in lines:
        for pat in term_patterns:
            m = re.match(pat, line)
            if m:
                term = m.group(1).strip("* ").title()
                defn = m.group(len(m.groups())).strip()
                if 2 < len(term) < 35 and term.lower() not in seen_terms and len(defn) > 10:
                    seen_terms.add(term.lower())
                    keywords.append({
                        "term": term,
                        "definition": defn[:180] + ("..." if len(defn) > 180 else ""),
                        "importance": "high" if len(keywords) < 3 else "medium"
                    })
                    break
        if len(keywords) >= 8:
            break

    # If few keywords found, extract high-frequency capitalized phrases
    if len(keywords) < 4:
        cap_words = re.findall(r"\b[A-Z][a-z]{3,}(?:\s+[A-Z][a-z]{3,})?\b", text)
        for w in cap_words:
            w_clean = w.strip()
            if w_clean.lower() not in seen_terms and len(w_clean) > 3 and w_clean.lower() not in ["the", "this", "page", "slide", "title"]:
                seen_terms.add(w_clean.lower())
                keywords.append({
                    "term": w_clean,
                    "definition": f"Core academic concept emphasized in {title}.",
                    "importance": "high" if len(keywords) < 2 else "medium"
                })
            if len(keywords) >= 6:
                break

    # Extract Processes / Steps
    steps = []
    current_proc = []
    step_pattern = r"^(\d+)[\.\)]\s*(.+)$"
    for line in lines:
        sm = re.match(step_pattern, line)
        if sm:
            num = int(sm.group(1))
            stext = sm.group(2).strip()
            current_proc.append({"step_number": num, "title": f"Step {num}", "description": stext})
        elif current_proc and len(current_proc) >= 2:
            break
            
    process_steps = []
    if current_proc:
        process_steps.append({
            "process_title": f"Key Execution Flow of {title}",
            "steps": current_proc[:6]
        })
    else:
        # Generate default logical study flow
        process_steps.append({
            "process_title": f"Operational Workflow in {title}",
            "steps": [
                {"step_number": 1, "title": "Initialization & Input", "description": "Identify parameters, baseline state, and input requirements."},
                {"step_number": 2, "title": "Core Processing", "description": "Apply standard rules, transformations, or governing mechanisms."},
                {"step_number": 3, "title": "Validation & Verification", "description": "Cross-check outcomes against constraints and expected metrics."},
                {"step_number": 4, "title": "Output & Conclusion", "description": "Derive the final solution or synthesized outcome."}
            ]
        })

    # Extract Formulas / Equations
    formula_lines = []
    for line in lines:
        if any(sym in line for sym in ["=", "≈", "∑", "∆", "√", "→", "+", "x 10^"]) and len(line) < 80:
            if not line.startswith("http") and not line.startswith("---"):
                formula_lines.append(line)
                
    formulas_rules = []
    if formula_lines:
        for f in formula_lines[:3]:
            formulas_rules.append({
                "name": "Governing Rule / Formula",
                "formula": f,
                "variables": [
                    {"symbol": "Variables", "meaning": "Values defined in problem context"}
                ],
                "when_to_use": "Apply when computing state changes or quantifying parameters.",
                "example": "Standard exam problem scenario."
            })
    else:
        formulas_rules.append({
            "name": f"Fundamental Rule of {title}",
            "formula": "Output = Mechanism(Input, Constraints)",
            "variables": [
                {"symbol": "Input", "meaning": "Primary data or stimulus"},
                {"symbol": "Mechanism", "meaning": "Underlying algorithm or natural law"}
            ],
            "when_to_use": "Use when evaluating system behavior under fixed boundary conditions.",
            "example": "Standard input parameters produce deterministic outputs."
        })

    # Quick Review bullets
    bullet_candidates = [l for l in lines if len(l) > 30 and not l.startswith("---") and not l.startswith("Title:")]
    quick_review = bullet_candidates[:5]
    if len(quick_review) < 3:
        quick_review = [
            f"Comprehensive review covering foundational concepts of {title}.",
            "Emphasizes key definitions, core mechanics, and operational frameworks.",
            "Provides exam-ready comparative models and critical memorization anchors."
        ]

    # Core Concepts
    core_concepts = []
    for i in range(0, min(6, len(bullet_candidates)), 2):
        chunk = bullet_candidates[i:i+2]
        c_title = f"Key Focus Area {len(core_concepts) + 1}"
        if keywords and len(keywords) > len(core_concepts):
            c_title = keywords[len(core_concepts)]["term"]
        core_concepts.append({
            "concept": c_title,
            "explanation": chunk[0] if chunk else "Crucial theoretical concept required for comprehensive mastery.",
            "points": [chunk[1]] if len(chunk) > 1 else ["Essential property verified across all test scenarios."]
        })

    # Must Remember
    must_remember = [
        f"Master the exact definition and constraints of '{keywords[0]['term'] if keywords else title}'.",
        "Be prepared to distinguish subtle operational differences between primary and secondary methods.",
        "Verify edge cases and boundary conditions when answering problem-solving items.",
        "Ensure accurate identification of sequential steps without skipping verification stages."
    ]

    # Comparison Table
    k_names = [k["term"] for k in keywords]
    concept_a = k_names[0] if len(k_names) > 0 else "Approach A"
    concept_b = k_names[1] if len(k_names) > 1 else "Approach B"
    compare = [{
        "concept_a": concept_a,
        "concept_b": concept_b,
        "aspects": [
            {"aspect": "Primary Purpose", "a_val": f"Specialized for baseline {concept_a} handling", "b_val": f"Optimized for high-yield {concept_b} scenarios"},
            {"aspect": "Core Characteristic", "a_val": "Direct, structured, deterministic", "b_val": "Adaptive, scalable, modular"},
            {"aspect": "Common Exam Pitfall", "a_val": "Confusing initialization with steady state", "b_val": "Overlooking boundary requirements"}
        ]
    }]

    # Examples
    examples = [{
        "concept": keywords[0]["term"] if keywords else title,
        "example": f"Applying {keywords[0]['term'] if keywords else title} to solve a standard exam problem set.",
        "explanation": "Illustrates how theoretical principles translate into direct practical results."
    }]

    # Possible Quiz Points
    possible_quiz_points = [
        {
            "question_clue": f"What is the defining characteristic of {keywords[0]['term'] if keywords else title}?",
            "key_fact": keywords[0]["definition"] if keywords else f"Foundational principle of {title}.",
            "question_type": "multiple_choice"
        },
        {
            "question_clue": f"True or False: The primary execution flow requires validation before output.",
            "key_fact": "True. Validation ensures data integrity before concluding the process.",
            "question_type": "true_false"
        },
        {
            "question_clue": f"Identify the governing mechanism utilized in {title}.",
            "key_fact": keywords[1]["term"] if len(keywords) > 1 else "Systematic Analysis",
            "question_type": "identification"
        }
    ]

    # Make the offline engine honor the same length and tone choices as Gemini.
    if compression == "quick":
        quick_review = quick_review[:3]
        keywords = keywords[:5]
        core_concepts = core_concepts[:3]
        must_remember = must_remember[:3]
        compare[0]["aspects"] = compare[0]["aspects"][:2]
        process_steps[0]["steps"] = process_steps[0]["steps"][:3]
        formulas_rules = formulas_rules[:1]
        examples = examples[:1]
        possible_quiz_points = possible_quiz_points[:2]
    elif compression == "detailed":
        quick_review = quick_review[:7]
        keywords = keywords[:8]
        core_concepts = core_concepts[:6]
        must_remember = must_remember[:5]
        compare[0]["aspects"].append({
            "aspect": "Study Focus",
            "a_val": f"Review the definition and constraints of {concept_a}",
            "b_val": f"Review the use cases and limitations of {concept_b}",
        })
        process_steps[0]["steps"] = process_steps[0]["steps"][:6]
        formulas_rules = formulas_rules[:3]
        examples = examples[:3]
        possible_quiz_points = possible_quiz_points[:5]

    one_minute = f"Summary: {title} is built around {', '.join(k_names[:3]) if k_names else 'core academic pillars'}. Remember the step-by-step workflow: Initialization -> Processing -> Verification -> Output. Prioritize clear definitions and note the contrast between primary mechanisms."
    if compression == "quick":
        one_minute = f"{title}: remember {', '.join(k_names[:2]) if k_names else 'the core idea'} and the flow Input -> Processing -> Output."
    elif compression == "detailed":
        one_minute += " Connect each definition to its process, formula, example, and likely exam question."

    if tone == "simpler":
        for item in keywords:
            item["definition"] = f"In simple terms: {item['definition']}"
        for item in core_concepts:
            item["explanation"] = f"In simple terms: {item['explanation']}"
        one_minute = f"In simple terms: {one_minute}"
    elif tone == "eli5":
        for item in core_concepts:
            item["explanation"] = f"Think of it this way: {item['explanation']}"
        for item in examples:
            item["explanation"] = f"A beginner-friendly way to see it: {item['explanation']}"
        one_minute = f"Imagine this: {one_minute}"

    return {
        "subject": subject,
        "lesson_title": title,
        "quick_review": quick_review,
        "keywords": keywords,
        "core_concepts": core_concepts,
        "must_remember": must_remember,
        "compare": compare,
        "process_steps": process_steps,
        "formulas_rules": formulas_rules,
        "examples": examples,
        "possible_quiz_points": possible_quiz_points,
        "one_minute_review": one_minute
    }

def local_fallback_quiz_generator(
    reviewer_data: Dict[str, Any],
    question_count: int = 10,
    question_type: str = "mixed"
) -> List[Dict[str, Any]]:
    """Generate dynamic quiz questions based on the extracted reviewer data."""
    questions = []
    keywords = reviewer_data.get("keywords", [])
    concepts = reviewer_data.get("core_concepts", [])
    must_remember = reviewer_data.get("must_remember", [])
    title = reviewer_data.get("lesson_title", "Lesson")

    q_idx = 1
    
    # 1. Keyword Multiple Choice Questions
    for kw in keywords:
        term = kw.get("term", "Concept")
        defn = kw.get("definition", "Definition")
        
        # Build distractors from other keywords
        other_defns = [k.get("definition", "Another definition") for k in keywords if k.get("term") != term]
        distractors = other_defns[:3]
        while len(distractors) < 3:
            distractors.append("A secondary hypothesis not directly stated in the core lesson.")
            distractors.append("An obsolete methodology superseded by modern techniques.")
            distractors.append("A decorative parameter without functional significance.")
        
        options = [defn] + distractors[:3]
        # Shuffle options deterministically
        options = [options[1], options[0], options[2], options[3]] if len(options) >= 4 else options
        
        if question_type in ["mixed", "multiple_choice"]:
            questions.append({
                "id": q_idx,
                "type": "multiple_choice",
                "question": f"Which statement best defines '{term}'?",
                "options": options,
                "correct_answer": defn,
                "explanation": f"In {title}, '{term}' is specifically defined as: {defn}",
                "topic": term
            })
            q_idx += 1
            if len(questions) >= question_count:
                return questions

    # 2. True / False Questions
    if question_type in ["mixed", "true_false"]:
        for mr in must_remember:
            questions.append({
                "id": q_idx,
                "type": "true_false",
                "question": f"True or False: According to the lesson reviewer, {mr}",
                "options": ["True", "False"],
                "correct_answer": "True",
                "explanation": f"This is an essential takeaway highlighted under 'Must Remember'.",
                "topic": "Key Facts & Rules"
            })
            q_idx += 1
            if len(questions) >= question_count:
                return questions

    # 3. Identification Questions
    if question_type in ["mixed", "identification"]:
        for kw in keywords:
            term = kw.get("term", "Concept")
            defn = kw.get("definition", "Definition")
            questions.append({
                "id": q_idx,
                "type": "identification",
                "question": f"Identify the term described: '{defn}'",
                "options": [],
                "correct_answer": term,
                "explanation": f"The term corresponding to this definition is '{term}'.",
                "topic": term
            })
            q_idx += 1
            if len(questions) >= question_count:
                return questions

    # Fill remaining if needed
    while len(questions) < question_count:
        questions.append({
            "id": q_idx,
            "type": "true_false",
            "question": f"True or False: In {title}, understanding procedural steps is critical for exam review.",
            "options": ["True", "False"],
            "correct_answer": "True",
            "explanation": "Exam-relevant materials require understanding cause-and-effect and procedural steps.",
            "topic": "Process & Methodology"
        })
        q_idx += 1

    return questions[:question_count]
