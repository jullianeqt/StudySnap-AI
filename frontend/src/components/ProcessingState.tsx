import React, { useEffect, useState } from 'react';
import { BookOpen, Brain, Sparkles, Check, Loader2 } from 'lucide-react';

interface ProcessingStateProps {
  filename?: string;
}

export const ProcessingState: React.FC<ProcessingStateProps> = ({ filename }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "Reading your lesson...",
      subtitle: "Parsing pages, slides, tables, and visual diagram elements",
      icon: BookOpen,
      color: "text-blue-600 bg-blue-50 border-blue-200",
    },
    {
      title: "Finding the important concepts...",
      subtitle: "Extracting exam-relevant definitions, formulas, and comparisons",
      icon: Brain,
      color: "text-purple-600 bg-purple-50 border-purple-200",
    },
    {
      title: "Building your reviewer...",
      subtitle: "Condensing fluff into high-yield digital study cards & quiz points",
      icon: Sparkles,
      color: "text-amber-600 bg-amber-50 border-amber-200",
    }
  ];

  useEffect(() => {
    const timer1 = setTimeout(() => setCurrentStep(1), 1600);
    const timer2 = setTimeout(() => setCurrentStep(2), 3400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <div className="w-full max-w-xl mx-auto py-12 px-6">
      <div className="bg-white rounded-3xl border border-indigo-100 shadow-xl shadow-indigo-50/50 p-8 text-center relative overflow-hidden">
        {/* Animated background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-200/40 rounded-full blur-3xl pointer-events-none animate-pulse" />

        <div className="relative z-10">
          <div className="inline-flex items-center justify-center p-3 mb-6 bg-indigo-50 rounded-2xl text-indigo-600">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>

          <h3 className="text-xl font-bold text-slate-900 mb-1">
            {steps[currentStep].title}
          </h3>
          <p className="text-sm text-slate-500 mb-8">
            {filename ? `Analyzing: ${filename}` : steps[currentStep].subtitle}
          </p>

          {/* Step Progress Checklist */}
          <div className="space-y-3.5 text-left max-w-md mx-auto">
            {steps.map((s, idx) => {
              const isDone = idx < currentStep;
              const isCurrent = idx === currentStep;
              const Icon = s.icon;

              return (
                <div
                  key={idx}
                  className={`flex items-center space-x-3.5 p-3 rounded-xl border transition-all duration-300 ${
                    isCurrent
                      ? 'border-indigo-300 bg-indigo-50/70 shadow-xs scale-[1.01]'
                      : isDone
                      ? 'border-emerald-100 bg-emerald-50/40 text-slate-600'
                      : 'border-slate-100 bg-slate-50/50 opacity-40'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center font-medium border text-xs ${
                      isDone
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : isCurrent
                        ? `${s.color} font-bold`
                        : 'bg-white border-slate-200 text-slate-400'
                    }`}
                  >
                    {isDone ? <Check className="w-4 h-4 stroke-[3]" /> : <Icon className="w-4 h-4" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${isCurrent ? 'text-indigo-950' : 'text-slate-800'}`}>
                      {s.title}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {s.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-slate-400 mt-8">
            ⚡ Principle: "30 pages of slides → 3–5 pages of high-yield exam takeaways."
          </p>
        </div>
      </div>
    </div>
  );
};

