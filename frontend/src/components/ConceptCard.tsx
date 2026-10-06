import React, { useState } from 'react';
import { Pin } from 'lucide-react';
import type { CoreConceptItem } from '../types/reviewer';

interface ConceptCardProps {
  concept: CoreConceptItem;
  index: number;
}

export const ConceptCard: React.FC<ConceptCardProps> = ({ concept, index }) => {
  const [highlighted, setHighlighted] = useState(false);

  return (
    <div className={`p-5 rounded-2xl border transition-all duration-200 ${
      highlighted
        ? 'bg-amber-soft/40 border-amber-line ring-2 ring-amber-line shadow-sm'
        : 'bg-surface border-border hover:border-accent-line hover:shadow-xs'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <span className="w-6 h-6 rounded-lg bg-accent-soft border border-accent-line text-accent-ink text-xs font-bold flex items-center justify-center">
            {index + 1}
          </span>
          <h4 className="font-bold text-ink text-base">
            {concept.concept}
          </h4>
        </div>

        <button
          type="button"
          onClick={() => setHighlighted(!highlighted)}
          aria-pressed={highlighted}
          className={`p-1.5 rounded-lg text-xs font-medium inline-flex items-center space-x-1 transition-colors ${
            highlighted
              ? 'bg-amber-soft text-amber-ink'
              : 'text-ink-muted hover:text-ink-soft hover:bg-sunken'
          }`}
          title={highlighted ? "Remove highlight" : "Highlight concept"}
        >
          <Pin className={`w-3.5 h-3.5 ${highlighted ? 'fill-amber-600 text-amber-ink rotate-45' : ''}`} />
          <span className="text-[11px] hidden sm:inline">{highlighted ? 'Highlighted' : 'Pin'}</span>
        </button>
      </div>

      <p className="mt-2.5 text-sm text-ink-soft leading-relaxed font-medium">
        {concept.explanation}
      </p>

      {concept.points && concept.points.length > 0 && (
        <ul className="mt-3.5 space-y-1.5 pt-2.5 border-t border-border">
          {concept.points.map((pt, pIdx) => (
            <li key={pIdx} className="flex items-start text-xs text-ink-soft space-x-2">
              <span className="text-accent-ink font-bold mt-0.5">•</span>
              <span className="leading-normal">{pt}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

