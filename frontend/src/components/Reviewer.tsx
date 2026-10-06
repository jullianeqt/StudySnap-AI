import React, { useState, useMemo, useCallback } from 'react';
import {
  Copy, Download, HelpCircle, Sparkles, Wand2,
  Search, Star, Check, ArrowRight, Zap, FileScan
} from 'lucide-react';
import type {
  ReviewerRecord, ReviewerData, SourceReference, MustRememberItem,
} from '../types/reviewer';
import { mustRememberText } from '../types/reviewer';
import { QUALITY_STYLES, QUALITY_LABELS } from '../source';
import { KeywordCard } from './KeywordCard';
import { ConceptCard } from './ConceptCard';
import { ComparisonTable } from './ComparisonTable';
import { FormulaCard } from './FormulaCard';
import { SourceBadge } from './SourceBadge';
import { SourceViewer } from './SourceViewer';

const providerLabel = (provider?: string): string => {
  if (!provider) return 'Source-grounded generation';
  if (provider === 'local_extractive') return 'Offline extractive engine';
  if (provider === 'local_extractive_fallback') return 'Offline extractive engine (AI unavailable)';
  if (provider.startsWith('local')) return 'Offline engine';
  if (provider.startsWith('gemini')) return `AI model: ${provider}`;
  return provider;
};

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

  // Source verification panel
  const [isSourceOpen, setIsSourceOpen] = useState(false);
  const [sourceTarget, setSourceTarget] = useState<SourceReference | null>(null);
  const [sourceSeq, setSourceSeq] = useState(0);

  const openSource = useCallback((ref?: SourceReference | null) => {
    setSourceTarget(ref ?? null);
    setSourceSeq((seq) => seq + 1);
    setIsSourceOpen(true);
  }, []);

  const closeSource = useCallback(() => setIsSourceOpen(false), []);

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
    // Legacy records stored must_remember as plain strings; keep both shapes
    // so provenance survives when it exists.
    const rawMustRemember: Array<MustRememberItem | string> = data.must_remember || [];
    return {
      data,
      quickReview: data.quick_review || [],
      keywords: data.keywords || [],
      concepts: data.core_concepts || [],
      mustRemember: rawMustRemember
        .map((item) => ({
          text: mustRememberText(item),
          sources: typeof item === 'string' ? undefined : item.sources,
        }))
        .filter((item) => Boolean(item.text)),
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
      output += `## 4. MUST REMEMBER\n${mustRemember.map(m => `⚡ ${m.text}`).join('\n')}\n\n`;
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
      <div className="sticky top-4 z-40 bg-surface/90 backdrop-blur-md rounded-2xl border border-border/80 p-3 shadow-sm no-print space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Compression Level Selector */}
          <div className="flex items-center space-x-1 bg-sunken p-1 rounded-xl">
            {(['quick', 'standard', 'detailed'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => onSelectCompression(level)}
                aria-pressed={(record.compression || 'standard') === level}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all capitalize ${
                  (record.compression || 'standard') === level
                    ? 'bg-surface text-accent-ink shadow-2xs'
                    : 'text-ink-soft hover:text-ink'
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
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-accent-soft text-accent-ink hover:bg-accent-line transition-colors inline-flex items-center space-x-1"
              title="Rewrite difficult explanations in simpler language"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Make it simpler</span>
            </button>

            <button
              type="button"
              disabled={isTransforming}
              onClick={() => onTransform('eli5')}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-violet-soft text-violet-ink hover:bg-violet-line transition-colors inline-flex items-center space-x-1"
              title="Explain like I'm new to this without changing meaning"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Explain like I'm new</span>
            </button>

            <button
              type="button"
              onClick={onOpenQuizGenerator}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald text-white hover:bg-emerald-hover transition-all shadow-xs inline-flex items-center space-x-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Practice Quiz</span>
            </button>
          </div>

          {/* Export & Copy buttons */}
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => openSource(null)}
              className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-border bg-sunken text-ink-soft hover:text-accent-ink hover:border-accent-line transition-colors inline-flex items-center space-x-1.5"
              title="Open the extracted source text used for this reviewer"
            >
              <FileScan className="w-3.5 h-3.5" />
              <span>View Source</span>
            </button>
            <button
              type="button"
              onClick={handleCopyReviewer}
              className="p-2 text-ink-soft hover:text-accent-ink hover:bg-sunken rounded-xl transition-colors"
              title="Copy Reviewer"
              aria-label="Copy reviewer as text"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-ink" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="p-2 text-ink-soft hover:text-accent-ink hover:bg-sunken rounded-xl transition-colors disabled:opacity-50"
              title="Download detailed PDF"
              aria-label="Download reviewer as PDF"
            >
              <Download className={`w-4 h-4 ${isExporting ? 'animate-pulse' : ''}`} />
            </button>
          </div>
        </div>

        {/* Section Jump Nav & Search Filter */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
          <div className="flex items-center space-x-1 overflow-x-auto pb-1 max-w-full sm:max-w-xl text-xs">
            {navSections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => scrollToSection(sec.id)}
                className="px-2.5 py-1 rounded-md text-ink-soft hover:text-accent-ink hover:bg-sunken whitespace-nowrap font-medium transition-colors"
              >
                {sec.label}
              </button>
            ))}
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-ink-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search reviewer sections"
              placeholder="Search reviewer..."
              className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-border bg-sunken focus:bg-surface focus:outline-none focus:border-accent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1.5 text-ink-muted hover:text-ink-soft text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reviewer Header Card */}
      <div className="bg-surface rounded-3xl p-8 border border-border shadow-xs reviewer-card print-page-break reveal-section" style={{ '--section-delay': '0ms' } as React.CSSProperties}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-accent-soft text-accent-ink border border-accent-line">
              {data.subject || "Academic Study Reviewer"}
            </span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${
                QUALITY_STYLES[record.extraction_quality || 'unknown'] ||
                QUALITY_STYLES.unknown
              }`}
              title="How much usable text could be extracted from your upload"
            >
              {QUALITY_LABELS[record.extraction_quality || 'unknown'] ||
                QUALITY_LABELS.unknown}
            </span>
          </div>

          <div className="flex items-center space-x-3 text-xs text-ink-muted">
            <span>{record.date_created}</span>
            <span>•</span>
            <span>{record.pages_processed} {record.pages_processed === 1 ? 'page/slide' : 'pages/slides'}</span>
            <span>•</span>
            <span className="text-accent-ink font-semibold">{providerLabel(record.ai_provider)}</span>
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-black text-ink leading-tight">
          {data.lesson_title || record.title}
        </h1>
        <p className="text-xs text-ink-muted mt-1">
          Generated from uploaded material • {record.generation_meta?.sections_generated ?? '—'} of 10 sections supported by source •{' '}
          <button
            type="button"
            onClick={() => openSource(null)}
            className="font-bold text-accent-ink hover:underline no-print"
          >
            Verify with source
          </button>
        </p>

        {/* Extraction / generation accuracy notices */}
        {notices.length > 0 && (
          <div className="mt-4 p-3 bg-amber-soft/70 border border-amber-line rounded-xl text-xs space-y-1" role="status">
            {notices.map((notice, idx) => (
              <p key={idx} className="text-amber-ink leading-relaxed">
                {notice}
              </p>
            ))}
          </div>
        )}

        {starredTerms.size > 0 && (
          <div className="mt-4 p-3 bg-amber-soft/70 border border-amber-line rounded-xl text-xs flex items-center space-x-2">
            <Star className="w-4 h-4 text-amber-ink fill-amber-400" />
            <span className="font-semibold text-amber-ink">
              {starredTerms.size} Starred Term{starredTerms.size > 1 ? 's' : ''} saved for priority review
            </span>
          </div>
        )}
      </div>

      {/* SECTION 1: QUICK REVIEW */}
      {quickReview.length > 0 && (
      <section id="quick-review" className="bg-surface rounded-3xl p-6 md:p-8 border border-border shadow-xs reviewer-card print-page-break reveal-section" style={{ '--section-delay': '70ms' } as React.CSSProperties}>
        <div className="flex items-center space-x-2.5 mb-4 pb-2 border-b border-border">
          <div className="w-7 h-7 rounded-lg bg-blue-soft text-blue-ink flex items-center justify-center font-bold text-xs">
            1
          </div>
          <h3 className="text-lg font-bold text-ink uppercase tracking-wide">
            Quick Review
          </h3>
          <span className="text-xs text-ink-muted ml-auto">{quickReview.length} source-backed points</span>
        </div>

        <ul className="space-y-2.5">
          {quickReview.map((point, idx) => (
            <li key={idx} className="flex items-start text-sm text-ink-soft space-x-3">
              <span className="w-5 h-5 rounded-full bg-blue-soft text-blue-ink text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
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
      <section id="keywords" className="bg-surface rounded-3xl p-6 md:p-8 border border-border shadow-xs reviewer-card print-page-break reveal-section" style={{ '--section-delay': '140ms' } as React.CSSProperties}>
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent-soft text-accent-ink flex items-center justify-center font-bold text-xs">
              2
            </div>
            <h3 className="text-lg font-bold text-ink uppercase tracking-wide">
              Keywords & Definitions
            </h3>
          </div>
          <span className="text-xs text-ink-muted">
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
              onOpenSource={openSource}
            />
          ))}
        </div>
      </section>
      )}

      {/* SECTION 3: CORE CONCEPTS */}
      {concepts.length > 0 && (
      <section id="concepts" className="bg-surface rounded-3xl p-6 md:p-8 border border-border shadow-xs reviewer-card print-page-break reveal-section" style={{ '--section-delay': '210ms' } as React.CSSProperties}>
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-soft text-violet-ink flex items-center justify-center font-bold text-xs">
              3
            </div>
            <h3 className="text-lg font-bold text-ink uppercase tracking-wide">
              Core Concepts
            </h3>
          </div>
          <span className="text-xs text-ink-muted">Bite-sized bullet clarity</span>
        </div>

        <div className="space-y-3.5">
          {filteredConcepts.map((concept, idx) => (
            <ConceptCard key={idx} concept={concept} index={idx} onOpenSource={openSource} />
          ))}
        </div>
      </section>
      )}

      {/* SECTION 4: MUST REMEMBER */}
      {mustRemember.length > 0 && (
      <section id="must-remember" className="bg-surface rounded-3xl p-6 md:p-8 border border-border shadow-xs reviewer-card print-page-break reveal-section" style={{ '--section-delay': '280ms' } as React.CSSProperties}>
        <div className="flex items-center space-x-2.5 mb-4 pb-2 border-b border-border">
          <div className="w-7 h-7 rounded-lg bg-amber-soft text-amber-ink flex items-center justify-center font-bold text-xs">
            4
          </div>
          <h3 className="text-lg font-bold text-ink uppercase tracking-wide">
            Must Remember
          </h3>
          <span className="text-xs font-semibold text-amber-ink bg-amber-soft px-2.5 py-0.5 rounded-full ml-auto">
            ⚡ High-Probability Exam Items
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {mustRemember.map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-amber-line bg-amber-soft/40 flex items-start space-x-3 shadow-2xs"
            >
              <Zap className="w-4 h-4 text-amber-ink shrink-0 mt-0.5 fill-amber-400" />
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm text-ink leading-relaxed font-semibold">
                  {item.text}
                </p>
                <SourceBadge sources={item.sources} onSelect={openSource} className="mt-1.5" />
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* SECTION 5: COMPARE */}
      {comparisons.length > 0 && (
        <section id="compare" className="bg-surface rounded-3xl p-6 md:p-8 border border-border shadow-xs reviewer-card print-page-break reveal-section" style={{ '--section-delay': '350ms' } as React.CSSProperties}>
          <div className="flex items-center space-x-2.5 mb-4 pb-2 border-b border-border">
            <div className="w-7 h-7 rounded-lg bg-emerald-soft text-emerald-ink flex items-center justify-center font-bold text-xs">
              5
            </div>
            <h3 className="text-lg font-bold text-ink uppercase tracking-wide">
              Compare Similar Concepts
            </h3>
          </div>

          <ComparisonTable comparisons={comparisons} onOpenSource={openSource} />
        </section>
      )}

      {/* SECTION 6: PROCESS / STEPS */}
      {processes.length > 0 && (
        <section id="steps" className="bg-surface rounded-3xl p-6 md:p-8 border border-border shadow-xs reviewer-card print-page-break reveal-section" style={{ '--section-delay': '420ms' } as React.CSSProperties}>
          <div className="flex items-center space-x-2.5 mb-4 pb-2 border-b border-border">
            <div className="w-7 h-7 rounded-lg bg-cyan-soft text-cyan-ink flex items-center justify-center font-bold text-xs">
              6
            </div>
            <h3 className="text-lg font-bold text-ink uppercase tracking-wide">
              Process / Step-by-Step
            </h3>
          </div>

          <div className="space-y-6">
            {processes.map((proc, pIdx) => (
              <div key={pIdx} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-bold text-ink-soft text-sm">
                    {proc.process_title}
                  </h4>
                  <SourceBadge sources={proc.sources} onSelect={openSource} />
                </div>

                <div className="space-y-2.5">
                  {proc.steps.map((step) => (
                    <div
                      key={step.step_number}
                      className="flex items-start space-x-3.5 p-3.5 rounded-xl border border-border bg-sunken/50 hover:bg-surface transition-colors"
                    >
                      <div className="w-6 h-6 rounded-lg bg-cyan text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                        {step.step_number}
                      </div>
                      <div>
                        <p className="font-bold text-ink text-xs md:text-sm">
                          {step.title}
                        </p>
                        <p className="text-xs text-ink-soft mt-0.5 leading-relaxed">
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
        <section id="formulas" className="bg-surface rounded-3xl p-6 md:p-8 border border-border shadow-xs reviewer-card print-page-break reveal-section" style={{ '--section-delay': '490ms' } as React.CSSProperties}>
          <div className="flex items-center space-x-2.5 mb-4 pb-2 border-b border-border">
            <div className="w-7 h-7 rounded-lg bg-emerald-soft text-emerald-ink flex items-center justify-center font-bold text-xs">
              7
            </div>
            <h3 className="text-lg font-bold text-ink uppercase tracking-wide">
              Formulas & Rules
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {formulas.map((form, fIdx) => (
              <FormulaCard key={fIdx} formula={form} onOpenSource={openSource} />
            ))}
          </div>
        </section>
      )}

      {/* SECTION 8: EXAMPLES */}
      {examples.length > 0 && (
        <section id="examples" className="bg-surface rounded-3xl p-6 md:p-8 border border-border shadow-xs reviewer-card print-page-break reveal-section" style={{ '--section-delay': '560ms' } as React.CSSProperties}>
          <div className="flex items-center space-x-2.5 mb-4 pb-2 border-b border-border">
            <div className="w-7 h-7 rounded-lg bg-rose-soft text-rose-ink flex items-center justify-center font-bold text-xs">
              8
            </div>
            <h3 className="text-lg font-bold text-ink uppercase tracking-wide">
              High-Yield Examples
            </h3>
          </div>

          <div className="space-y-3.5">
            {examples.map((ex, exIdx) => (
              <div key={exIdx} className="p-4 rounded-xl border border-border bg-sunken/40">
                <span className="font-bold text-ink text-xs md:text-sm">
                  {ex.concept}
                </span>
                <p className="mt-1 text-xs md:text-sm text-ink-soft bg-surface p-3 rounded-lg border border-border">
                  <span className="font-semibold text-rose-ink">Scenario: </span>
                  {ex.example}
                </p>
                {ex.explanation && (
                  <p className="mt-2 text-xs text-ink-muted">
                    <span className="font-semibold text-ink-soft">Why it matters: </span>
                    {ex.explanation}
                  </p>
                )}
                <SourceBadge sources={ex.sources} onSelect={openSource} className="mt-2" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 9: POSSIBLE QUIZ POINTS */}
      {quizPoints.length > 0 && (
        <section id="quiz-points" className="bg-surface rounded-3xl p-6 md:p-8 border border-border shadow-xs reviewer-card print-page-break reveal-section" style={{ '--section-delay': '630ms' } as React.CSSProperties}>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-accent-soft text-accent-ink flex items-center justify-center font-bold text-xs">
                9
              </div>
              <h3 className="text-lg font-bold text-ink uppercase tracking-wide">
                Possible Quiz Points
              </h3>
            </div>
            <button
              type="button"
              onClick={onOpenQuizGenerator}
              className="text-xs font-semibold text-accent-ink hover:text-accent-hover hover:underline inline-flex items-center space-x-1"
            >
              <span>Test yourself now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {quizPoints.map((qp, qpIdx) => (
              <div
                key={qpIdx}
                className="p-4 rounded-xl border border-accent-line bg-accent-soft/30 flex items-start space-x-3"
              >
                <HelpCircle className="w-4 h-4 text-accent-ink shrink-0 mt-0.5" />
                <div className="text-xs md:text-sm space-y-1">
                  <p className="font-bold text-ink">{qp.question_clue}</p>
                  <p className="text-ink-soft font-medium">
                    <span className="text-accent-ink font-bold">Key Fact: </span>
                    {qp.key_fact}
                  </p>
                  <SourceBadge sources={qp.sources} onSelect={openSource} className="mt-1" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 10: ONE-MINUTE REVIEW */}
      {oneMinuteReview.length > 0 && (
      <section id="one-minute" className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-8 shadow-lg reviewer-card print-page-break print-light-panel reveal-section" style={{ '--section-delay': '700ms' } as React.CSSProperties}>
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

      {/* Source verification panel (side panel on desktop, sheet on mobile) */}
      <SourceViewer
        record={record}
        isOpen={isSourceOpen}
        target={sourceTarget}
        targetSeq={sourceSeq}
        onClose={closeSource}
      />
    </div>
  );
};

