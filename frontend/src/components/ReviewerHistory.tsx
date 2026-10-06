import React, { useEffect } from 'react';
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
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-dialog-title"
        className="bg-surface w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-sunken">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent-soft text-accent-ink flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 id="history-dialog-title" className="font-bold text-ink text-base">Recent Reviewers</h3>
              <p className="text-xs text-ink-muted">Your saved study sheets & history</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close history"
            className="text-ink-muted hover:text-ink-soft p-1.5 rounded-lg hover:bg-border transition-colors"
          >
            ✕
          </button>
        </div>

        {/* List of Recent Reviewers */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-ink-muted">
              <BookOpen className="w-12 h-12 stroke-[1.5] mb-2 text-border-strong" />
              <p className="text-sm font-semibold text-ink-soft">No recent reviewers yet</p>
              <p className="text-xs text-ink-muted mt-1">
                Upload a lecture or paste notes to generate your first study sheet!
              </p>
            </div>
          ) : (
            history.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectReviewer(item);
                  onClose();
                }}
                className="w-full text-left p-4 rounded-2xl border border-border hover:border-accent bg-surface hover:bg-accent-soft/20 transition-all cursor-pointer shadow-2xs group"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-accent-soft text-accent-ink border border-accent-line">
                    {item.subject}
                  </span>
                  <div className="flex items-center space-x-1 text-[11px] text-emerald-ink font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Ready</span>
                  </div>
                </div>

                <h4 className="mt-2 font-bold text-ink text-sm group-hover:text-accent-ink transition-colors line-clamp-1">
                  {item.title}
                </h4>

                <div className="mt-3 flex items-center justify-between text-xs text-ink-muted border-t border-border pt-2.5">
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

                  <ArrowRight className="w-4 h-4 text-border-strong group-hover:text-accent-ink group-hover:translate-x-1 transition-all" />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className="p-4 border-t border-border bg-sunken flex items-center justify-between">
            <button
              type="button"
              onClick={onClearHistory}
              className="text-xs text-rose-ink hover:text-rose-hover font-medium flex items-center space-x-1 px-2 py-1 rounded hover:bg-rose-soft transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
            <span className="text-xs text-ink-muted">
              {history.length} saved session{history.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

