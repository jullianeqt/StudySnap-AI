import React, { useState } from 'react';
import { Star, Copy, Check } from 'lucide-react';
import type { KeywordItem } from '../types/reviewer';

interface KeywordCardProps {
  keyword: KeywordItem;
  onToggleStar?: (term: string) => void;
  isStarred?: boolean;
}

export const KeywordCard: React.FC<KeywordCardProps> = ({
  keyword,
  onToggleStar,
  isStarred = false,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${keyword.term} — ${keyword.definition}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className={`group relative p-4 rounded-xl border transition-all duration-200 bg-surface hover:shadow-md ${
      isStarred
        ? 'border-amber-line bg-amber-soft/20 shadow-xs ring-1 ring-amber-line'
        : 'border-border hover:border-accent-line'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-ink text-base group-hover:text-accent-ink transition-colors">
            {keyword.term}
          </span>
          {keyword.importance === 'high' && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-rose-soft text-rose-ink">
              Exam Core
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 text-ink-muted hover:text-ink-soft rounded-md hover:bg-sunken"
            title="Copy definition"
            aria-label={`Copy definition of ${keyword.term}`}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-ink" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => onToggleStar && onToggleStar(keyword.term)}
            aria-pressed={isStarred}
            className={`p-1 rounded-md transition-colors ${
              isStarred
                ? 'text-amber-ink hover:bg-amber-soft'
                : 'text-ink-muted hover:text-amber-ink hover:bg-sunken'
            }`}
            title={isStarred ? "Starred for review" : "Star term"}
            aria-label={isStarred ? `Unstar ${keyword.term}` : `Star ${keyword.term}`}
          >
            <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-amber-400 text-amber-ink' : ''}`} />
          </button>
        </div>
      </div>

      <p className="mt-1.5 text-sm text-ink-soft leading-relaxed">
        <span className="text-ink-muted font-medium mr-1.5">—</span>
        {keyword.definition}
      </p>
    </div>
  );
};

