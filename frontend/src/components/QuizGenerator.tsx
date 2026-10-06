import React, { useEffect, useState } from 'react';
import { HelpCircle, Play, X } from 'lucide-react';
import type { QuizConfig } from '../types/reviewer';

interface QuizGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateQuiz: (config: QuizConfig) => void;
  isGenerating?: boolean;
}

export const QuizGenerator: React.FC<QuizGeneratorProps> = ({
  isOpen,
  onClose,
  onGenerateQuiz,
  isGenerating = false,
}) => {
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [questionType, setQuestionType] = useState<QuizConfig['question_type']>('mixed');

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerateQuiz({
      question_count: questionCount,
      question_type: questionType,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-generator-dialog-title"
        className="bg-surface rounded-3xl max-w-md w-full p-6 shadow-2xl border border-border relative animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent-ink flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="quiz-generator-dialog-title" className="font-bold text-ink text-lg">Generate Quiz</h3>
              <p className="text-xs text-ink-muted">Practice questions based exclusively on this reviewer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            aria-label="Close quiz generator"
            className="p-1.5 text-ink-muted hover:text-ink-soft rounded-lg hover:bg-sunken transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Question Count Selector */}
          <div>
            <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2">
              Number of Questions
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 20].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setQuestionCount(count)}
                  aria-pressed={questionCount === count}
                  className={`py-2 text-sm font-semibold rounded-xl border transition-all ${
                    questionCount === count
                      ? 'bg-accent text-white border-accent shadow-sm'
                      : 'bg-sunken text-ink-soft border-border hover:bg-border/70'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* Question Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2">
              Question Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'mixed', label: 'Mixed (Recommended)', desc: 'MCQ, T/F & Ident' },
                { id: 'multiple_choice', label: 'Multiple Choice', desc: '4 options each' },
                { id: 'true_false', label: 'True / False', desc: 'Fact validation' },
                { id: 'identification', label: 'Identification', desc: 'Key term recall' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setQuestionType(t.id as any)}
                  aria-pressed={questionType === t.id}
                  className={`p-3 text-left rounded-xl border transition-all ${
                    questionType === t.id
                      ? 'bg-accent-soft/70 border-accent ring-1 ring-accent'
                      : 'bg-surface border-border hover:bg-sunken'
                  }`}
                >
                  <p className={`text-xs font-bold ${questionType === t.id ? 'text-accent-ink' : 'text-ink'}`}>
                    {t.label}
                  </p>
                  <p className="text-[11px] text-ink-muted mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-3 px-4 bg-accent hover:bg-accent-hover text-white font-semibold rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin mr-2">⚡</span>
                  <span>Generating practice questions...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Practice Quiz</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

