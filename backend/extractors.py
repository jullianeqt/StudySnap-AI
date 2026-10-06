import os
import io
import base64
import logging
import unicodedata
from typing import Dict, Any, List, Tuple

logger = logging.getLogger(__name__)

MIN_USABLE_CHARS = 10
LOW_YIELD_CHARS_PER_PAGE = 100
PARTIAL_CHARS_PER_PAGE = 300


def _segment(source_type: str, source_index: int, label: str, text: str) -> Dict[str, Any]:
    return {
        "source_type": source_type,
        "source_index": source_index,
        "label": label,
        "text": text or "",
    }


def _assess_quality(file_type: str, page_count: int, segments: List[Dict[str, Any]]) -> Tuple[str, List[str]]:
    """Heuristic extraction quality check. Never claims OCR was performed."""
    warnings: List[str] = []
    total_chars = sum(len((seg.get("text") or "").strip()) for seg in segments)
    empty_segments = sum(
        1 for seg in segments if len((seg.get("text") or "").strip()) < MIN_USABLE_CHARS
    )
    noun = "PDF" if file_type == "pdf" else "presentation" if file_type == "pptx" else "file"

    if page_count <= 0 or not segments:
        return "poor", [f"No pages or content were found in this {noun}."]

    if total_chars == 0:
        if file_type == "pdf":
            warnings.append(
                "No text could be extracted from this PDF. It may contain scanned or "
                "image-based pages. No OCR was performed, so this file cannot be reviewed."
            )
        elif file_type == "pptx":
            warnings.append(
                "No text could be extracted from any slide of this presentation."
            )
        else:
            warnings.append(f"No text could be extracted from this {noun}.")
        return "poor", warnings

    avg_chars = total_chars / page_count

    if page_count >= 3 and avg_chars < LOW_YIELD_CHARS_PER_PAGE:
        if file_type == "pdf":
            warnings.append(
                "We could only extract a small amount of text from this PDF. It may "
                "contain scanned or image-based pages. No OCR was performed."
            )
        else:
            warnings.append(
                f"Only {total_chars} characters of text could be extracted across "
                f"{page_count} pages/slides."
            )
        return "poor", warnings

    if page_count >= 2 and (avg_chars < PARTIAL_CHARS_PER_PAGE or empty_segments / page_count >= 0.5):
        warnings.append(
            f"Only {page_count - empty_segments} of {page_count} pages/slides contained "
            "usable text; some content could not be extracted."
        )
        return "partial", warnings

    if total_chars < 200:
        warnings.append("The extracted text is very short; the reviewer will be limited.")
        return "partial", warnings

    return "good", warnings


def extract_from_pdf(file_stream: io.BytesIO) -> Dict[str, Any]:
    """Extract per-page text segments and metadata from PDF stream using pypdf."""
    try:
        import pypdf
        reader = pypdf.PdfReader(file_stream)
        total_pages = len(reader.pages)
        segments: List[Dict[str, Any]] = []

        for idx, page in enumerate(reader.pages):
            try:
                page_text = page.extract_text() or ""
            except Exception as page_error:
                logger.warning(f"Could not extract text from page {idx + 1}: {page_error}")
                page_text = ""
            cleaned = unicodedata.normalize("NFC", page_text).strip()
            segments.append(_segment("pdf_page", idx + 1, f"Page {idx + 1}", cleaned))

        full_text = "\n\n".join(
            f"--- [Page {seg['source_index']}] ---\n{seg['text']}"
            for seg in segments
            if seg["text"]
        )
        quality, warnings = _assess_quality("pdf", total_pages, segments)
        return {
            "text": full_text,
            "segments": segments,
            "page_count": total_pages,
            "file_type": "pdf",
            "metadata": {"pages": total_pages, "characters": len(full_text)},
            "quality": quality,
            "warnings": warnings,
        }
    except Exception as e:
        logger.error(f"Error reading PDF: {e}")
        raise ValueError(f"Failed to read PDF file: {str(e)}")


def extract_from_pptx(file_stream: io.BytesIO) -> Dict[str, Any]:
    """Extract slide titles, bullet points, tables, and notes from PPTX."""
    try:
        from pptx import Presentation
        prs = Presentation(file_stream)
        segments: List[Dict[str, Any]] = []
        total_slides = len(prs.slides)

        for idx, slide in enumerate(prs.slides):
            slide_parts: List[str] = []
            title_shape = slide.shapes.title
            title_id = getattr(title_shape, "shape_id", None)
            title_text = (title_shape.text.strip() if title_shape is not None and title_shape.text else "")

            if title_text:
                slide_parts.append(f"Title: {title_text}")

            for shape in slide.shapes:
                # Skip the title shape by id so its text is never duplicated.
                if title_id is not None and getattr(shape, "shape_id", None) == title_id:
                    continue
                if shape.has_text_frame:
                    frame_text = shape.text_frame.text.strip()
                    if frame_text and frame_text != title_text:
                        slide_parts.append(frame_text)
                elif shape.has_table:
                    table_rows = []
                    for row in shape.table.rows:
                        row_vals = [cell.text.strip().replace("\n", " ") for cell in row.cells]
                        table_rows.append(" | ".join(row_vals))
                    if table_rows:
                        slide_parts.append("Table:\n" + "\n".join(table_rows))

            if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
                notes = slide.notes_slide.notes_text_frame.text.strip()
                if notes and notes != title_text:
                    slide_parts.append(f"Notes: {notes}")

            slide_text = "\n".join(slide_parts).strip()
            segments.append(_segment("pptx_slide", idx + 1, f"Slide {idx + 1}", slide_text))

        full_text = "\n\n".join(
            f"--- [Slide {seg['source_index']}] ---\n{seg['text']}"
            for seg in segments
            if seg["text"]
        )
        quality, warnings = _assess_quality("pptx", total_slides, segments)
        return {
            "text": full_text,
            "segments": segments,
            "page_count": total_slides,
            "file_type": "pptx",
            "metadata": {"slides": total_slides, "characters": len(full_text)},
            "quality": quality,
            "warnings": warnings,
        }
    except Exception as e:
        logger.error(f"Error reading PPTX: {e}")
        raise ValueError(f"Failed to read PowerPoint file: {str(e)}")


def extract_from_image(file_stream: io.BytesIO, filename: str) -> Dict[str, Any]:
    """Encode an image for multimodal AI. Performs no OCR and claims no content."""
    try:
        from PIL import Image
        file_bytes = file_stream.read()
        img = Image.open(io.BytesIO(file_bytes))
        width, height = img.size
        img_format = (img.format or "JPEG").lower()

        mime_type = "image/jpeg"
        if img_format in ["png"]:
            mime_type = "image/png"
        elif img_format in ["webp"]:
            mime_type = "image/webp"

        b64_data = base64.b64encode(file_bytes).decode("utf-8")

        placeholder = (
            f"[Image uploaded: {filename} ({width}x{height}px, {img_format.upper()}). "
            "No text was extracted from this image. Analyze the visible content directly.]"
        )
        warnings = [
            "No OCR was performed, so no text was extracted from this image. "
            "Understanding the image content requires the configured AI vision provider."
        ]

        return {
            "text": placeholder,
            "segments": [_segment("image", 1, filename, placeholder)],
            "page_count": 1,
            "file_type": "image",
            "image_b64": b64_data,
            "mime_type": mime_type,
            "metadata": {
                "width": width,
                "height": height,
                "format": img_format,
                "filename": filename
            },
            "quality": "partial",
            "warnings": warnings,
        }
    except Exception as e:
        logger.error(f"Error reading image: {e}")
        raise ValueError(f"Failed to read image file: {str(e)}")


def extract_from_text(text: str, filename: str = "Pasted Text") -> Dict[str, Any]:
    """Normalize plain text or markdown lesson input into a single source segment."""
    clean_text = unicodedata.normalize("NFC", text).replace("\r\n", "\n").replace("\r", "\n").strip()
    words = len(clean_text.split())
    est_pages = max(1, round(words / 400))
    segment = _segment("text", 1, "Text", clean_text)
    quality, warnings = _assess_quality("text", 1, [segment])
    if not clean_text:
        quality, warnings = "poor", ["No text was provided."]
    return {
        "text": clean_text,
        "segments": [segment],
        "page_count": est_pages,
        "file_type": "text",
        "metadata": {"words": words, "characters": len(clean_text), "filename": filename},
        "quality": quality,
        "warnings": warnings,
    }


def process_file_input(file_obj, filename: str) -> Dict[str, Any]:
    """Unified file processor based on extension."""
    ext = os.path.splitext(filename)[1].lower()
    stream = io.BytesIO(file_obj.read())

    if ext == ".pdf":
        return extract_from_pdf(stream)
    elif ext == ".pptx":
        return extract_from_pptx(stream)
    elif ext == ".ppt":
        raise ValueError("Legacy .ppt files are not supported. Please save the presentation as .pptx and try again.")
    elif ext in [".png", ".jpg", ".jpeg", ".webp", ".bmp"]:
        return extract_from_image(stream, filename)
    elif ext in [".txt", ".md", ".csv"]:
        stream.seek(0)
        content = decode_text_bytes(stream.read(), filename)
        return extract_from_text(content, filename)
    else:
        # Try reading as text
        stream.seek(0)
        try:
            content = decode_text_bytes(stream.read(), filename)
            return extract_from_text(content, filename)
        except Exception:
            raise ValueError(f"Unsupported file format: {ext}. Please upload a PDF, PPTX, image, or text file.")


def decode_text_bytes(file_bytes: bytes, filename: str = "uploaded file") -> str:
    """Decode common text encodings without silently discarding source characters."""
    if file_bytes.startswith((b"\xff\xfe", b"\xfe\xff")):
        return file_bytes.decode("utf-16")
    if file_bytes.startswith(b"\xef\xbb\xbf"):
        return file_bytes.decode("utf-8-sig")

    for encoding in ("utf-8", "cp1252"):
        try:
            decoded = file_bytes.decode(encoding)
            if encoding == "cp1252" and b"\x00" not in file_bytes:
                return decoded
            if encoding == "utf-8":
                return decoded
        except UnicodeDecodeError:
            continue

    for encoding in ("utf-16-le", "utf-16-be"):
        try:
            decoded = file_bytes.decode(encoding)
            if b"\x00" in file_bytes:
                return decoded.replace("\x00", "")
        except UnicodeDecodeError:
            continue

    raise ValueError(
        f"Could not decode {filename}. Save it as UTF-8, UTF-16, or Windows-1252 and try again."
    )
