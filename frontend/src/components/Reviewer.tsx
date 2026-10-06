import React, { useState, useMemo } from 'react';
import {
  Copy, Download, HelpCircle, Sparkles, Wand2,
  Search, Star, Check, ArrowRight, Zap
} from 'lucide-react';
import type { ReviewerRecord, ReviewerData } from '../types/reviewer';
import { mustRememberText } from '../types/reviewer';
import { KeywordCard } from './KeywordCard';
import { ConceptCard } from './ConceptCard';
import { ComparisonTable } from './ComparisonTable';
import { FormulaCard } from './FormulaCard';

interface ReviewerProps {
  record: ReviewerRecord;
  onOpenQuizGenerator: () => void;
  onTransform: (action: 'make_simpler' | 'eli5' | 'make_shorter' | 'make_detailed') => void;
  onExportPdf: () => Promise<void>;
  isTransforming?: boolean;
  onSelectCompression: (level: 'quick' | 'standard' | 'detailed') => void;
  targetSearchTopic?: string;
}

export const Reviewer: React.FC<ReviewerProps> = ({
  record,
  onOpenQuizGenerator,
  onTransform,
  onExportPdf,
  isTransforming = false,
  onSelectCompression,
  targetSearchTopic = '',
}) => {
  const [searchQuery, setSearchQuery] = useState(targetSearchTopic);
  const [copied, setCopied] = useState(false);
  const [starredTerms, setStarredTerms] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  // Defensive defaults: legitimately empty or legacy/missing sections must never crash the UI.
  const {
    data,
    quickReview,
    keywords,
    concepts,
    mustRemember,
    comparisons,
    processes,
    formulas,
    examples,
    quizPoints,
    oneMinuteReview,
    sourceFlags,
  } = useMemo(() => {
    const data: ReviewerData = record.reviewer || ({} as ReviewerData);
    return {
      data,
      quickReview: data.quick_review || [],
      keywords: data.keywords || [],
      concepts: data.core_concepts || [],
      mustRemember: (data.must_remember || []).map(mustRememberText).filter(Boolean),
      comparisons: data.compare || [],
      processes: data.process_steps || [],
      formulas: data.formulas_rules || [],
      examples: data.examples || [],
      quizPoints: data.possible_quiz_points || [],
      oneMinuteReview: data.one_minute_review || '',
      sourceFlags: data.source_flags || [],
    };
  }, [record.reviewer]);

  // Accuracy notices: extraction problems + generation diagnostics + source conflicts.
  const notices = Array.from(new Set([
    ...(record.extraction_warnings || []),
    ...(record.generation_meta?.warnings || []),
    ...sourceFlags.map((flag) => `Source conflict flagged: ${flag}`),
  ].filter(Boolean)));

  // Star / Save term handler
  const handleToggleStar = (term: string) => {
    setStarredTerms((prev) => {
      const next = new Set(prev);
      if (next.has(term)) next.delete(term);
      else next.add(term);
      return next;
    });
  };

  // Copy full reviewer as clean study sheet (empty sections are skipped)
  const handleCopyReviewer = () => {
    let output = `# ${data.lesson_title || record.title}\nSubject: ${data.subject}\n\n`;

    if (quickReview.length) {
      output += `## 1. QUICK REVIEW\n${quickReview.map(b => `• ${b}`).join('\n')}\n\n`;
    }

    if (keywords.length) {
      output += `## 2. KEYWORDS\n${keywords.map(k => `**${k.term}** — ${k.definition}`).join('\n\n')}\n\n`;
    }

    if (concepts.length) {
      output += `## 3. CORE CONCEPTS\n${concepts.map(c => `### ${c.concept}\n${c.explanation}\n${c.points?.map(p => `  • ${p}`).join('\n') || ''}`).join('\n\n')}\n\n`;
    }

    if (mustRemember.length) {
      output += `## 4. MUST REMEMBER\n${mustRemember.map(m => `⚡ ${m}`).join('\n')}\n\n`;
    }

    if (comparisons.length) {
      output += `## 5. COMPARE\n${comparisons.map(cp => `### ${cp.concept_a} vs ${cp.concept_b}\n${(cp.aspects || []).map(a => `- ${a.aspect}: ${a.a_val} | ${a.b_val}`).join('\n')}`).join('\n\n')}\n\n`;
    }

    if (processes.length) {
      output += `## 6. PROCESS / STEPS\n${processes.map(pr => `### ${pr.process_title}\n${(pr.steps || []).map(s => `${s.step_number}. ${s.title}: ${s.description}`).join('\n')}`).join('\n\n')}\n\n`;
    }

    if (formulas.length) {
      output += `## 7. FORMULAS / RULES\n${formulas.map(f => `### ${f.name}\nEquation: ${f.formula}${f.when_to_use ? `\nWhen to use: ${f.when_to_use}` : ''}`).join('\n\n')}\n\n`;
    }

    if (examples.length) {
      output += `## 8. EXAMPLES\n${examples.map(ex => `### ${ex.concept}\nExample: ${ex.example}${ex.explanation ? `\nExplanation: ${ex.explanation}` : ''}`).join('\n\n')}\n\n`;
    }

    if (quizPoints.length) {
      output += `## 9. POSSIBLE QUIZ POINTS\n${quizPoints.map(qp => `• Clue: ${qp.question_clue} -> Key Fact: ${qp.key_fact}`).join('\n')}\n\n`;
    }

    if (oneMinuteReview) {
      output += `## 10. ONE-MINUTE REVIEW\n${oneMinuteReview}\n`;
    }

    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await onExportPdf();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to export reviewer as PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  // Filtered keywords based on search
  const filteredKeywords = useMemo(() => {
    if (!searchQuery.trim()) return keywords;
    const q = searchQuery.toLowerCase();
    return keywords.filter(
      k => k.term.toLowerCase().includes(q) || k.definition.toLowerCase().includes(q)
    );
  }, [keywords, searchQuery]);

  // Filtered concepts based on search
  const filteredConcepts = useMemo(() => {
    if (!searchQuery.trim()) return concepts;
    const q = searchQuery.toLowerCase();
    return concepts.filter(
      c => c.concept.toLowerCase().includes(q) || c.explanation.toLowerCase().includes(q) || c.points?.some(p => p.toLowerCase().includes(q))
    );
  }, [concepts, searchQuery]);

  // Only navigate to sections that actually contain content.
  const navSections = [
    quickReview.length > 0 && { id: 'quick-review', label: '1. Quick Review' },
    keywords.length > 0 && { id: 'keywords', label: '2. Keywords' },
    concepts.length > 0 && { id: 'concepts', label: '3. Core Concepts' },
    mustRemember.length > 0 && { id: 'must-remember', label: '4. Must Remember' },
    comparisons.length > 0 && { id: 'compare', label: '5. Compare' },
    processes.length > 0 && { id: 'steps', label: '6. Steps' },
    formulas.length > 0 && { id: 'formulas', label: '7. Formulas' },
    examples.length > 0 && { id: 'examples', label: '8. Examples' },
    quizPoints.length > 0 && { id: 'quiz-points', label: '9. Quiz Points' },
    oneMinuteReview.length > 0 && { id: 'one-minute', label: '10. One-Minute' },
  ].filter((sec): sec is { id: string; label: string } => Boolean(sec));

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-20">
      {/* Control Bar: Difficulty, Actions, Search */}
      <div className="sticky top-4 z-40 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 p-3 shadow-sm no-print space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Compression Level Selector */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
            {(['quick', 'standard', 'detailed'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => onSelectCompression(level)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all capitalize ${
                  (record.compression || 'standard') === level
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {level === 'quick' ? '✂️ Quick' : level === 'standard' ? '⚖️ Standard' : '📚 Detailed'}
              </button>
            ))}
          </div>

          {/* Quick AI Refine actions */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={isTransforming}
              onClick={() => onTransform('make_simpler')}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors inline-flex items-center space-x-1"
              title="Rewrite difficult explanations in simpler language"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Make it simpler</span>
            </button>

            <button
              type="button"
              disabled={isTransforming}
              onClick={() => onTransform('eli5')}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors inline-flex items-center space-x-1"
              title="Explain like I'm new to this without changing meaning"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Explain like I'm new</span>
            </button>

            <button
              type="button"
              onClick={onOpenQuizGenerator}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-xs inline-flex items-center space-x-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Practice Quiz</span>
            </button>
          </div>

          {/* Export & Copy buttons */}
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={handleCopyReviewer}
              className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors"
              title="Copy Reviewer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              title="Download detailed PDF"
            >
              <Download className={`w-4 h-4 ${isExporting ? 'animate-pulse' : ''}`} />
            </button>
          </div>
        </div>

        {/* Section Jump Nav & Search Filter */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center space-x-1 overflow-x-auto pb-1 max-w-full sm:max-w-xl text-xs">
            {navSections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => scrollToSection(sec.id)}
                className="px-2.5 py-1 rounded-md text-slate-600 hover:text-indigo-600 hover:bg-slate-100 whitespace-nowrap font-medium transition-colors"
              >
                {sec.label}
              </button>
            ))}
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reviewer..."
              className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reviewer Header Card */}
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs reviewer-card print-page-break reveal-section" style={{ '--section-delay': '0ms' } as React.CSSProperties}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
            {data.subject || "Academic Study Reviewer"}
          </span>

          <div className="flex items-center space-x-3 text-xs text-slate-400">
            <span>{record.date_created}</span>
            <span>•</span>
            <span>{record.pages_processed} {record.pages_processed === 1 ? 'page/slide' : 'pages/slides'}</span>
            <span>•</span>
            <span className="text-indigo-600 font-semibold">{record.ai_provider || 'Source-grounded generation'}</span>
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
          {data.lesson_title || record.title}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Source-grounded generation • {record.generation_meta?.sections_generated ?? '—'} of 10 sections supported by source • StudySnap AI
        </p>

        {/* Extraction / generation accuracy notices */}
        {notices.length > 0 && (
          <div className="mt-4 p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1">
            {notices.map((notice, idx) => (
              <p key={idx} className="text-amber-900 leading-relaxed">
                {notice}
              </p>
            ))}
          </div>
        )}

        {starredTerms.size > 0 && (
          <div className="mt-4 p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs flex items-center space-x-2">
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
            <span className="font-semibold text-amber-900">
              {starredTerms.size} Starred Term{starredTerms.size > 1 ? 's' : ''} saved for priority review
            </span>
          </div>
        )}
      </div>

      {/* SECTION 1: QUICK REVIEW */}
      {quickReview.length > 0 && (
      <section id="quick-review" className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xs reviewer-card print-page-break reveal-section" style={{ '--section-delay': '70ms' } as React.CSSProperties}>
        <div className="flex items-center space-x-2.5 mb-4 pb-2 border-b border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
            1
          </div>
          <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
            Quick Review
          </h3>
          <span className="text-xs text-slate-400 ml-auto">{quickReview.length} source-backed points</span>
        </div>

        <ul className="space-y-2.5">
          {quickReview.map((point, idx) => (
            <li key={idx} className="flex items-start text-sm text-slate-700 space-x-3">
              <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <span className="leading-relaxed font-medium">{point}</span>
            </li>
          ))}
        </ul>
      </section>
      )}

      {/* SECTION 2: KEYWORDS */}
      {keywords.length > 0 && (
      <section id="keywords" className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xs reviewer-card print-page-break reveal-section" style={{ '--section-delay': '140ms' } as React.CSSProperties}>
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              2
            </div>
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
              Keywords & Definitions
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {filteredKeywords.length} terms {searchQuery && '(filtered)'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {filteredKeywords.map((kw, idx) => (
            <KeywordCard
              key={idx}
              keyword={kw}
              isStarred={starredTerms.has(kw.term)}
              onToggleStar={handleToggleStar}
            />
          ))}
        </div>
      </section>
      )}

      {/* SECTION 3: CORE CONCEPTS */}
      {concepts.length > 0 && (
      <section id="concepts" className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xs reviewer-card print-page-break reveal-section" style={{ '--section-delay': '210ms' } as React.CSSProperties}>
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
              3
            </div>
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
              Core Concepts
            </h3>
          </div>
          <span className="text-xs text-slate-400">Bite-sized bullet clarity</span>
        </div>

        <div className="space-y-3.5">
          {filteredConcepts.map((concept, idx) => (
            <ConceptCard key={idx} concept={concept} index={idx} />
          ))}
        </div>
      </section>
      )}

      {/* SECTION 4: MUST REMEMBER */}
      {mustRemember.length > 0 && (
      <section id="must-remember" className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xs reviewer-card print-page-break reveal-section" style={{ '--section-delay': '280ms' } as React.CSSProperties}>
        <div className="flex items-center space-x-2.5 mb-4 pb-2 border-b border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
            4
          </div>
          <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
            Must Remember
          </h3>
          <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full ml-auto">
            ⚡ High-Probability Exam Items
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {mustRemember.map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 flex items-start space-x-3 shadow-2xs"
            >
              <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 fill-amber-400" />
              <p className="text-xs md:text-sm text-slate-800 leading-relaxed font-semibold">
                {item}
              </p>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* SECTION 5: COMPARE */}
      {comparisons.length > 0 && (
        <section id="compare" className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xs reviewer-card print-page-break reveal-section" style={{ '--section-delay': '350ms' } as React.CSSProperties}>
          <div className="flex items-center space-x-2.5 mb-4 pb-2 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
              5
            </div>
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
              Compare Similar Concepts
            </h3>
          </div>

          <ComparisonTable comparisons={comparisons} />
        </section>
      )}

      {/* SECTION 6: PROCESS / STEPS */}
      {processes.length > 0 && (
        <section id="steps" className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xs reviewer-card print-page-break reveal-section" style={{ '--section-delay': '420ms' } as React.CSSProperties}>
          <div className="flex items-center space-x-2.5 mb-4 pb-2 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold text-xs">
              6
            </div>
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
              Process / Step-by-Step
            </h3>
          </div>

          <div className="space-y-6">
            {processes.map((proc, pIdx) => (
              <div key={pIdx} className="space-y-3">
                <h4 className="font-bold text-slate-800 text-sm">
                  {proc.process_title}
                </h4>

                <div className="space-y-2.5">
                  {proc.steps.map((step) => (
                    <div
                      key={step.step_number}
                      className="flex items-start space-x-3.5 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition-colors"
                    >
                      <div className="w-6 h-6 rounded-lg bg-cyan-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                        {step.step_number}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-xs md:text-sm">
                          {step.title}
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 7: FORMULAS / RULES */}
      {formulas.length > 0 && (
        <section id="formulas" className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xs reviewer-card print-page-break reveal-section" style={{ '--section-delay': '490ms' } as React.CSSProperties}>
          <div className="flex items-center space-x-2.5 mb-4 pb-2 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
              7
            </div>
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
              Formulas & Rules
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {formulas.map((form, fIdx) => (
              <FormulaCard key={fIdx} formula={form} />
            ))}
          </div>
        </section>
      )}

      {/* SECTION 8: EXAMPLES */}
      {examples.length > 0 && (
        <section id="examples" className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xs reviewer-card print-page-break reveal-section" style={{ '--section-delay': '560ms' } as React.CSSProperties}>
          <div className="flex items-center space-x-2.5 mb-4 pb-2 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
              8
            </div>
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
              High-Yield Examples
            </h3>
          </div>

          <div className="space-y-3.5">
            {examples.map((ex, exIdx) => (
              <div key={exIdx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40">
                <span className="font-bold text-slate-900 text-xs md:text-sm">
                  {ex.concept}
                </span>
                <p className="mt-1 text-xs md:text-sm text-slate-700 bg-white p-3 rounded-lg border border-slate-200">
                  <span className="font-semibold text-rose-600">Scenario: </span>
                  {ex.example}
                </p>
                {ex.explanation && (
                  <p className="mt-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">Why it matters: </span>
                    {ex.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 9: POSSIBLE QUIZ POINTS */}
      {quizPoints.length > 0 && (
        <section id="quiz-points" className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xs reviewer-card print-page-break reveal-section" style={{ '--section-delay': '630ms' } as React.CSSProperties}>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                9
              </div>
              <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
                Possible Quiz Points
              </h3>
            </div>
            <button
              type="button"
              onClick={onOpenQuizGenerator}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center space-x-1"
            >
              <span>Test yourself now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {quizPoints.map((qp, qpIdx) => (
              <div
                key={qpIdx}
                className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/30 flex items-start space-x-3"
              >
                <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs md:text-sm space-y-1">
                  <p className="font-bold text-slate-900">{qp.question_clue}</p>
                  <p className="text-slate-600 font-medium">
                    <span className="text-indigo-600 font-bold">Key Fact: </span>
                    {qp.key_fact}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 10: ONE-MINUTE REVIEW */}
      {oneMinuteReview.length > 0 && (
      <section id="one-minute" className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-8 shadow-lg reviewer-card print-page-break reveal-section" style={{ '--section-delay': '700ms' } as React.CSSProperties}>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-indigo-700/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-xs">
              10
            </div>
            <h3 className="text-lg font-bold uppercase tracking-wide text-indigo-100">
              One-Minute Review
            </h3>
          </div>
          <span className="text-xs font-semibold bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-full">
            ⏱️ Fast Pre-Quiz Read
          </span>
        </div>

        <p className="text-sm md:text-base leading-relaxed text-indigo-100 font-medium">
          {oneMinuteReview}
        </p>

        <div className="mt-6 pt-4 border-t border-indigo-800/60 flex flex-wrap items-center justify-between gap-3 text-xs text-indigo-300">
          <span>Good luck on your exam! You've got this.</span>
          <button
            type="button"
            onClick={onOpenQuizGenerator}
            className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold transition-colors shadow-xs"
          >
            Take 5-Minute Practice Quiz →
          </button>
        </div>
      </section>
      )}
    </div>
  );
};

