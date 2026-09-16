import React from 'react';
import { History, BookOpen, Calendar, Layers, ArrowRight, Trash2, CheckCircle2 } from 'lucide-react';
import type { ReviewerRecord } from '../types/reviewer';

interface ReviewerHistoryProps {
  history: ReviewerRecord[];
  onSelectReviewer: (record: ReviewerRecord) => void;
  onClearHistory: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const ReviewerHistory: React.FC<ReviewerHistoryProps> = ({
  history,
  onSelectReviewer,
  onClearHistory,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Recent Reviewers</h3>
              <p className="text-xs text-slate-500">Your saved study sheets & history</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* List of Recent Reviewers */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <BookOpen className="w-12 h-12 stroke-[1.5] mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">No recent reviewers yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Upload a lecture or paste notes to generate your first study sheet!
              </p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  onSelectReviewer(item);
                  onClose();
                }}
                className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/20 transition-all cursor-pointer shadow-2xs group"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {item.subject}
                  </span>
                  <div className="flex items-center space-x-1 text-[11px] text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Ready</span>
                  </div>
                </div>

                <h4 className="mt-2 font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors line-clamp-1">
                  {item.title}
                </h4>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-2.5">
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>{item.date_created.split(' - ')[0]}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Layers className="w-3 h-3" />
                      <span>{item.pages_processed} {item.pages_processed === 1 ? 'page' : 'pages'}</span>
                    </span>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <button
              type="button"
              onClick={onClearHistory}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center space-x-1 px-2 py-1 rounded hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
            <span className="text-xs text-slate-400">
              {history.length} saved session{history.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

