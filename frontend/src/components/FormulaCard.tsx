import React from 'react';
import { Calculator, HelpCircle, Lightbulb } from 'lucide-react';
import type { FormulaItem, SourceReference } from '../types/reviewer';
import type { ReviewerSearch } from '../search';
import { SourceBadge } from './SourceBadge';
import { Highlight } from './Highlight';

interface FormulaCardProps {
  formula: FormulaItem;
  onOpenSource?: (ref: SourceReference) => void;
  search?: ReviewerSearch;
  /** Search-index path prefix for this card (e.g. `fm.0`). */
  basePath?: string;
}

export const FormulaCard: React.FC<FormulaCardProps> = ({ formula, onOpenSource, search, basePath }) => {
  return (
    <div className="p-5 rounded-2xl border border-border bg-surface shadow-xs hover:border-accent-line transition-all">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-soft text-emerald-ink flex items-center justify-center shrink-0">
            <Calculator className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-ink text-sm md:text-base break-words">
            <Highlight text={formula.name} path={`${basePath}.name`} search={search} />
          </h4>
        </div>

        <span className="text-[11px] font-semibold text-emerald-ink bg-emerald-soft px-2 py-0.5 rounded-full border border-emerald-line shrink-0">
          Governing Law / Equation
        </span>
      </div>

      {/* Formula Display Banner */}
      <div className="my-3 px-4 py-3 bg-code text-code-ink rounded-xl font-mono text-center text-sm md:text-base tracking-wide font-semibold shadow-inner select-all overflow-x-auto whitespace-pre-wrap break-words">
        <Highlight text={formula.formula} path={`${basePath}.expr`} search={search} />
      </div>

      {/* Variables List */}
      {formula.variables && formula.variables.length > 0 && (
        <div className="mt-3 text-xs bg-sunken p-3 rounded-xl border border-border">
          <p className="font-semibold text-ink-soft mb-1.5 uppercase tracking-wider text-[10px]">
            Variables & Meanings:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {formula.variables.map((v, vIdx) => (
              <div key={vIdx} className="flex items-baseline space-x-1.5 text-ink-soft">
                <span className="font-mono font-bold text-accent-ink">{v.symbol}:</span>
                <span className="break-words min-w-0">
                  <Highlight text={v.meaning} path={`${basePath}.var.${vIdx}`} search={search} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* When to use */}
      {formula.when_to_use && (
        <div className="mt-3 flex items-start space-x-2 text-xs text-ink-soft">
          <HelpCircle className="w-3.5 h-3.5 text-accent-ink shrink-0 mt-0.5" />
          <p className="break-words min-w-0">
            <span className="font-semibold text-ink">When to use: </span>
            <Highlight text={formula.when_to_use} path={`${basePath}.use`} search={search} />
          </p>
        </div>
      )}

      {/* Short Example */}
      {formula.example && (
        <div className="mt-2 flex items-start space-x-2 text-xs text-ink-soft bg-amber-soft/50 p-2.5 rounded-lg border border-amber-line">
          <Lightbulb className="w-3.5 h-3.5 text-amber-ink shrink-0 mt-0.5" />
          <p className="break-words min-w-0">
            <span className="font-semibold text-amber-ink">Example: </span>
            <Highlight text={formula.example} path={`${basePath}.ex`} search={search} />
          </p>
        </div>
      )}

      {onOpenSource && (
        <SourceBadge sources={formula.sources} onSelect={onOpenSource} className="mt-3" />
      )}
    </div>
  );
};
