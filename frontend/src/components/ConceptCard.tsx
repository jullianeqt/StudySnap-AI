import React from 'react';
import { Star } from 'lucide-react';
import type { CoreConceptItem, SourceReference } from '../types/reviewer';
import type { ReviewerSearch } from '../search';
import { SourceBadge } from './SourceBadge';
import { Highlight } from './Highlight';

interface ConceptCardProps {
  concept: CoreConceptItem;
  index: number;
  onOpenSource?: (ref: SourceReference) => void;
  isStarred?: boolean;
  onToggleStar?: (name: string) => void;
  search?: ReviewerSearch;
  /** Search-index path prefix for this card (e.g. `cc.0`). */
  basePath?: string;
}

export const ConceptCard: React.FC<ConceptCardProps> = ({
  concept,
  index,
  onOpenSource,
  isStarred = false,
  onToggleStar,
  search,
  basePath,
}) => {
  return (
    <div
      className={`p-5 rounded-2xl border transition-all duration-200 ${
        isStarred
          ? 'bg-amber-soft/30 border-amber-line ring-1 ring-amber-line shadow-xs'
          : 'bg-surface border-border hover:border-accent-line hover:shadow-xs'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center space-x-2.5 min-w-0">
          <span className="w-6 h-6 rounded-lg bg-accent-soft border border-accent-line text-accent-ink text-xs font-bold flex items-center justify-center shrink-0">
            {index + 1}
          </span>
          <h4 className="font-bold text-ink text-base break-words">
            <Highlight text={concept.concept} path={`${basePath}.name`} search={search} />
          </h4>
        </div>

        <button
          type="button"
          onClick={() => onToggleStar && onToggleStar(concept.concept)}
          aria-pressed={isStarred}
          className={`p-1.5 rounded-lg text-xs font-medium inline-flex items-center space-x-1 transition-colors shrink-0 ${
            isStarred
              ? 'bg-amber-soft text-amber-ink'
              : 'text-ink-muted hover:text-ink-soft hover:bg-sunken'
          }`}
          title={isStarred ? 'Unstar concept' : 'Star concept'}
          aria-label={isStarred ? `Unstar ${concept.concept}` : `Star ${concept.concept}`}
        >
          <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-amber-400 text-amber-ink' : ''}`} />
          <span className="text-[11px] hidden sm:inline">{isStarred ? 'Starred' : 'Star'}</span>
        </button>
      </div>

      <p className="mt-2.5 text-sm text-ink-soft leading-relaxed font-medium break-words">
        <Highlight text={concept.explanation} path={`${basePath}.exp`} search={search} />
      </p>

      {onOpenSource && (
        <SourceBadge sources={concept.sources} onSelect={onOpenSource} className="mt-2" />
      )}

      {concept.points && concept.points.length > 0 && (
        <ul className="mt-3.5 space-y-1.5 pt-2.5 border-t border-border">
          {concept.points.map((pt, pIdx) => (
            <li key={pIdx} className="flex items-start text-xs text-ink-soft space-x-2">
              <span className="text-accent-ink font-bold mt-0.5">•</span>
              <span className="leading-normal break-words min-w-0">
                <Highlight text={pt} path={`${basePath}.pt.${pIdx}`} search={search} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
