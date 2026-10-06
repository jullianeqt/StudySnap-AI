import os
import re
import json
import uuid
import datetime
from io import BytesIO
from flask import Flask, request, jsonify
from flask import send_file
from flask_cors import CORS
from dotenv import load_dotenv
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from extractors import process_file_input
from ai_engine import (
    generate_reviewer_gemini,
    generate_quiz_gemini,
    transform_reviewer_gemini,
    local_fallback_synthesizer,
    local_fallback_quiz_generator,
    normalize_reviewer,
    normalize_quiz,
    build_generation_meta,
)

load_dotenv()

app = Flask(__name__)
# Enable CORS for local dev and deployed frontend domains
CORS(app, resources={r"/api/*": {"origins": "*"}})

PORT = int(os.environ.get("PORT", "5001"))
HISTORY_FILE = os.path.join(os.path.dirname(__file__), "history.json")

SOURCE_MARKER_RE = re.compile(r"---\s*\[(?:Page|Slide)\s+\d+\]\s*---")

TRANSFORM_ACTIONS = {"make_simpler", "eli5", "make_shorter", "make_detailed"}


def load_history():
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_history(history_list):
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history_list, f, indent=2, ensure_ascii=False)
    except Exception as e:
        app.logger.error(f"Error saving history: {e}")


def _pdf_text(value):
    """Convert reviewer values to safe, readable PDF text."""
    return str(value or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _pdf_paragraph(value, style):
    return Paragraph(_pdf_text(value).replace("\n", "<br/>"), style)


def _pdf_rich_paragraph(value, style):
    """Render trusted ReportLab markup with dynamic values already escaped."""
    return Paragraph(value.replace("\n", "<br/>"), style)


def _must_text(item):
    """Support both object-form and legacy string-form must_remember entries."""
    if isinstance(item, dict):
        return str(item.get("text") or "")
    return str(item or "")


def build_reviewer_pdf(record):
    """Render the complete reviewer record as one detailed, paginated PDF.

    Empty sections are skipped and numbering stays sequential.
    """
    data = normalize_reviewer(record.get("reviewer", record))
    title = data.get("lesson_title") or record.get("title") or "Study Reviewer"
    subject = data.get("subject") or record.get("subject") or "Academic Study Reviewer"

    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=title,
        author="StudySnap AI",
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="PdfTitle", parent=styles["Title"], fontSize=22, leading=27,
        textColor=colors.HexColor("#172554"), alignment=TA_CENTER, spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name="PdfSubtitle", parent=styles["Normal"], fontSize=9, leading=12,
        textColor=colors.HexColor("#475569"), alignment=TA_CENTER, spaceAfter=16,
    ))
    styles.add(ParagraphStyle(
        name="PdfSection", parent=styles["Heading2"], fontSize=14, leading=18,
        textColor=colors.HexColor("#1e3a8a"), spaceBefore=14, spaceAfter=7,
    ))
    styles.add(ParagraphStyle(
        name="PdfHeading", parent=styles["Heading3"], fontSize=10.5, leading=14,
        textColor=colors.HexColor("#0f172a"), spaceBefore=5, spaceAfter=3,
    ))
    styles.add(ParagraphStyle(
        name="PdfBody", parent=styles["BodyText"], fontSize=9.5, leading=13,
        textColor=colors.HexColor("#334155"), spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name="PdfBullet", parent=styles["PdfBody"], leftIndent=12, firstLineIndent=-8,
    ))
    styles.add(ParagraphStyle(
        name="PdfSmall", parent=styles["PdfBody"], fontSize=8, leading=10,
        textColor=colors.HexColor("#64748b"),
    ))

    story = [
        _pdf_paragraph(title, styles["PdfTitle"]),
        _pdf_paragraph(
            f"{subject} | {record.get('date_created', '')} | "
            f"{record.get('pages_processed', 1)} page(s)/slide(s) | StudySnap AI",
            styles["PdfSubtitle"],
        ),
    ]

    def bullet_list(items):
        for item in items or []:
            story.append(_pdf_paragraph(f"• {item}", styles["PdfBullet"]))

    def render_quick_review():
        bullet_list(data.get("quick_review"))

    def render_keywords():
        rows = [[_pdf_paragraph("Term", styles["PdfHeading"]), _pdf_paragraph("Definition", styles["PdfHeading"])]]
        for item in data.get("keywords", []):
            rows.append([
                _pdf_paragraph(item.get("term"), styles["PdfBody"]),
                _pdf_paragraph(item.get("definition"), styles["PdfBody"]),
            ])
        table = Table(rows, colWidths=[48 * mm, 126 * mm], repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e0e7ff")),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(table)

    def render_concepts():
        for item in data.get("core_concepts", []):
            story.append(_pdf_paragraph(item.get("concept"), styles["PdfHeading"]))
            if item.get("explanation"):
                story.append(_pdf_paragraph(item.get("explanation"), styles["PdfBody"]))
            bullet_list(item.get("points"))

    def render_must_remember():
        bullet_list([_must_text(item) for item in data.get("must_remember", []) if _must_text(item)])

    def render_compare():
        for item in data.get("compare", []):
            story.append(_pdf_paragraph(f"{item.get('concept_a')} vs {item.get('concept_b')}", styles["PdfHeading"]))
            rows = [["Aspect", item.get("concept_a", "A"), item.get("concept_b", "B")]]
            rows.extend([[aspect.get("aspect", ""), aspect.get("a_val", ""), aspect.get("b_val", "")] for aspect in item.get("aspects", [])])
            table = Table([[_pdf_paragraph(cell, styles["PdfBody"]) for cell in row] for row in rows], colWidths=[42 * mm, 66 * mm, 66 * mm], repeatRows=1)
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dbeafe")),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]))
            story.append(table)

    def render_processes():
        for process in data.get("process_steps", []):
            story.append(_pdf_paragraph(process.get("process_title"), styles["PdfHeading"]))
            for step in process.get("steps", []):
                story.append(_pdf_rich_paragraph(
                    f"{_pdf_text(step.get('step_number'))}. <b>{_pdf_text(step.get('title'))}</b>: "
                    f"{_pdf_text(step.get('description'))}",
                    styles["PdfBody"],
                ))

    def render_formulas():
        for formula in data.get("formulas_rules", []):
            story.append(_pdf_paragraph(formula.get("name"), styles["PdfHeading"]))
            story.append(_pdf_rich_paragraph(f"<b>Formula:</b> {_pdf_text(formula.get('formula'))}", styles["PdfBody"]))
            if formula.get("when_to_use"):
                story.append(_pdf_rich_paragraph(f"<b>When to use:</b> {_pdf_text(formula.get('when_to_use'))}", styles["PdfBody"]))
            if formula.get("variables"):
                bullet_list([f"{item.get('symbol')}: {item.get('meaning')}" for item in formula["variables"]])
            if formula.get("example"):
                story.append(_pdf_rich_paragraph(f"<b>Example:</b> {_pdf_text(formula.get('example'))}", styles["PdfBody"]))

    def render_examples():
        for item in data.get("examples", []):
            story.append(_pdf_paragraph(item.get("concept"), styles["PdfHeading"]))
            story.append(_pdf_rich_paragraph(f"<b>Scenario:</b> {_pdf_text(item.get('example'))}", styles["PdfBody"]))
            if item.get("explanation"):
                story.append(_pdf_rich_paragraph(f"<b>Why it matters:</b> {_pdf_text(item.get('explanation'))}", styles["PdfBody"]))

    def render_quiz_points():
        for item in data.get("possible_quiz_points", []):
            story.append(_pdf_rich_paragraph(f"<b>Clue:</b> {_pdf_text(item.get('question_clue'))}", styles["PdfBody"]))
            story.append(_pdf_rich_paragraph(f"<b>Key fact:</b> {_pdf_text(item.get('key_fact'))}", styles["PdfBody"]))

    def render_one_minute():
        story.append(_pdf_paragraph(data.get("one_minute_review"), styles["PdfBody"]))

    sections = [
        ("Quick Review", not data.get("quick_review"), render_quick_review),
        ("Keywords & Definitions", not data.get("keywords"), render_keywords),
        ("Core Concepts", not data.get("core_concepts"), render_concepts),
        ("Must Remember", not data.get("must_remember"), render_must_remember),
        ("Compare Similar Concepts", not data.get("compare"), render_compare),
        ("Process / Steps", not data.get("process_steps"), render_processes),
        ("Formulas & Rules", not data.get("formulas_rules"), render_formulas),
        ("High-Yield Examples", not data.get("examples"), render_examples),
        ("Possible Quiz Points", not data.get("possible_quiz_points"), render_quiz_points),
        ("One-Minute Review", not data.get("one_minute_review"), render_one_minute),
    ]

    number = 0
    for heading, is_empty, render in sections:
        if is_empty:
            continue
        number += 1
        story.append(_pdf_paragraph(f"{number}. {heading}", styles["PdfSection"]))
        render()

    document.build(story)
    buffer.seek(0)
    return buffer

@app.route("/api/health", methods=["GET"])
def health():
    gemini_env_key = bool(os.environ.get("GEMINI_API_KEY"))
    return jsonify({
        "status": "healthy",
        "app": "StudySnap AI Backend",
        "has_env_gemini_key": gemini_env_key,
        "default_model": "gemini-2.5-flash",
        "timestamp": datetime.datetime.now().isoformat()
    })


@app.route("/api/export-pdf", methods=["POST"])
def export_pdf():
    """Export the complete reviewer record as a single downloadable PDF."""
    record = request.get_json() or {}
    if not record.get("reviewer"):
        return jsonify({"error": "A reviewer is required to create a PDF."}), 400

    try:
        pdf_buffer = build_reviewer_pdf(record)
        title = record.get("reviewer", {}).get("lesson_title") or record.get("title") or "study-reviewer"
        safe_title = "".join(char if char.isalnum() or char in " -_" else "_" for char in title).strip() or "study-reviewer"
        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"{safe_title}.pdf",
        )
    except Exception as error:
        app.logger.exception("PDF export failed")
        return jsonify({"error": f"Could not create PDF: {error}"}), 500

@app.route("/api/extract", methods=["POST"])
def extract_file():
    """Extract text segments, quality, and warnings from an uploaded file."""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    try:
        result = process_file_input(file, file.filename)
        return jsonify({
            "success": True,
            "filename": file.filename,
            # Aliases consumed by the frontend
            "extraction_quality": result.get("quality"),
            "extraction_warnings": result.get("warnings") or [],
            **result
        })
    except Exception as e:
        app.logger.error(f"Extraction failed: {e}")
        status_code = 400 if isinstance(e, ValueError) else 500
        return jsonify({"error": str(e)}), status_code

@app.route("/api/generate-reviewer", methods=["POST"])
def generate_reviewer():
    """Generate a source-grounded, structured study reviewer."""
    data = request.get_json() or {}
    text = str(data.get("text") or "")
    image_b64 = data.get("image_b64")
    mime_type = data.get("mime_type")
    filename = data.get("filename", "Lesson")
    compression = data.get("compression", "standard") # quick, standard, detailed
    tone = data.get("tone", "standard") # standard, simpler, eli5
    pages_processed = data.get("page_count", 1)

    segments = data.get("segments") if isinstance(data.get("segments"), list) else []
    extraction_warnings = [
        warning for warning in (data.get("extraction_warnings") or [])
        if isinstance(warning, str) and warning.strip()
    ]
    extraction_quality = data.get("extraction_quality") or "unknown"

    # Check for API key from request headers or body
    api_key = request.headers.get("X-Gemini-Key") or data.get("api_key") or os.environ.get("GEMINI_API_KEY")

    if not text.strip() and not image_b64:
        return jsonify({"error": "Please enter text or upload a document to analyze."}), 400
    if image_b64 and not api_key:
        return jsonify({
            "error": "Image understanding requires the configured AI vision provider. "
                     "Add a Gemini API key under 'AI Engine', or upload a PDF, PPTX, or text file."
        }), 400

    reviewer_result = None
    ai_provider = "local_extractive_fallback"
    generation_warnings = list(extraction_warnings)

    if api_key:
        try:
            reviewer_result = generate_reviewer_gemini(
                text=text,
                image_b64=image_b64,
                mime_type=mime_type,
                compression=compression,
                tone=tone,
                api_key=api_key
            )
            ai_provider = "gemini-2.5-flash"
        except Exception as e:
            app.logger.warning(f"Gemini generation failed: {e}. Falling back to the offline extractive engine.")
            reviewer_result = local_fallback_synthesizer(
                text=text,
                filename=filename,
                compression=compression,
                tone=tone
            )
            ai_provider = "local_extractive_fallback"
            if image_b64:
                generation_warnings.append(
                    "Image content could not be analyzed because the AI vision provider was "
                    "unavailable. The reviewer contains no image-derived content."
                )
    else:
        reviewer_result = local_fallback_synthesizer(
            text=text,
            filename=filename,
            compression=compression,
            tone=tone
        )
        ai_provider = "local_extractive"

    if ai_provider.startswith("local"):
        generation_warnings.append(
            "Generated by the offline extractive engine: only content found directly in the "
            "source is included, and unsupported sections are left empty."
        )
        if tone != "standard":
            generation_warnings.append(
                "Tone changes (simpler / ELI5) require the AI engine; the text was not rewritten."
            )

    reviewer_result = normalize_reviewer(reviewer_result)

    if not segments:
        segments = SOURCE_MARKER_RE.findall(text)
        source_segments = len(segments) if segments else (1 if text.strip() else 0)
    else:
        source_segments = len(segments)

    generation_meta = build_generation_meta(
        reviewer=reviewer_result,
        source_characters=len(text),
        source_segments=source_segments,
        warnings=generation_warnings,
        provider=ai_provider,
    )

    # Assemble complete record
    reviewer_id = str(uuid.uuid4())
    record = {
        "id": reviewer_id,
        "title": reviewer_result.get("lesson_title", filename),
        "subject": reviewer_result.get("subject", "General Study"),
        "date_created": datetime.datetime.now().strftime("%b %d, %Y - %I:%M %p"),
        "pages_processed": pages_processed,
        "compression": compression,
        "tone": tone,
        "ai_provider": ai_provider,
        "reviewer": reviewer_result,
        "generation_meta": generation_meta,
        "extraction_quality": extraction_quality,
        "extraction_warnings": extraction_warnings,
        "raw_text_length": len(text),
        "filename": filename
    }

    # Save to history
    history = load_history()
    # Prepend newest record
    history.insert(0, {
        "id": record["id"],
        "title": record["title"],
        "subject": record["subject"],
        "date_created": record["date_created"],
        "pages_processed": record["pages_processed"],
        "ai_provider": record["ai_provider"],
        "filename": record["filename"],
        "status": "Ready",
        "generation_meta": record["generation_meta"],
        "extraction_quality": record["extraction_quality"],
        "extraction_warnings": record["extraction_warnings"],
        "reviewer": record["reviewer"]
    })
    # Keep last 50
    save_history(history[:50])

    return jsonify({
        "success": True,
        "data": record
    })

@app.route("/api/generate-quiz", methods=["POST"])
def generate_quiz():
    """Generate quiz questions grounded in reviewer data."""
    data = request.get_json() or {}
    reviewer_data = data.get("reviewer", {})
    try:
        question_count = max(1, min(20, int(data.get("question_count", 10))))
    except (TypeError, ValueError):
        return jsonify({"error": "question_count must be a number between 1 and 20"}), 400
    question_type = data.get("question_type", "mixed") # multiple_choice, true_false, identification, mixed

    api_key = request.headers.get("X-Gemini-Key") or data.get("api_key") or os.environ.get("GEMINI_API_KEY")

    questions = None
    if api_key:
        try:
            questions = generate_quiz_gemini(
                reviewer_data=reviewer_data,
                question_count=question_count,
                question_type=question_type,
                api_key=api_key
            )
        except Exception as e:
            app.logger.warning(f"Gemini quiz generation failed: {e}. Using local quiz generator.")
            questions = local_fallback_quiz_generator(
                reviewer_data=reviewer_data,
                question_count=question_count,
                question_type=question_type
            )
    else:
        questions = local_fallback_quiz_generator(
            reviewer_data=reviewer_data,
            question_count=question_count,
            question_type=question_type
        )

    questions = normalize_quiz(questions, question_count)

    message = None
    if len(questions) < question_count:
        if questions:
            message = (
                f"Only {len(questions)} of {question_count} requested questions could be built "
                "from trustworthy reviewer content. Fewer grounded questions are better than "
                "fabricated ones."
            )
        else:
            message = "This reviewer does not contain enough source-grounded material to build a quiz."

    return jsonify({
        "success": True,
        "questions": questions,
        "count": len(questions),
        "requested_count": question_count,
        "message": message
    })

@app.route("/api/transform", methods=["POST"])
def transform_reviewer():
    """Transform a reviewer tone/length without fabricating content.

    With an AI key: genuine grounded rewrite. Without: conservative deterministic
    shortening only - no prefix tricks, no invented tips.
    """
    data = request.get_json() or {}
    reviewer_data = data.get("reviewer", {})
    action = data.get("action", "make_simpler") # make_simpler, eli5, make_shorter, make_detailed

    if action not in TRANSFORM_ACTIONS:
        return jsonify({"error": f"Unsupported transform action: {action}"}), 400
    if not isinstance(reviewer_data, dict) or not reviewer_data:
        return jsonify({"error": "A reviewer is required to transform."}), 400

    api_key = request.headers.get("X-Gemini-Key") or data.get("api_key") or os.environ.get("GEMINI_API_KEY")
    base = normalize_reviewer(reviewer_data)

    transformed = None
    provider = "local_conservative"
    note = None

    if api_key:
        try:
            transformed = transform_reviewer_gemini(base, action=action, api_key=api_key)
            provider = "gemini-2.5-flash"
        except Exception as e:
            app.logger.warning(f"Gemini transform failed: {e}. Applying conservative local transform.")
            note = "AI rewriting was unavailable, so no new wording was generated."

    if transformed is None:
        if action == "make_shorter":
            transformed = dict(base)
            transformed["quick_review"] = base["quick_review"][:3]
            transformed["keywords"] = base["keywords"][:5]
            transformed["core_concepts"] = base["core_concepts"][:3]
            transformed["must_remember"] = base["must_remember"][:3]
            transformed["possible_quiz_points"] = base["possible_quiz_points"][:3]
        else:
            transformed = base
            note = note or (
                "Simpler/ELI5 rewriting and expansion require the AI engine. The content was "
                "left unchanged rather than rewritten without understanding it."
            )

    return jsonify({
        "success": True,
        "action": action,
        "reviewer": transformed,
        "provider": provider,
        "note": note
    })

@app.route("/api/history", methods=["GET", "DELETE"])
def history_endpoint():
    if request.method == "DELETE":
        save_history([])
        return jsonify({"success": True, "message": "History cleared"})

    history = load_history()
    return jsonify({"success": True, "history": history})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=False)
