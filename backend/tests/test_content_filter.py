import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch

import _support  # noqa: F401
from content_filter import clean_text, clean_tree, clean_record
from ai_engine import normalize_reviewer, normalize_quiz, local_fallback_synthesizer
import app as app_module
from pypdf import PdfReader

FIXTURE = json.loads(Path(__file__).with_name('noisy_content.json').read_text(encoding='utf-8'))
BAD = r'(?i)\b(?:university|lesson\s*[:#]?\s*0*1|lecture\s*#?\s*101|computer science 101|CS\s*101)\b'


class ContentFilterTests(unittest.TestCase):
    def test_browser_rules_and_fixture_match_backend(self):
        frontend = Path(__file__).resolve().parents[2] / 'frontend' / 'src'
        backend = Path(__file__).resolve().parents[1]
        self.assertEqual(json.loads((frontend / 'contentRules.json').read_text(encoding='utf-8')), json.loads((backend / 'content_rules.json').read_text(encoding='utf-8')))
        self.assertEqual(json.loads((frontend / 'fixtures' / 'noisyContent.json').read_text(encoding='utf-8')), FIXTURE)

    def assert_clean(self, value):
        self.assertNotRegex(json.dumps(value), BAD)

    def test_nested_reviewer_and_provenance(self):
        reviewer = normalize_reviewer(FIXTURE['reviewer'])
        self.assert_clean(reviewer)
        self.assertEqual(reviewer['lesson_title'], 'Algorithms')
        self.assertEqual(reviewer['subject'], 'Data Structures')
        self.assertEqual(reviewer['keywords'][0]['sources'], FIXTURE['reviewer']['keywords'][0]['sources'])
        self.assertEqual(len(reviewer['keywords']), 1)
        self.assertEqual(len(reviewer['core_concepts']), 1)
        self.assertEqual(len(reviewer['process_steps'][0]['steps']), 1)
        self.assertEqual(reviewer['process_steps'][0]['steps'][0]['step_number'], 1)
        self.assertEqual(clean_tree(reviewer), reviewer)

    def test_variants_and_legitimate_academic_uses(self):
        for text in ('LESSON 01', 'Lesson: 1', 'Lecture #101', 'CS 101', 'ABC University', 'University of Example'):
            self.assertEqual(clean_text(text), '')
        for text in ('The University of Cambridge was founded in 1209.', 'University research requires careful methods.', 'Step 101: Compare the values.', '1. Heat the sample to 101 degrees.', 'F = 1.01 N', 'Do not divide by zero.', 'A | B', 'A — B', 'if x:\n    return 101'):
            self.assertEqual(clean_text(text), text)
        self.assertEqual(clean_text('ABC University - Lesson 1: Algorithms'), 'Algorithms')
        reviewer = normalize_reviewer({'keywords': [{'id': 'institution-1', 'term': 'University', 'definition': 'A university is an institution of higher education.'}]})
        self.assertEqual(reviewer['keywords'][0]['term'], 'University')
        self.assertEqual(reviewer['keywords'][0]['id'], 'institution-1')

    def test_quiz_key_safety_and_ids(self):
        quiz = normalize_quiz(FIXTURE['quiz'])
        self.assertEqual([item['id'] for item in quiz], [21, 24])
        self.assert_clean(quiz)
        self.assertIn(quiz[0]['correct_answer'], quiz[0]['options'])
        self.assertEqual(quiz[0]['correct_answer'], 'Stack')
        self.assertEqual(normalize_quiz([{'type': 'true_false', 'question': 'A fact.', 'correct_answer': 'truthy'}]), [])

    def test_quiz_prefix_and_duplicate_ids(self):
        raw = dict(FIXTURE['quiz'][0], question='Lecture #101: Which structure is LIFO?')
        duplicate = dict(FIXTURE['quiz'][3], id=21)
        quiz = normalize_quiz([raw, duplicate])
        self.assertEqual(len(quiz), 1)
        self.assertEqual(quiz[0]['question'], 'Which structure is LIFO?')
        self.assertEqual(quiz[0]['id'], 21)

    def test_extraction_keeps_original_source(self):
        source = FIXTURE['segments'][0]['text']
        response = app_module.app.test_client().post('/api/extract', data={
            'file': (io.BytesIO(source.encode('utf-8')), 'source.txt'),
        }).get_json()
        self.assertEqual(response['text'], source)
        self.assertIn('ABC University', response['segments'][0]['text'])

    def test_history_read_does_not_mutate_source_or_disk(self):
        original = json.dumps(FIXTURE)
        with patch.object(app_module, 'load_history', return_value=[FIXTURE]), patch.object(app_module, 'save_history') as save:
            response = app_module.app.test_client().get('/api/history').get_json()['history'][0]
        self.assert_clean(response['reviewer'])
        self.assertEqual(response['title'], 'Algorithms')
        self.assertEqual(response['segments'], FIXTURE['segments'])
        self.assertEqual(json.dumps(FIXTURE), original)
        save.assert_not_called()

    def test_fallback_and_metadata_only(self):
        text = FIXTURE['segments'][0]['text']
        reviewer = local_fallback_synthesizer('--- [Page 1] ---\n' + text)
        self.assert_clean(reviewer)
        self.assertTrue(reviewer['keywords'])
        empty = local_fallback_synthesizer('ABC University\nLesson 1\nCS101')
        self.assertFalse(empty['keywords'])
        self.assertFalse(empty['quick_review'])

    def test_mocked_ai_and_transform_and_quiz_input(self):
        client = app_module.app.test_client()
        with patch.object(app_module, 'load_history', return_value=[]), patch.object(app_module, 'save_history'), patch.object(app_module, 'generate_reviewer_gemini', return_value=FIXTURE['reviewer']):
            reviewer = client.post('/api/generate-reviewer', json={'text': FIXTURE['segments'][0]['text'], 'api_key': 'test'}).get_json()['data']['reviewer']
        self.assert_clean(reviewer)
        with patch.object(app_module, 'transform_reviewer_gemini', return_value=FIXTURE['reviewer']):
            transformed = client.post('/api/transform', json={'reviewer': FIXTURE['reviewer'], 'action': 'eli5', 'api_key': 'test'}).get_json()['reviewer']
        self.assert_clean(transformed)
        with patch.object(app_module, 'generate_quiz_gemini', return_value=FIXTURE['quiz']) as generate:
            quiz = client.post('/api/generate-quiz', json={'reviewer': FIXTURE['reviewer'], 'api_key': 'test'}).get_json()['questions']
            self.assert_clean(generate.call_args.kwargs['reviewer_data'])
        self.assert_clean(quiz)

    def test_pdf_export_is_clean(self):
        buffer = app_module.build_reviewer_pdf(clean_record(FIXTURE))
        text = '\n'.join(page.extract_text() for page in PdfReader(io.BytesIO(buffer.getvalue())).pages)
        self.assert_clean(text)
        self.assertIn('Algorithms', text)
        self.assertIn('101', clean_text('Step 101: Compare values.'))
