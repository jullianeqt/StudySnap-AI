"""Clean derived study data without modifying uploaded text or provenance.

Rules are shared with the browser. Labels are stripped only at fragment
boundaries; institution words in academic sentences remain intact.
"""
import json
import re
from pathlib import Path

RULES = json.loads(Path(__file__).with_name('content_rules.json').read_text(encoding='utf-8'))


def _match(rule, value):
    return re.search(RULES[rule], value, re.I)


def clean_text(value):
    if not isinstance(value, str):
        return value
    cleaned = []
    changed = False
    # Sentence boundaries leave decimal values and numbered procedures intact.
    for line in value.splitlines():
        for part in re.split(r'(?<=[.!?])\s+(?=[A-Za-z])|\s*[—–|]\s*|\s+-\s+', line):
            part = part.strip()
            if not part:
                continue
            original = part
            prefix = r'^(?:#{1,6}\s*)?(?:' + RULES['label'] + '|' + RULES['course'] + r')\s*(?:[:.,;\-]\s*)?'
            while True:
                stripped = re.sub(prefix, '', part, count=1, flags=re.I).strip()
                if stripped == part:
                    break
                part = stripped
            # A branding prefix followed by a colon is separate from its topic.
            if ':' in part:
                heading, body = part.split(':', 1)
                if _match('institution', heading) and not _match('academic', heading):
                    part = body.strip()
            probe = part.strip(' .,:;#-')
            if not probe or _match('advice', probe) or _match('administrative', probe):
                changed = True
                continue
            if _match('institution', probe) and not _match('academic', probe) and len(probe.split()) <= 12:
                changed = True
                continue
            changed = changed or part != original
            cleaned.append(part)
    return ' '.join(cleaned).strip() if changed else value.strip()


def clean_tree(value, field=''):
    if field in RULES['protected']:
        return value
    if isinstance(value, str):
        return clean_text(value)
    if isinstance(value, list):
        out = []
        for item in value:
            item = clean_tree(item, field)
            if not item:
                continue
            if isinstance(item, dict) and not all(item.get(key) for key in RULES['required'].get(field, [])):
                continue
            if isinstance(item, dict) and field in RULES['content_any'] and not any(item.get(key) for key in RULES['content_any'][field]):
                continue
            out.append(item)
        return out
    if isinstance(value, dict):
        result = {key: clean_tree(item, key) for key, item in value.items()}
        # Preserve an institutional term when its own definition/history
        # establishes it as subject matter, rather than document branding.
        for heading, body in (('term', 'definition'), ('concept', 'explanation'), ('correct_answer', 'explanation')):
            label = value.get(heading)
            explanation = value.get(body, '')
            if isinstance(label, str) and isinstance(explanation, str) and not result.get(heading):
                if _match('institution', label) and label.lower() in explanation.lower() and _match('academic', explanation):
                    result[heading] = label
        return result
    return value


def clean_record(record):
    """Read-time view of old records; raw segments and filenames stay original."""
    if not isinstance(record, dict):
        return record
    result = dict(record)
    if isinstance(result.get('reviewer'), dict):
        result['reviewer'] = clean_tree(result['reviewer'])
    reviewer = result.get('reviewer') or {}
    result['title'] = clean_text(result.get('title', '')) or reviewer.get('lesson_title') or 'Study Reviewer'
    result['subject'] = clean_text(result.get('subject', '')) or reviewer.get('subject') or 'General Study'
    return result


def clean_quiz_item(item):
    if not isinstance(item, dict):
        return None
    # Questions about administrative identifiers are discarded, not rephrased.
    question = clean_text(str(item.get('question', '')))
    if _match('label', question) or _match('course', question):
        return None
    result = clean_tree(item)
    if not result.get('question') or not result.get('correct_answer'):
        return None
    if result.get('type') == 'multiple_choice':
        options = result.get('options') or []
        keys = [str(option).strip().casefold() for option in options]
        if len(options) != len(item.get('options') or []) or len(keys) != len(set(keys)):
            return None
        if result['correct_answer'] not in options:
            return None
    if result.get('type') == 'true_false' and result['correct_answer'].strip().lower() not in ('true', 'false'):
        return None
    return result


def clean_source_for_generation(text):
    """Keep page/slide markers while excluding administrative source fragments."""
    return '\n'.join(
        line if re.match(r'^---\s*\[(?:Page|Slide)\s+\d+\]\s*---$', line.strip()) else clean_text(line)
        for line in (text or '').splitlines()
    )
