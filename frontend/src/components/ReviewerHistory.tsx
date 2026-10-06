import React, { useEffect, useMemo, useState } from 'react';
import {
  History, BookOpen, Calendar, Layers, ArrowRight, Trash2, CheckCircle2,
  FileText, Cpu, Search, ArrowUpDown, FilterX,
} from 'lucide-react';
import type { ReviewerRecord } from '../types/reviewer';
import { providerLabel } from '../source';

interface ReviewerHistoryProps {
  history: ReviewerRecord[];
  onSelectReviewer: (record: ReviewerRecord) => void;
  onClearHistory: () => void;
  onDeleteReviewer: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

type SortOrder = 'newest' | 'oldest';

export const ReviewerHistory: React.FC<ReviewerHistoryProps> = ({
  history,
  onSelectReviewer,
  onClearHistory,
  onDeleteReviewer,
  isOpen,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const subjects = useMemo(() => {
    const names = history
      .map((item) => (item.subject || '').trim())
      .filter(Boolean);
    return Array.from(new Set(names));
  }, [history]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = history.filter((item) => {
      if (subjectFilter !== 'all' && (item.subject || '').trim() !== subjectFilter) return false;
      if (!needle) return true;
      return [item.title, item.subject, item.filename].some((value) =>
        (value || '').toLowerCase().includes(needle),
      );
    });
    // Backend order is newest-first, so reversing yields oldest-first.
    return sort === 'oldest' ? [...filtered].reverse() : filtered;
  }, [history, query, sort, subjectFilter]);

  const clearFilters = () => {
    setQuery('');
    setSubjectFilter('all');
  };

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

        {/* Search / sort / subject filter */}
        {history.length > 0 && (
          <div className="p-3 border-b border-border space-y-2 no-print">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-ink-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search history by title, subject, or filename"
                placeholder="Search history..."
                className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-border bg-sunken focus:bg-surface focus:outline-none focus:border-accent"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear history search"
                  className="absolute right-2 top-1.5 text-ink-muted hover:text-ink-soft text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setSort((order) => (order === 'newest' ? 'oldest' : 'newest'))}
                aria-label={`Sort order: ${sort === 'newest' ? 'newest first' : 'oldest first'}. Activate to switch.`}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-border bg-sunken text-ink-soft hover:text-accent-ink transition-colors inline-flex items-center space-x-1.5"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>{sort === 'newest' ? 'Newest first' : 'Oldest first'}</span>
              </button>

              {subjectFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSubjectFilter('all')}
                  className="text-xs font-semibold text-accent-ink hover:underline inline-flex items-center space-x-1"
                >
                  <FilterX className="w-3.5 h-3.5" />
                  <span>Clear subject</span>
                </button>
              )}
            </div>

            {subjects.length >= 2 && (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by subject">
                <button
                  type="button"
                  onClick={() => setSubjectFilter('all')}
                  aria-pressed={subjectFilter === 'all'}
                  className={`px-2 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                    subjectFilter === 'all'
                      ? 'bg-accent-soft text-accent-ink border-accent-line'
                      : 'bg-sunken text-ink-muted border-border hover:text-ink-soft'
                  }`}
                >
                  All subjects
                </button>
                {subjects.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => setSubjectFilter(subject)}
                    aria-pressed={subjectFilter === subject}
                    className={`px-2 py-1 rounded-full text-[11px] font-bold border transition-colors max-w-[10rem] truncate ${
                      subjectFilter === subject
                        ? 'bg-accent-soft text-accent-ink border-accent-line'
                        : 'bg-sunken text-ink-muted border-border hover:text-ink-soft'
                    }`}
                    title={subject}
                  >
                    {subject}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* List of Recent Reviewers */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-ink-muted">
              <BookOpen className="w-12 h-12 stroke-[1.5] mb-2 text-border-strong" />
              <p className="text-sm font-semibold text-ink-soft">Your generated reviewers will appear here.</p>
              <p className="text-xs text-ink-muted mt-1">
                Upload a lecture or paste notes to generate your first study sheet!
              </p>
            </div>
          ) : visible.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-ink-muted">
              <Search className="w-10 h-10 stroke-[1.5] mb-2 text-border-strong" />
              <p className="text-sm font-semibold text-ink-soft">No reviewers match your search.</p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 px-4 py-2 rounded-xl border border-border bg-sunken text-ink-soft text-xs font-bold hover:text-accent-ink transition-colors"
              >
                Clear search & filters
              </button>
            </div>
          ) : (
            visible.map((item) => (
              <div key={item.id} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    onSelectReviewer(item);
                    onClose();
                  }}
                  className="w-full text-left p-4 pr-11 rounded-2xl border border-border hover:border-accent bg-surface hover:bg-accent-soft/20 transition-all cursor-pointer shadow-2xs group"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-accent-soft text-accent-ink border border-accent-line truncate max-w-[10rem]">
                      {item.subject || 'Untitled subject'}
                    </span>
                    <span className="flex items-center space-x-1 text-[11px] text-emerald-ink font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{item.status || 'Ready'}</span>
                    </span>
                  </div>

                  <h4 className="mt-2 font-bold text-ink text-sm group-hover:text-accent-ink transition-colors line-clamp-2">
                    {item.title}
                  </h4>

                  <ul className="mt-2 space-y-1 text-[11px] text-ink-muted">
                    {item.filename && (
                      <li className="flex items-center space-x-1.5 min-w-0">
                        <FileText className="w-3 h-3 shrink-0" />
                        <span className="truncate" title={item.filename}>{item.filename}</span>
                      </li>
                    )}
                    <li className="flex items-center space-x-1.5">
                      <Calendar className="w-3 h-3 shrink-0" />
                      <span>{item.date_created}</span>
                    </li>
                    <li className="flex items-center space-x-1.5">
                      <Layers className="w-3 h-3 shrink-0" />
                      <span>
                        {item.pages_processed}{' '}
                        {item.pages_processed === 1 ? 'page/slide' : 'pages/slides'}
                      </span>
                    </li>
                    <li className="flex items-center space-x-1.5 min-w-0">
                      <Cpu className="w-3 h-3 shrink-0" />
                      <span className="truncate" title={providerLabel(item.ai_provider)}>
                        {providerLabel(item.ai_provider)}
                      </span>
                    </li>
                  </ul>

                  <div className="mt-2.5 flex justify-end text-[11px] text-accent-ink font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="inline-flex items-center space-x-1">
                      <span>Open reviewer</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </button>

                {/* Sibling (never nested) so a card stays one clean button */}
                <button
                  type="button"
                  onClick={() => onDeleteReviewer(item.id)}
                  aria-label={`Delete reviewer ${item.title} from history`}
                  title="Delete this reviewer"
                  className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-ink-muted hover:text-rose-ink hover:bg-rose-soft border border-transparent hover:border-rose-line transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
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
              {visible.length === history.length
                ? `${history.length} saved session${history.length > 1 ? 's' : ''}`
                : `${visible.length} of ${history.length} sessions`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
