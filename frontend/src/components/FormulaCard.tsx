import React from 'react';
import { Calculator, HelpCircle, Lightbulb } from 'lucide-react';
import type { FormulaItem } from '../types/reviewer';

interface FormulaCardProps {
  formula: FormulaItem;
}

export const FormulaCard: React.FC<FormulaCardProps> = ({ formula }) => {
  return (
    <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs hover:border-indigo-200 transition-all">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Calculator className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-slate-900 text-sm md:text-base">
            {formula.name}
          </h4>
        </div>

        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          Governing Law / Equation
        </span>
      </div>

      {/* Formula Display Banner */}
      <div className="my-3 px-4 py-3 bg-slate-900 text-emerald-300 rounded-xl font-mono text-center text-sm md:text-base tracking-wide font-semibold shadow-inner select-all overflow-x-auto">
        {formula.formula}
      </div>

      {/* Variables List */}
      {formula.variables && formula.variables.length > 0 && (
        <div className="mt-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
          <p className="font-semibold text-slate-700 mb-1.5 uppercase tracking-wider text-[10px]">
            Variables & Meanings:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {formula.variables.map((v, vIdx) => (
              <div key={vIdx} className="flex items-baseline space-x-1.5 text-slate-600">
                <span className="font-mono font-bold text-indigo-600">{v.symbol}:</span>
                <span className="truncate">{v.meaning}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* When to use */}
      {formula.when_to_use && (
        <div className="mt-3 flex items-start space-x-2 text-xs text-slate-600">
          <HelpCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
          <p>
            <span className="font-semibold text-slate-800">When to use: </span>
            {formula.when_to_use}
          </p>
        </div>
      )}

      {/* Short Example */}
      {formula.example && (
        <div className="mt-2 flex items-start space-x-2 text-xs text-slate-600 bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
          <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p>
            <span className="font-semibold text-amber-900">Example: </span>
            {formula.example}
          </p>
        </div>
      )}
    </div>
  );
};

