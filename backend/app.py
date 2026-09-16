import os
import json
import uuid
import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from extractors import process_file_input, extract_from_text
from ai_engine import (
    generate_reviewer_gemini,
    generate_quiz_gemini,
    local_fallback_synthesizer,
    local_fallback_quiz_generator
)

app = Flask(__name__)
# Enable CORS for frontend Vite dev server and production
CORS(app, resources={r"/api/*": {"origins": "*"}})

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

@app.route("/api/health", methods=["GET"])
def health():
    gemini_env_key = bool(os.environ.get("GEMINI_API_KEY"))
    return jsonify({
        "status": "healthy",
        "app": "StudySnap AI Backend",
        "has_env_gemini_key": gemini_env_key,
        "default_model": "gemini-3.8-flash",
        "timestamp": datetime.datetime.now().isoformat()
    })

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
            ai_provider = "gemini-3.8-flash"
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
    app.run(host="0.0.0.0", port=5001, debug=True)
