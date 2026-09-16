import os
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
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from extractors import process_file_input, extract_from_text
from ai_engine import (
    generate_reviewer_gemini,
    generate_quiz_gemini,
    local_fallback_synthesizer,
    local_fallback_quiz_generator
)

load_dotenv()

app = Flask(__name__)
# Enable CORS for local dev and deployed frontend domains
CORS(app, resources={r"/api/*": {"origins": "*"}})

PORT = int(os.environ.get("PORT", "5001"))
HISTORY_FILE = os.path.join(os.path.dirname(__file__), "history.json")

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


def build_reviewer_pdf(record):
    """Render the complete reviewer record as one detailed, paginated PDF."""
    data = record.get("reviewer", record)
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

    def section(number, heading):
        story.append(_pdf_paragraph(f"{number}. {heading}", styles["PdfSection"]))

    def bullet_list(items):
        for item in items or []:
            story.append(_pdf_paragraph(f"• {item}", styles["PdfBullet"]))

    section(1, "Quick Review")
    bullet_list(data.get("quick_review"))

    section(2, "Keywords & Definitions")
    keyword_rows = [[_pdf_paragraph("Term", styles["PdfHeading"]), _pdf_paragraph("Definition", styles["PdfHeading"])]]
    for item in data.get("keywords", []):
        keyword_rows.append([_pdf_paragraph(item.get("term"), styles["PdfBody"]), _pdf_paragraph(item.get("definition"), styles["PdfBody"])])
    if len(keyword_rows) > 1:
        table = Table(keyword_rows, colWidths=[48 * mm, 126 * mm], repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e0e7ff")),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(table)

    section(3, "Core Concepts")
    for item in data.get("core_concepts", []):
        story.append(_pdf_paragraph(item.get("concept"), styles["PdfHeading"]))
        story.append(_pdf_paragraph(item.get("explanation"), styles["PdfBody"]))
        bullet_list(item.get("points"))

    section(4, "Must Remember")
    bullet_list(data.get("must_remember"))

    comparisons = data.get("compare", [])
    if comparisons:
        section(5, "Compare Similar Concepts")
        for item in comparisons:
            story.append(_pdf_paragraph(f"{item.get('concept_a')} vs {item.get('concept_b')}", styles["PdfHeading"]))
            rows = [["Aspect", item.get("concept_a", "A"), item.get("concept_b", "B")]]
            rows.extend([[aspect.get("aspect", ""), aspect.get("a_val", ""), aspect.get("b_val", "")] for aspect in item.get("aspects", [])])
            table = Table([[ _pdf_paragraph(cell, styles["PdfBody"]) for cell in row] for row in rows], colWidths=[42 * mm, 66 * mm, 66 * mm], repeatRows=1)
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dbeafe")),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]))
            story.append(table)

    processes = data.get("process_steps", [])
    if processes:
        section(6, "Process / Steps")
        for process in processes:
            story.append(_pdf_paragraph(process.get("process_title"), styles["PdfHeading"]))
            for step in process.get("steps", []):
                story.append(_pdf_rich_paragraph(
                    f"{_pdf_text(step.get('step_number'))}. <b>{_pdf_text(step.get('title'))}</b>: "
                    f"{_pdf_text(step.get('description'))}",
                    styles["PdfBody"],
                ))

    formulas = data.get("formulas_rules", [])
    if formulas:
        section(7, "Formulas & Rules")
        for formula in formulas:
            story.append(_pdf_paragraph(formula.get("name"), styles["PdfHeading"]))
            story.append(_pdf_rich_paragraph(f"<b>Formula:</b> {_pdf_text(formula.get('formula'))}", styles["PdfBody"]))
            story.append(_pdf_rich_paragraph(f"<b>When to use:</b> {_pdf_text(formula.get('when_to_use'))}", styles["PdfBody"]))
            if formula.get("variables"):
                bullet_list([f"{item.get('symbol')}: {item.get('meaning')}" for item in formula["variables"]])
            if formula.get("example"):
                story.append(_pdf_rich_paragraph(f"<b>Example:</b> {_pdf_text(formula.get('example'))}", styles["PdfBody"]))

    examples = data.get("examples", [])
    if examples:
        section(8, "High-Yield Examples")
        for item in examples:
            story.append(_pdf_paragraph(item.get("concept"), styles["PdfHeading"]))
            story.append(_pdf_rich_paragraph(f"<b>Scenario:</b> {_pdf_text(item.get('example'))}", styles["PdfBody"]))
            story.append(_pdf_rich_paragraph(f"<b>Why it matters:</b> {_pdf_text(item.get('explanation'))}", styles["PdfBody"]))

    quiz_points = data.get("possible_quiz_points", [])
    if quiz_points:
        section(9, "Possible Quiz Points")
        for item in quiz_points:
            story.append(_pdf_rich_paragraph(f"<b>Clue:</b> {_pdf_text(item.get('question_clue'))}", styles["PdfBody"]))
            story.append(_pdf_rich_paragraph(f"<b>Key fact:</b> {_pdf_text(item.get('key_fact'))}", styles["PdfBody"]))

    section(10, "One-Minute Review")
    story.append(_pdf_paragraph(data.get("one_minute_review"), styles["PdfBody"]))
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
        "default_model": "gemini-3.6-flash",
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
    """Extract text or image data from uploaded file."""
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
            **result
        })
    except Exception as e:
        app.logger.error(f"Extraction failed: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/generate-reviewer", methods=["POST"])
def generate_reviewer():
    """Generate structured 10-section study reviewer."""
    data = request.get_json() or {}
    text = data.get("text", "")
    image_b64 = data.get("image_b64")
    mime_type = data.get("mime_type")
    filename = data.get("filename", "Lesson")
    compression = data.get("compression", "standard") # quick, standard, detailed
    tone = data.get("tone", "standard") # standard, simpler, eli5
    pages_processed = data.get("page_count", 1)
    
    # Check for API key from request headers or body
    api_key = request.headers.get("X-Gemini-Key") or data.get("api_key") or os.environ.get("GEMINI_API_KEY")
    
    reviewer_result = None
    ai_provider = "local_synthesizer"
    
    # Try Gemini 3.8 Flash if key is present
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
            ai_provider = "gemini-3.6-flash"
        except Exception as e:
            app.logger.warning(f"Gemini generation failed: {e}. Falling back to local smart synthesizer.")
            reviewer_result = local_fallback_synthesizer(
                text=text,
                filename=filename,
                compression=compression,
                tone=tone
            )
            ai_provider = "local_synthesizer_fallback"
    else:
        # Fallback to local smart synthesizer
        reviewer_result = local_fallback_synthesizer(
            text=text,
            filename=filename,
            compression=compression,
            tone=tone
        )
        ai_provider = "local_synthesizer"

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
    """Generate quiz questions from reviewer data."""
    data = request.get_json() or {}
    reviewer_data = data.get("reviewer", {})
    question_count = int(data.get("question_count", 10))
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

    return jsonify({
        "success": True,
        "questions": questions,
        "count": len(questions)
    })

@app.route("/api/transform", methods=["POST"])
def transform_reviewer():
    """Transform reviewer on-the-fly (make simpler, ELI5, make shorter, expand)."""
    data = request.get_json() or {}
    reviewer_data = data.get("reviewer", {})
    action = data.get("action", "make_simpler") # make_simpler, eli5, make_shorter, make_detailed
    
    # Deep copy or transform
    transformed = json.loads(json.dumps(reviewer_data))
    
    if action in ["make_simpler", "eli5"]:
        prefix = "In simple terms: " if action == "make_simpler" else "Imagine this: "
        for concept in transformed.get("core_concepts", []):
            if not concept.get("explanation", "").startswith("In simple") and not concept.get("explanation", "").startswith("Imagine"):
                concept["explanation"] = f"{prefix}{concept.get('explanation', '')}"
        
        for kw in transformed.get("keywords", []):
            defn = kw.get("definition", "")
            if not defn.startswith("Basically,"):
                kw["definition"] = f"Basically, {defn[0].lower() + defn[1:] if defn else ''}"
                
        transformed["one_minute_review"] = f"Friendly Breakdown: {transformed.get('one_minute_review', '')}"

    elif action == "make_shorter":
        # Condense items
        transformed["quick_review"] = transformed.get("quick_review", [])[:3]
        transformed["keywords"] = transformed.get("keywords", [])[:5]
        transformed["core_concepts"] = transformed.get("core_concepts", [])[:3]
        transformed["must_remember"] = transformed.get("must_remember", [])[:3]
        
    elif action == "make_detailed":
        # Add tips to concepts
        for concept in transformed.get("core_concepts", []):
            if "points" in concept and len(concept["points"]) < 3:
                concept["points"].append("Exam Tip: Pay special attention to edge cases and related terminology.")

    return jsonify({
        "success": True,
        "action": action,
        "reviewer": transformed
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
