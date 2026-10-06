import React from 'react';
import { FileSearch } from 'lucide-react';
import type { SourceReference } from '../types/reviewer';
import { sourceRefLabel } from '../source';

interface SourceBadgeProps {
  sources?: SourceReference[];
  onSelect: (ref: SourceReference) => void;
  max?: number;
  className?: string;
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({
  sources,
  onSelect,
  max = 3,
  className = '',
}) => {
  if (!sources || sources.length === 0) return null;

  const visible = sources.slice(0, max);
  const hidden = sources.length - visible.length;

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {visible.map((ref, idx) => (
        <button
          key={`${ref.type}-${ref.index ?? 'n'}-${ref.label ?? idx}`}
          type="button"
          onClick={() => onSelect(ref)}
          title={`Verify against the source: ${sourceRefLabel(ref)}`}
          className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full border border-blue-line bg-blue-soft text-blue-ink text-[10px] font-bold hover:bg-blue hover:text-white transition-colors no-print"
        >
          <FileSearch className="w-3 h-3 shrink-0" />
          <span className="max-w-[9rem] truncate">{sourceRefLabel(ref)}</span>
        </button>
      ))}
      {hidden > 0 && (
        <span
          title={`${hidden} more source reference${hidden > 1 ? 's' : ''}`}
          className="px-1.5 py-0.5 rounded-full border border-border bg-sunken text-ink-muted text-[10px] font-bold no-print"
        >
          +{hidden}
        </span>
      )}
    </span>
  );
};
