import React, { useState } from 'react';
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
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Generate Quiz</h3>
              <p className="text-xs text-slate-500">Practice questions based exclusively on this reviewer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Question Count Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Number of Questions
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 20].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setQuestionCount(count)}
                  className={`py-2 text-sm font-semibold rounded-xl border transition-all ${
                    questionCount === count
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* Question Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
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
                  className={`p-3 text-left rounded-xl border transition-all ${
                    questionType === t.id
                      ? 'bg-indigo-50/70 border-indigo-500 ring-1 ring-indigo-500'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <p className={`text-xs font-bold ${questionType === t.id ? 'text-indigo-900' : 'text-slate-800'}`}>
                    {t.label}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
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

