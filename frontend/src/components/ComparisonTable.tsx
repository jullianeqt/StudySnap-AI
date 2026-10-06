import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import type { ComparisonItem, SourceReference } from '../types/reviewer';
import type { ReviewerSearch } from '../search';
import { SourceBadge } from './SourceBadge';
import { Highlight } from './Highlight';

interface ComparisonTableProps {
  comparisons: ComparisonItem[];
  onOpenSource?: (ref: SourceReference) => void;
  search?: ReviewerSearch;
  /** Build this table's index paths (callers pass a per-item prefix). */
  basePath?: string;
}

export const ComparisonTable: React.FC<ComparisonTableProps> = ({
  comparisons,
  onOpenSource,
  search,
  basePath,
}) => {
  if (!comparisons || comparisons.length === 0) return null;

  return (
    <div className="space-y-6">
      {comparisons.map((comp, idx) => {
        const path = basePath !== undefined ? `${basePath}.${idx}` : undefined;
        return (
          <div
            key={idx}
            className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs hover:border-accent-line transition-colors"
          >
            {/* Header Banner */}
            <div className="bg-sunken/80 px-5 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2 min-w-0">
                <ArrowLeftRight className="w-4 h-4 text-accent-ink shrink-0" />
                <h4 className="font-bold text-ink text-sm break-words">
                  Comparison:{' '}
                  <span className="text-accent-ink">
                    <Highlight text={comp.concept_a} path={`${path}.a`} search={search} />
                  </span>{' '}
                  vs{' '}
                  <span className="text-violet-ink">
                    <Highlight text={comp.concept_b} path={`${path}.b`} search={search} />
                  </span>
                </h4>
              </div>
              <div className="flex items-center gap-2">
                {onOpenSource && (
                  <SourceBadge sources={comp.sources} onSelect={onOpenSource} />
                )}
                <span className="text-[11px] font-semibold text-ink-muted bg-surface px-2 py-0.5 rounded border border-border">
                  Exam Differential
                </span>
              </div>
            </div>

            {/* Responsive Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-sunken/40 text-xs font-semibold text-ink-muted uppercase tracking-wider">
                    <th className="py-3 px-4 w-1/4">Aspect / Criteria</th>
                    <th className="py-3 px-4 w-[37.5%] text-accent-ink bg-accent-soft/30">
                      {comp.concept_a}
                    </th>
                    <th className="py-3 px-4 w-[37.5%] text-violet-ink bg-violet-soft/30">
                      {comp.concept_b}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {comp.aspects.map((asp, aIdx) => (
                    <tr key={aIdx} className="hover:bg-sunken/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-ink-soft text-xs uppercase tracking-wide break-words">
                        <Highlight text={asp.aspect} path={`${path}.asp.${aIdx}.name`} search={search} />
                      </td>
                      <td className="py-3 px-4 text-ink text-xs md:text-sm bg-accent-soft/10 leading-relaxed font-normal break-words">
                        <Highlight text={asp.a_val} path={`${path}.asp.${aIdx}.av`} search={search} />
                      </td>
                      <td className="py-3 px-4 text-ink text-xs md:text-sm bg-violet-soft/10 leading-relaxed font-normal break-words">
                        <Highlight text={asp.b_val} path={`${path}.asp.${aIdx}.bv`} search={search} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
};
