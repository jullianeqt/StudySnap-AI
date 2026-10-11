import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fixture from './fixtures/noisyContent.json';
import type { ReviewerRecord, QuizQuestion } from './types/reviewer';
import { cleanRecord, cleanReviewer, cleanQuiz, cleanText } from './contentFilter';
import { buildStudyCards } from './studyCards';
import { Reviewer } from './components/Reviewer';
import { ReviewerHistory } from './components/ReviewerHistory';
import { StudyMode } from './components/StudyMode';
import { QuizModal } from './components/QuizModal';
import { QuizResults } from './components/QuizResults';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
const record = fixture as unknown as ReviewerRecord;
const quiz = fixture.quiz as QuizQuestion[];
const metadata = /\b(?:university|lesson\s*[:#]?\s*0*1|lecture\s*#?\s*101|computer science 101|CS\s*101)\b/i;

describe('shared content filtering and rendered surfaces', () => {
  it('cleans all nested sections, preserves provenance, and is idempotent', () => {
    const clean = cleanRecord(record);
    expect(JSON.stringify(clean.reviewer)).not.toMatch(metadata);
    expect(clean.title).toBe('Algorithms');
    expect(clean.subject).toBe('Data Structures');
    expect(clean.reviewer.keywords).toHaveLength(1);
    expect(clean.reviewer.process_steps[0].steps).toHaveLength(1);
    expect(clean.reviewer.keywords[0].sources).toEqual(record.reviewer.keywords[0].sources);
    expect(clean.segments).toBe(record.segments);
    expect(clean.filename).toBe(record.filename);
    expect(cleanRecord(clean)).toEqual(clean);
  });

  it('retains historical university references, procedures, and meaningful numbers', () => {
    for (const value of ['The University of Cambridge was founded in 1209.', 'University research requires careful methods.', 'Step 101: Compare the values.', '1. Heat the sample to 101 degrees.', 'F = 1.01 N', 'Do not divide by zero.', 'A | B', 'A — B', 'if x:\n    return 101']) {
      expect(cleanText(value)).toBe(value);
    }
    for (const value of ['LESSON 01', 'Lesson: 1', 'Lecture #101', 'CS 101', 'ABC University', 'University of Example']) expect(cleanText(value)).toBe('');
    expect(cleanText('ABC University - Lesson 1: Algorithms')).toBe('Algorithms');
    const academic = cleanReviewer({ ...record.reviewer, keywords: [{ term: 'University', definition: 'A university is an institution of higher education.' }] });
    expect(academic.keywords[0].term).toBe('University');
  });

  it('builds flashcards only from cleaned academic items', () => {
    const cards = buildStudyCards(record.reviewer);
    expect(cards.length).toBeGreaterThan(0);
    expect(JSON.stringify(cards)).not.toMatch(metadata);
    expect(cards.find(card => card.kind === 'keyword')?.front).toBe('What is Algorithm?');
  });

  it('rejects lost or duplicate options while keeping answer keys and IDs aligned', () => {
    const questions = cleanQuiz(quiz);
    expect(questions.map(question => question.id)).toEqual([21, 24]);
    expect(JSON.stringify(questions)).not.toMatch(metadata);
    expect(questions[0].options).toContain(questions[0].correct_answer);
    expect(cleanQuiz([{ ...quiz[0], options: ['Stack', 'University'], correct_answer: 'Stack' }])).toEqual([]);
    const prefixed = { ...quiz[0], question: 'Lecture #101: Which structure is LIFO?' };
    expect(cleanQuiz([prefixed, { ...quiz[3], id: 21 }])).toHaveLength(1);
    expect(cleanQuiz([prefixed])[0].question).toBe('Which structure is LIFO?');
  });

  it('renders a complete reviewer and copies clean export text', async () => {
    const user = userEvent.setup();
    const { container } = render(<Reviewer record={record} onOpenQuizGenerator={vi.fn()} onTransform={vi.fn()}
      onExportPdf={vi.fn()} onSelectCompression={vi.fn()} />);
    expect(container.textContent).not.toMatch(metadata);
    expect(screen.getByRole('heading', { name: 'Algorithms' })).toBeInTheDocument();
    expect(screen.getByText('W = F × d')).toBeInTheDocument();
    expect(screen.getByText('Compare the target with the current item.')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Copy reviewer as text'));
    expect(await navigator.clipboard.readText()).not.toMatch(metadata);
    await user.type(screen.getByLabelText('Search the entire reviewer'), 'Lesson 1');
    expect(screen.queryByText('Lesson 1')).not.toBeInTheDocument();
  });

  it('renders old history cleanly and reopens a filtered record', async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    const { container } = render(<ReviewerHistory history={[record]} isOpen onClose={vi.fn()}
      onSelectReviewer={select} onClearHistory={vi.fn()} onDeleteReviewer={vi.fn()} />);
    expect(container.textContent).not.toMatch(metadata);
    await user.click(screen.getByRole('button', { name: /Open reviewer/ }));
    expect(JSON.stringify(select.mock.calls[0][0].reviewer)).not.toMatch(metadata);
    expect(select.mock.calls[0][0].segments).toEqual(record.segments);
  });

  it('renders study mode and revealed answers from clean data', async () => {
    const user = userEvent.setup();
    const { container } = render(<StudyMode record={record} onClose={vi.fn()} />);
    expect(container.textContent).not.toMatch(metadata);
    await user.click(screen.getByRole('button', { name: /Reveal/ }));
    expect(container.textContent).not.toMatch(metadata);
    expect(screen.getByText('An algorithm is an ordered sequence of steps.')).toBeInTheDocument();
  });

  it('renders quiz questions and results with consistent scoring after filtering', async () => {
    const user = userEvent.setup();
    const { container } = render(<QuizModal isOpen onClose={vi.fn()} questions={quiz} onScrollToTopic={vi.fn()} />);
    expect(container.textContent).not.toMatch(metadata);
    await user.click(screen.getByRole('button', { name: 'Stack' }));
    await user.click(screen.getByRole('button', { name: 'Next Question' }));
    await user.click(screen.getByRole('button', { name: 'True' }));
    await user.click(screen.getByRole('button', { name: 'Finish Quiz' }));
    expect(container.textContent).not.toMatch(metadata);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('filters legacy result fields and preserves the original fixture', () => {
    const snapshot = JSON.stringify(fixture);
    const { container } = render(<QuizResults questions={quiz} userAnswers={{ 21: 'Lesson 1: Stack', 24: 'True' }}
      onRetake={vi.fn()} onBackToReviewer={vi.fn()} />);
    expect(container.textContent).not.toMatch(metadata);
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(JSON.stringify(fixture)).toBe(snapshot);
    expect(cleanReviewer(record.reviewer).quick_review).toHaveLength(1);
  });
});
