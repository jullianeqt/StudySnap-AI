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
    <div className={`group relative p-4 rounded-xl border transition-all duration-200 bg-white hover:shadow-md ${
      isStarred
        ? 'border-amber-300 bg-amber-50/20 shadow-xs ring-1 ring-amber-200'
        : 'border-slate-200 hover:border-indigo-300'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-slate-900 text-base group-hover:text-indigo-600 transition-colors">
            {keyword.term}
          </span>
          {keyword.importance === 'high' && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
              Exam Core
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100"
            title="Copy definition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => onToggleStar && onToggleStar(keyword.term)}
            className={`p-1 rounded-md transition-colors ${
              isStarred
                ? 'text-amber-500 hover:bg-amber-100'
                : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100'
            }`}
            title={isStarred ? "Starred for review" : "Star term"}
          >
            <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-amber-400 text-amber-500' : ''}`} />
          </button>
        </div>
      </div>

      <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
        <span className="text-slate-400 font-medium mr-1.5">—</span>
        {keyword.definition}
      </p>
    </div>
  );
};

