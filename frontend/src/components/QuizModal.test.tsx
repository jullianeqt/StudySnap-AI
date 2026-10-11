import { createRef, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuizModal } from './QuizModal';
import type { QuizQuestion } from '../types/reviewer';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
const questions: QuizQuestion[] = [1, 2].map(id => ({
  id, type: 'true_false', question: `Question ${id}`, correct_answer: 'True',
  topic: 'Algorithms', explanation: 'Source fact.',
}));

function Harness({ closed = vi.fn() }) {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)}>Practice Quiz</button>
    <QuizModal isOpen={open} onClose={() => { closed(); setOpen(false); }}
      questions={questions} onScrollToTopic={vi.fn()} />
  </>;
}

async function openQuiz(closed = vi.fn()) {
  const user = userEvent.setup();
  render(<Harness closed={closed} />);
  await user.click(screen.getByRole('button', { name: 'Practice Quiz' }));
  return { user, closed };
}

describe('quiz exit', () => {
  it('returns focus to the reviewer opener across the generator-to-quiz transition', async () => {
    const user = userEvent.setup();
    const opener = createRef<HTMLButtonElement>();
    const props = { onClose: vi.fn(), questions, onScrollToTopic: vi.fn(), returnFocusRef: opener };
    const { rerender } = render(<>
      <button ref={opener}>Reviewer quiz control</button>
      <QuizModal {...props} isOpen={false} />
    </>);
    rerender(<>
      <button ref={opener}>Reviewer quiz control</button>
      <QuizModal {...props} isOpen={true} />
    </>);
    expect(screen.getByRole('button', { name: 'Exit Quiz' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Exit Quiz' }));
    rerender(<>
      <button ref={opener}>Reviewer quiz control</button>
      <QuizModal {...props} isOpen={false} />
    </>);
    expect(screen.getByRole('button', { name: 'Reviewer quiz control' })).toHaveFocus();
  });

  it('exits before answering and returns focus without producing results', async () => {
    const { user, closed } = await openQuiz();
    await user.click(screen.getByRole('button', { name: 'Exit Quiz' }));
    expect(closed).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Quiz Complete!')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Practice Quiz' })).toHaveFocus();
  });

  it('cancels confirmation and preserves answers and question position', async () => {
    const { user, closed } = await openQuiz();
    await user.click(screen.getByRole('button', { name: 'True' }));
    await user.click(screen.getByRole('button', { name: 'Next Question' }));
    await user.click(screen.getByRole('button', { name: 'Exit Quiz' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue Quiz' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Continue Quiz' }));
    expect(closed).not.toHaveBeenCalled();
    expect(screen.getByText('Question 2 of 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByRole('button', { name: 'True' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('confirms unfinished exit without submitting and reopens cleanly', async () => {
    const { user, closed } = await openQuiz();
    await user.click(screen.getByRole('button', { name: 'True' }));
    await user.click(screen.getByRole('button', { name: 'Next Question' }));
    await user.click(screen.getByRole('button', { name: 'Exit Quiz' }));
    await user.click(screen.getByRole('button', { name: 'Exit Quiz' }));
    expect(closed).toHaveBeenCalledOnce();
    expect(screen.queryByText('Quiz Complete!')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Practice Quiz' }));
    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'True' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('exits results immediately and reopens a fresh attempt', async () => {
    const { user } = await openQuiz();
    await user.click(screen.getByRole('button', { name: 'True' }));
    await user.click(screen.getByRole('button', { name: 'Next Question' }));
    await user.click(screen.getByRole('button', { name: 'True' }));
    await user.click(screen.getByRole('button', { name: 'Finish Quiz' }));
    expect(screen.getByText('Quiz Complete!')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Exit Quiz' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Practice Quiz' }));
    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'True' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('guards Escape and supports keyboard confirmation and focus trapping', async () => {
    const { user, closed } = await openQuiz();
    await user.click(screen.getByRole('button', { name: 'True' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Exit Quiz' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(closed).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    await user.tab();
    await user.keyboard('{Enter}');
    expect(closed).toHaveBeenCalledOnce();
  });
});
