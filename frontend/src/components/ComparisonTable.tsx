import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import type { ComparisonItem } from '../types/reviewer';

interface ComparisonTableProps {
  comparisons: ComparisonItem[];
}

export const ComparisonTable: React.FC<ComparisonTableProps> = ({ comparisons }) => {
  if (!comparisons || comparisons.length === 0) return null;

  return (
    <div className="space-y-6">
      {comparisons.map((comp, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs hover:border-indigo-200 transition-colors"
        >
          {/* Header Banner */}
          <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ArrowLeftRight className="w-4 h-4 text-indigo-600" />
              <h4 className="font-bold text-slate-800 text-sm">
                Comparison: <span className="text-indigo-600">{comp.concept_a}</span> vs <span className="text-purple-600">{comp.concept_b}</span>
              </h4>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
              Exam Differential
            </span>
          </div>

          {/* Responsive Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/40 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-1/4">Aspect / Criteria</th>
                  <th className="py-3 px-4 w-[37.5%] text-indigo-700 bg-indigo-50/30">
                    {comp.concept_a}
                  </th>
                  <th className="py-3 px-4 w-[37.5%] text-purple-700 bg-purple-50/30">
                    {comp.concept_b}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comp.aspects.map((asp, aIdx) => (
                  <tr key={aIdx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-700 text-xs uppercase tracking-wide">
                      {asp.aspect}
                    </td>
                    <td className="py-3 px-4 text-slate-800 text-xs md:text-sm bg-indigo-50/10 leading-relaxed font-normal">
                      {asp.a_val}
                    </td>
                    <td className="py-3 px-4 text-slate-800 text-xs md:text-sm bg-purple-50/10 leading-relaxed font-normal">
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

