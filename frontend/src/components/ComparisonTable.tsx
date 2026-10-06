import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import type { ComparisonItem, SourceReference } from '../types/reviewer';
import { SourceBadge } from './SourceBadge';

interface ComparisonTableProps {
  comparisons: ComparisonItem[];
  onOpenSource?: (ref: SourceReference) => void;
}

export const ComparisonTable: React.FC<ComparisonTableProps> = ({
  comparisons,
  onOpenSource,
}) => {
  if (!comparisons || comparisons.length === 0) return null;

  return (
    <div className="space-y-6">
      {comparisons.map((comp, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs hover:border-accent-line transition-colors"
        >
          {/* Header Banner */}
          <div className="bg-sunken/80 px-5 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <ArrowLeftRight className="w-4 h-4 text-accent-ink" />
              <h4 className="font-bold text-ink text-sm">
                Comparison: <span className="text-accent-ink">{comp.concept_a}</span> vs <span className="text-violet-ink">{comp.concept_b}</span>
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
                    <td className="py-3 px-4 font-semibold text-ink-soft text-xs uppercase tracking-wide">
                      {asp.aspect}
                    </td>
                    <td className="py-3 px-4 text-ink text-xs md:text-sm bg-accent-soft/10 leading-relaxed font-normal">
                      {asp.a_val}
                    </td>
                    <td className="py-3 px-4 text-ink text-xs md:text-sm bg-violet-soft/10 leading-relaxed font-normal">
                      {asp.b_val}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

