import React, { useEffect, useState } from 'react';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import type { QuizQuestion } from '../types/reviewer';
import { QuizResults } from './QuizResults';

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: QuizQuestion[];
  onScrollToTopic: (topic: string) => void;
}

export const QuizModal: React.FC<QuizModalProps> = ({
  isOpen,
  onClose,
  questions,
  onScrollToTopic,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || questions.length === 0) return null;

  const currentQ = questions[currentIndex];
  const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100);

  const handleSelectOption = (optionText: string) => {
    setUserAnswers((prev) => ({
      ...prev,
      [currentQ.id]: optionText,
    }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsFinished(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleRetake = () => {
    setUserAnswers({});
    setCurrentIndex(0);
    setIsFinished(false);
  };

  const handleBackToReviewer = (topic?: string) => {
    onClose();
    if (topic) {
      onScrollToTopic(topic);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-dialog-title"
        className="bg-sunken rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-border relative my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <span id="quiz-dialog-title" className="px-2.5 py-1 text-xs font-bold rounded-lg bg-accent-soft text-accent-ink">
              Exam Practice Quiz
            </span>
            <span className="text-xs text-ink-muted" aria-live="polite">
              {!isFinished && `Question ${currentIndex + 1} of ${questions.length}`}
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="Close quiz"
            className="p-1.5 text-ink-muted hover:text-ink-soft rounded-lg hover:bg-border/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quiz Body or Results */}
        {!isFinished ? (
          <div className="mt-6 space-y-6">
            {/* Progress Bar */}
            <div className="w-full bg-border h-2 rounded-full overflow-hidden" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Quiz progress">
              <div
                className="bg-accent h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Question Card */}
            <div className="bg-surface rounded-2xl p-6 border border-border shadow-xs">
              <div className="flex items-center justify-between mb-3 text-xs text-ink-muted font-semibold uppercase tracking-wider">
                <span>{currentQ.type.replace('_', ' ')}</span>
                <span className="text-accent-ink">Topic: {currentQ.topic}</span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-ink leading-snug">
                {currentQ.question}
              </h3>

              {/* Options */}
              <div className="mt-6 space-y-2.5">
                {currentQ.type === 'multiple_choice' && currentQ.options?.map((opt, oIdx) => {
                  const isSelected = userAnswers[currentQ.id] === opt;
                  return (
                    <button
                      key={oIdx}
                      type="button"
                      onClick={() => handleSelectOption(opt)}
                      aria-pressed={isSelected}
                      className={`w-full text-left p-3.5 rounded-xl border text-sm transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-accent bg-accent-soft/70 font-semibold text-ink ring-1 ring-accent'
                          : 'border-border bg-surface hover:bg-sunken text-ink-soft'
                      }`}
                    >
                      <span>{opt}</span>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-accent bg-accent text-white' : 'border-border-strong'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}

                {currentQ.type === 'true_false' && (
                  <div className="grid grid-cols-2 gap-3">
                    {['True', 'False'].map((tf) => {
                      const isSelected = userAnswers[currentQ.id] === tf;
                      return (
                        <button
                          key={tf}
                          type="button"
                          onClick={() => handleSelectOption(tf)}
                          aria-pressed={isSelected}
                          className={`p-4 rounded-xl border text-center font-bold text-base transition-all ${
                            isSelected
                              ? 'border-accent bg-accent-soft text-accent-ink ring-2 ring-accent'
                              : 'border-border bg-surface hover:bg-sunken text-ink-soft'
                          }`}
                        >
                          {tf}
                        </button>
                      );
                    })}
                  </div>
                )}

                {currentQ.type === 'identification' && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={userAnswers[currentQ.id] || ''}
                      onChange={(e) => handleSelectOption(e.target.value)}
                      aria-label={`Answer for question ${currentIndex + 1}`}
                      placeholder="Type the exact term or concept..."
                      className="w-full p-3.5 rounded-xl border border-border-strong bg-surface text-ink text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-line"
                    />
                    <p className="text-[11px] text-ink-muted">
                      Hint: Identification answers are checked case-insensitively against the reviewer.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="px-4 py-2.5 rounded-xl border border-border bg-surface text-ink-soft font-semibold text-xs hover:bg-sunken transition-colors disabled:opacity-30 disabled:pointer-events-none flex items-center space-x-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2.5 rounded-xl bg-accent text-white font-semibold text-xs hover:bg-accent-hover transition-colors shadow-xs flex items-center space-x-1.5"
              >
                <span>{currentIndex === questions.length - 1 ? 'Finish Quiz' : 'Next Question'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <QuizResults
            questions={questions}
            userAnswers={userAnswers}
            onRetake={handleRetake}
            onBackToReviewer={handleBackToReviewer}
          />
        )}
      </div>
    </div>
  );
};

