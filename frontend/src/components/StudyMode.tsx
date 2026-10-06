import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, Check, RotateCcw, Eye,
  GraduationCap, Keyboard,
} from 'lucide-react';
import type { ReviewerRecord } from '../types/reviewer';
import { buildStudyCards, type StudyCard } from '../studyCards';

type Grade = 'know' | 'review';

interface StudyModeProps {
  record: ReviewerRecord;
  onClose: () => void;
}

const isTypingTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element || typeof element.tagName !== 'string') return false;
  return (
    element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.tagName === 'SELECT' ||
    element.isContentEditable === true
  );
};

const kbdClass = 'px-1.5 py-0.5 rounded border border-border bg-sunken font-mono text-[10px]';

/**
 * Fullscreen active-recall session built from the reviewer already on screen.
 * No AI calls, no persistence: session progress lives in React state only.
 */
export const StudyMode: React.FC<StudyModeProps> = ({ record, onClose }) => {
  const cards = useMemo(() => buildStudyCards(record.reviewer), [record.reviewer]);
  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);

  const [deckIds, setDeckIds] = useState<string[]>(() => cards.map((card) => card.id));
  const [grades, setGrades] = useState<Record<string, Grade>>({});
  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [round, setRound] = useState(1);

  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const total = deckIds.length;
  const knowCount = deckIds.filter((id) => grades[id] === 'know').length;
  const reviewCount = deckIds.filter((id) => grades[id] === 'review').length;
  const reviewed = knowCount + reviewCount;
  const complete = total > 0 && reviewed === total;
  const currentCard: StudyCard | undefined =
    deckIds[currentIdx] !== undefined ? cardById.get(deckIds[currentIdx]) : undefined;
  const isRevealed = currentCard ? revealedIds.includes(currentCard.id) : false;
  const currentGrade = currentCard ? grades[currentCard.id] : undefined;

  const reveal = useCallback(() => {
    if (!currentCard) return;
    setRevealedIds((prev) =>
      prev.includes(currentCard.id) ? prev : [...prev, currentCard.id],
    );
  }, [currentCard]);

  const gradeCard = useCallback(
    (grade: Grade) => {
      if (!currentCard || complete) return;
      const nextGrades: Record<string, Grade> = { ...grades, [currentCard.id]: grade };
      setGrades(nextGrades);
      // Advance to the next card this round has not graded yet (wrapping).
      let next = currentIdx;
      for (let step = 1; step <= total; step += 1) {
        const candidate = (currentIdx + step) % total;
        if (nextGrades[deckIds[candidate]] === undefined) {
          next = candidate;
          break;
        }
      }
      setCurrentIdx(next);
    },
    [currentCard, complete, grades, currentIdx, total, deckIds],
  );

  const move = useCallback(
    (delta: number) => {
      setCurrentIdx((idx) => Math.min(Math.max(idx + delta, 0), Math.max(total - 1, 0)));
    },
    [total],
  );

  const resetSession = (nextDeck: string[], nextRound: number) => {
    setDeckIds(nextDeck);
    setGrades({});
    setRevealedIds([]);
    setCurrentIdx(0);
    setRound(nextRound);
  };

  const startMissedRound = () => {
    const missed = deckIds.filter((id) => grades[id] === 'review');
    if (missed.length === 0) return;
    resetSession(missed, round + 1);
  };

  const restart = () => resetSession(cards.map((card) => card.id), 1);

  // Open: remember focus, lock background scroll, Escape + Tab trap.
  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input, [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      const element = restoreFocusRef.current;
      if (element && document.contains(element)) element.focus();
    };
  }, [onClose]);

  // Study keyboard controls. Never hijacks typing or browser/OS shortcuts.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const tag = (event.target as HTMLElement | null)?.tagName;
      const onControl = tag === 'BUTTON' || tag === 'A';

      if (event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter') {
        if (onControl) return; // the focused control activates itself natively
        if (!complete && currentCard && !isRevealed) {
          event.preventDefault();
          reveal();
        }
        return;
      }
      if (event.key === '1' && !complete && isRevealed) {
        event.preventDefault();
        gradeCard('know');
        return;
      }
      if (event.key === '2' && !complete && isRevealed) {
        event.preventDefault();
        gradeCard('review');
        return;
      }
      if (event.key === 'ArrowLeft' && total > 1) {
        event.preventDefault();
        move(-1);
        return;
      }
      if (event.key === 'ArrowRight' && total > 1) {
        event.preventDefault();
        move(1);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, complete, currentCard, isRevealed, reveal, gradeCard, move, total]);

  const progressPct = total > 0 ? Math.round((reviewed / total) * 100) : 0;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="study-mode-title"
      className="fixed inset-0 z-50 bg-page text-ink overflow-y-auto no-print"
    >
      <div className="min-h-full mx-auto max-w-3xl px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-4">
        {/* Header */}
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-accent-ink">
              Study Mode · Round {round}
            </p>
            <h2
              id="study-mode-title"
              className="text-lg sm:text-xl font-black text-ink leading-tight truncate"
            >
              {record.reviewer?.lesson_title || record.title}
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              {total} card{total === 1 ? '' : 's'} in this round · active recall, no AI calls
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close study mode"
            className="p-2.5 rounded-xl text-ink-soft hover:text-ink hover:bg-sunken transition-colors shrink-0 border border-border"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Progress: numbers in text, bar as reinforcement */}
        {total > 0 && (
          <section
            aria-label="Session progress"
            className="rounded-2xl border border-border bg-surface p-4 shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-ink-soft">
              <span>
                {reviewed} / {total} reviewed
              </span>
              <span className="text-ink-muted">
                Remembered {knowCount} · Needs review {reviewCount}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={reviewed}
              aria-valuetext={`${reviewed} of ${total} cards reviewed, ${knowCount} remembered, ${reviewCount} need review`}
              className="mt-2.5 h-2.5 rounded-full bg-sunken border border-border overflow-hidden"
            >
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </section>
        )}

        {/* Empty state: nothing structured to study */}
        {total === 0 && (
          <section className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16">
            <GraduationCap className="w-10 h-10 text-border-strong" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-ink-soft max-w-sm">
              This reviewer doesn't contain enough structured material for Study Mode.
            </p>
            <p className="text-xs text-ink-muted max-w-sm">
              Study Mode uses keywords, must-remember facts, concepts, formulas, and process
              steps — generate a reviewer that includes some of those sections.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent-hover transition-colors min-h-11"
            >
              Close
            </button>
          </section>
        )}

        {/* Completion */}
        {total > 0 && complete && (
          <section className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-10">
            <div className="w-14 h-14 rounded-2xl bg-emerald-soft text-emerald-ink border border-emerald-line flex items-center justify-center">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-ink">Round {round} complete</h3>
              <p className="text-xs text-ink-muted mt-1">
                You reviewed every card in this round.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 w-full max-w-lg">
              <div className="rounded-xl border border-border bg-surface p-3 shadow-xs">
                <p className="text-xl sm:text-2xl font-black text-ink">{total}</p>
                <p className="text-[11px] text-ink-muted mt-1 leading-tight">Cards reviewed</p>
              </div>
              <div className="rounded-xl border border-emerald-line bg-emerald-soft p-3">
                <p className="text-xl sm:text-2xl font-black text-emerald-ink">{knowCount}</p>
                <p className="text-[11px] text-emerald-ink mt-1 leading-tight">Remembered</p>
              </div>
              <div className="rounded-xl border border-amber-line bg-amber-soft p-3">
                <p className="text-xl sm:text-2xl font-black text-amber-ink">{reviewCount}</p>
                <p className="text-[11px] text-amber-ink mt-1 leading-tight">Need review</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-lg">
              {reviewCount > 0 && (
                <button
                  type="button"
                  onClick={startMissedRound}
                  className="flex-1 min-h-11 px-5 py-3 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent-hover transition-colors inline-flex items-center justify-center space-x-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Review missed cards ({reviewCount})</span>
                </button>
              )}
              <button
                type="button"
                onClick={restart}
                className="flex-1 min-h-11 px-5 py-3 rounded-xl border border-border bg-surface text-ink-soft text-sm font-bold hover:bg-sunken transition-colors"
              >
                Start over
              </button>
            </div>

            <p className="text-[11px] text-ink-muted max-w-sm leading-relaxed">
              This is a simple active-recall session — StudySnap does not apply a
              scientifically validated spaced-repetition schedule.
            </p>
          </section>
        )}

        {/* Current card */}
        {total > 0 && !complete && currentCard && (
          <section className="flex-1 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold px-2.5 py-1 rounded-full bg-accent-soft text-accent-ink border border-accent-line uppercase tracking-wider">
                {currentCard.section}
              </span>
              <span aria-live="polite" className="text-ink-muted font-semibold">
                Card {currentIdx + 1} of {total}
                {currentGrade === 'know' && ' · marked Remembered'}
                {currentGrade === 'review' && ' · marked Review again'}
              </span>
            </div>

            <article className="rounded-3xl border border-border bg-surface shadow-sm p-6 sm:p-10 flex flex-col justify-center min-h-[42vh] sm:min-h-[46vh]">
              {!isRevealed ? (
                <button
                  type="button"
                  onClick={reveal}
                  aria-label={`Reveal answer for: ${currentCard.front}`}
                  className="text-left w-full group rounded-2xl"
                >
                  <p className="text-ink text-xl sm:text-3xl font-black leading-snug break-words whitespace-pre-wrap">
                    {currentCard.front}
                  </p>
                  <span className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-bold group-hover:bg-accent-hover transition-colors">
                    <Eye className="w-4 h-4" />
                    Reveal answer
                  </span>
                  <span className="block mt-2 text-[11px] text-ink-muted">
                    Click, tap, or press Space
                  </span>
                </button>
              ) : (
                <div className="space-y-4">
                  <p className="text-base sm:text-lg font-bold text-ink leading-snug break-words whitespace-pre-wrap">
                    {currentCard.front}
                  </p>

                  <div className="pt-4 border-t border-border space-y-3.5">
                    {currentCard.formula && (
                      <div className="bg-code text-code-ink font-mono rounded-xl p-4 text-sm sm:text-base font-semibold whitespace-pre-wrap break-words overflow-x-auto select-all">
                        {currentCard.formula}
                      </div>
                    )}

                    {currentCard.back && (
                      <p className="text-base sm:text-lg text-ink-soft leading-relaxed whitespace-pre-wrap break-words">
                        {currentCard.back}
                      </p>
                    )}

                    {currentCard.points && currentCard.points.length > 0 && (
                      <ul className="space-y-1.5">
                        {currentCard.points.map((point, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm text-ink-soft leading-relaxed"
                          >
                            <span className="text-accent-ink font-bold mt-0.5">•</span>
                            <span className="break-words min-w-0">{point}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {currentCard.variables && currentCard.variables.length > 0 && (
                      <div className="rounded-xl border border-border bg-sunken p-3 text-xs space-y-1">
                        <p className="font-bold text-ink-soft uppercase tracking-wider text-[10px]">
                          Variables
                        </p>
                        {currentCard.variables.map((variable, idx) => (
                          <p key={idx} className="text-ink-soft break-words">
                            <span className="font-mono font-bold text-accent-ink">
                              {variable.symbol}:
                            </span>{' '}
                            {variable.meaning}
                          </p>
                        ))}
                      </div>
                    )}

                    {currentCard.extra && currentCard.extraLabel && (
                      <p className="text-sm text-ink-soft leading-relaxed break-words">
                        <span className="font-bold text-ink">{currentCard.extraLabel}: </span>
                        {currentCard.extra}
                      </p>
                    )}

                    {currentCard.example && (
                      <p className="text-sm text-ink-soft leading-relaxed break-words bg-amber-soft/50 border border-amber-line rounded-xl p-3">
                        <span className="font-bold text-amber-ink">Example: </span>
                        {currentCard.example}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => gradeCard('know')}
                      className="flex-1 min-h-11 px-4 py-3 rounded-xl border border-emerald-line bg-emerald-soft text-emerald-ink text-sm font-bold hover:bg-emerald-line transition-colors inline-flex items-center justify-center space-x-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>Know it</span>
                      <kbd className={kbdClass}>1</kbd>
                    </button>
                    <button
                      type="button"
                      onClick={() => gradeCard('review')}
                      className="flex-1 min-h-11 px-4 py-3 rounded-xl border border-amber-line bg-amber-soft text-amber-ink text-sm font-bold hover:bg-amber-line transition-colors inline-flex items-center justify-center space-x-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Review again</span>
                      <kbd className={kbdClass}>2</kbd>
                    </button>
                  </div>
                </div>
              )}
            </article>

            {/* Manual navigation */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => move(-1)}
                disabled={currentIdx === 0}
                aria-label="Previous card"
                className="min-h-11 px-4 py-2.5 rounded-xl border border-border bg-surface text-ink-soft text-sm font-semibold hover:bg-sunken transition-colors disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                disabled={currentIdx >= total - 1}
                aria-label="Next card"
                className="min-h-11 px-4 py-2.5 rounded-xl border border-border bg-surface text-ink-soft text-sm font-semibold hover:bg-sunken transition-colors disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1.5"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </section>
        )}

        {/* Keyboard hint (desktop) / touch hint (mobile) */}
        <footer className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-muted">
          <p className="hidden sm:flex items-center gap-2">
            <Keyboard className="w-3.5 h-3.5" />
            <span>
              <kbd className={kbdClass}>Space</kbd> reveal ·{' '}
              <kbd className={kbdClass}>1</kbd> Know it ·{' '}
              <kbd className={kbdClass}>2</kbd> Review again ·{' '}
              <kbd className={kbdClass}>←</kbd>
              <kbd className={kbdClass}>→</kbd> navigate
            </span>
          </p>
          <p className="sm:hidden">Tap to reveal, then choose Know it or Review again.</p>
        </footer>
      </div>
    </div>
  );
};
