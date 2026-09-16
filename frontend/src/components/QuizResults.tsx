import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, CheckCircle, XCircle, RefreshCw, ArrowLeft, AlertTriangle } from 'lucide-react';
import type { QuizQuestion } from '../types/reviewer';

interface QuizResultsProps {
  questions: QuizQuestion[];
  userAnswers: Record<number, string>;
  onRetake: () => void;
  onBackToReviewer: (topicToScroll?: string) => void;
}

export const QuizResults: React.FC<QuizResultsProps> = ({
  questions,
  userAnswers,
  onRetake,
  onBackToReviewer,
}) => {
  let correctCount = 0;
  const reviewTopicsSet = new Set<string>();

  questions.forEach((q) => {
    const userAns = (userAnswers[q.id] || "").trim().toLowerCase();
    const correctAns = (q.correct_answer || "").trim().toLowerCase();
    const isCorrect = userAns === correctAns;

    if (isCorrect) {
      correctCount++;
    } else if (q.topic) {
      reviewTopicsSet.add(q.topic);
    }
  });

  const total = questions.length;
  const percentage = Math.round((correctCount / total) * 100);
  const reviewTopics = Array.from(reviewTopicsSet);

  useEffect(() => {
    if (percentage >= 70) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [percentage]);

  const getScoreColor = () => {
    if (percentage >= 85) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (percentage >= 60) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Score Header Card */}
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center relative overflow-hidden">
        <div className="inline-flex p-4 rounded-2xl bg-indigo-50 text-indigo-600 mb-3">
          <Trophy className="w-8 h-8" />
        </div>

        <h2 className="text-2xl font-bold text-slate-900">Quiz Complete!</h2>
        <p className="text-sm text-slate-500 mt-1">Here is your performance breakdown</p>

        <div className="mt-6 flex items-center justify-center space-x-4">
          <div className={`px-6 py-4 rounded-2xl border font-bold text-3xl ${getScoreColor()}`}>
            {correctCount} / {total}
          </div>
          <div className="text-left">
            <p className="text-2xl font-black text-slate-900">{percentage}%</p>
            <p className="text-xs text-slate-500 font-medium">
              {percentage >= 80 ? 'Mastery Level - Ready for Quiz!' : percentage >= 50 ? 'Good Progress - Review missed topics' : 'Needs Review - Check flagged concepts'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onRetake}
            className="px-5 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-sm transition-colors inline-flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retake Quiz</span>
          </button>
          <button
            type="button"
            onClick={() => onBackToReviewer()}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-semibold text-sm transition-colors shadow-xs inline-flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Reviewer</span>
          </button>
        </div>
      </div>

      {/* Topics the student should review again */}
      {reviewTopics.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Topics You Should Review Again</span>
          </div>
          <p className="text-xs text-amber-800/80 mb-3">
            Based on the questions you missed, we recommend reviewing these specific terms/concepts:
          </p>
          <div className="flex flex-wrap gap-2">
            {reviewTopics.map((topic, tIdx) => (
              <button
                key={tIdx}
                type="button"
                onClick={() => onBackToReviewer(topic)}
                className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-950 font-semibold text-xs hover:bg-amber-100 transition-colors shadow-2xs inline-flex items-center space-x-1.5"
              >
                <span>🔍</span>
                <span>{topic}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Question Review List */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-900 text-lg">Detailed Question Breakdown</h3>

        {questions.map((q, idx) => {
          const userAns = userAnswers[q.id] || "No answer provided";
          const isCorrect = userAns.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();

          return (
            <div
              key={q.id}
              className={`p-5 rounded-2xl border bg-white transition-all ${
                isCorrect ? 'border-emerald-200' : 'border-rose-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start space-x-3">
                  <div className="mt-0.5">
                    {isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">
                      {idx + 1}. {q.question}
                    </p>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-0.5 inline-block">
                      Topic: {q.topic}
                    </span>
                  </div>
                </div>
              </div>

              {/* Answers */}
              <div className="mt-3.5 pl-8 space-y-1 text-xs">
                <p className="text-slate-600">
                  <span className="font-semibold text-slate-500">Your Answer: </span>
                  <span className={isCorrect ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                    {userAns}
                  </span>
                </p>
                {!isCorrect && (
                  <p className="text-emerald-700 font-medium">
                    <span className="font-semibold text-slate-500">Correct Answer: </span>
                    <span className="font-bold">{q.correct_answer}</span>
                  </p>
                )}
                {q.explanation && (
                  <div className="mt-2 p-2.5 bg-slate-50 rounded-xl text-slate-600 border border-slate-100">
                    <span className="font-semibold text-slate-700">Explanation: </span>
                    {q.explanation}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

