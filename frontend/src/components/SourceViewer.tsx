import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, ChevronUp, ChevronDown, TriangleAlert, FileText } from 'lucide-react';
import type { ReviewerRecord, SourceReference, SourceSegment } from '../types/reviewer';
import { QUALITY_STYLES, QUALITY_LABELS } from '../source';

const MAX_MATCHES = 500;

const FILE_TYPE_LABELS: Record<string, string> = {
  pdf: 'PDF',
  pptx: 'PowerPoint',
  text: 'Text file',
  image: 'Image',
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchOffsets = (text: string, query: string): number[] => {
  if (!query || !text) return [];
  const regex = new RegExp(escapeRegExp(query), 'gi');
  const offsets: number[] = [];
  let found = regex.exec(text);
  while (found !== null && offsets.length < MAX_MATCHES) {
    offsets.push(found.index);
    if (found[0].length === 0) regex.lastIndex += 1;
    found = regex.exec(text);
  }
  return offsets;
};

/** Map a badge reference onto the stored segment it points at. */
const resolveSegmentIndex = (
  segments: SourceSegment[],
  ref?: SourceReference | null,
): number => {
  if (!ref || segments.length === 0) return -1;

  const families: Record<string, string[]> = {
    page: ['pdf_page', 'page'],
    slide: ['pptx_slide', 'slide'],
    text: ['text'],
    image: ['image'],
  };
  const family = families[ref.type] || [];

  const byTypeAndIndex = segments.findIndex(
    (seg) =>
      family.includes(seg.source_type) &&
      (ref.index === undefined || seg.source_index === ref.index),
  );
  if (byTypeAndIndex >= 0) return byTypeAndIndex;

  if (ref.label) {
    const wanted = ref.label.trim().toLowerCase();
    const byLabel = segments.findIndex(
      (seg) => (seg.label || '').trim().toLowerCase() === wanted,
    );
    if (byLabel >= 0) return byLabel;
  }

  if (ref.index !== undefined) {
    const byIndex = segments.findIndex((seg) => seg.source_index === ref.index);
    if (byIndex >= 0) return byIndex;
  }

  return -1;
};

interface SourceViewerProps {
  record: ReviewerRecord;
  isOpen: boolean;
  target?: SourceReference | null;
  targetSeq?: number;
  onClose: () => void;
}

export const SourceViewer: React.FC<SourceViewerProps> = ({
  record,
  isOpen,
  target = null,
  targetSeq = 0,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const segments = useMemo<SourceSegment[]>(() => {
    const raw = Array.isArray(record.segments) ? record.segments : [];
    return raw.filter(
      (seg): seg is SourceSegment =>
        Boolean(seg) && typeof seg.text === 'string' && typeof seg.label === 'string',
    );
  }, [record.segments]);

  const matches = useMemo(() => {
    const flat: Array<{ segIdx: number; start: number }> = [];
    segments.forEach((seg, segIdx) => {
      if (flat.length >= MAX_MATCHES) return;
      matchOffsets(seg.text, query.trim()).forEach((start) => {
        if (flat.length < MAX_MATCHES) flat.push({ segIdx, start });
      });
    });
    return flat;
  }, [segments, query]);

  const matchesBySeg = useMemo(() => {
    const map: Record<number, Array<{ start: number; global: number }>> = {};
    matches.forEach((match, global) => {
      (map[match.segIdx] ||= []).push({ start: match.start, global });
    });
    return map;
  }, [matches]);

  const activeMatch = matches.length > 0 ? Math.min(cursor, matches.length - 1) : -1;

  // Derived during render: the segment a badge pointed at, replayed via CSS.
  const flashSeg = isOpen ? resolveSegmentIndex(segments, target) : -1;

  const scrollToElement = useCallback((el: HTMLElement | null) => {
    const container = containerRef.current;
    if (!el || !container) return;
    const delta =
      el.getBoundingClientRect().top -
      container.getBoundingClientRect().top -
      container.clientHeight / 3;
    container.scrollTo({ top: container.scrollTop + delta, behavior: 'smooth' });
  }, []);

  const stepMatch = useCallback(
    (direction: 1 | -1) => {
      if (matches.length === 0) return;
      setCursor((current) => (current + direction + matches.length) % matches.length);
    },
    [matches.length],
  );

  // Open: remember focus, lock background scroll, listen for Escape + Tab trap.
  useEffect(() => {
    if (!isOpen) return;
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
    };
  }, [isOpen, onClose]);

  // Close: hand focus back to the badge or button that opened the viewer.
  useEffect(() => {
    if (isOpen) return;
    const element = restoreFocusRef.current;
    if (element && document.contains(element)) element.focus();
  }, [isOpen]);

  // Badge click: scroll the referenced segment into view. The flash itself is a
  // CSS animation restarted by the article's key, so no state updates are needed.
  useEffect(() => {
    if (!isOpen || flashSeg < 0) return;
    const element = containerRef.current?.querySelector<HTMLElement>(`[data-seg="${flashSeg}"]`);
    scrollToElement(element ?? null);
  }, [isOpen, flashSeg, targetSeq, scrollToElement]);

  // Search: keep the current hit visible. Only query/position changes retrigger it,
  // so opening the panel never yanks the scroll away from a badge target (the panel
  // refs are null while closed, which makes this a no-op then).
  useEffect(() => {
    if (activeMatch < 0) return;
    const element = containerRef.current?.querySelector<HTMLElement>(
      `[data-match="${activeMatch}"]`,
    );
    scrollToElement(element ?? null);
  }, [activeMatch, query, matches.length, scrollToElement]);

  const renderSegmentText = (segIdx: number, text: string) => {
    const hits = matchesBySeg[segIdx];
    const length = query.trim().length;
    if (!hits || hits.length === 0 || length === 0) return text;

    const nodes: React.ReactNode[] = [];
    let position = 0;
    hits.forEach((hit) => {
      if (hit.start > position) nodes.push(text.slice(position, hit.start));
      const isCurrent = hit.global === activeMatch;
      nodes.push(
        <mark
          key={hit.start}
          data-match={hit.global}
          className={
            isCurrent
              ? 'bg-accent text-white rounded-sm px-0.5'
              : 'bg-amber-soft text-ink rounded-sm px-0.5'
          }
        >
          {text.slice(hit.start, hit.start + length)}
        </mark>,
      );
      position = hit.start + length;
    });
    if (position < text.length) nodes.push(text.slice(position));
    return <>{nodes}</>;
  };

  if (!isOpen) return null;

  const quality = record.extraction_quality || 'unknown';
  const fileTypeLabel = FILE_TYPE_LABELS[(record.file_type || '').toLowerCase()] || 'Source';
  const warnings = (record.extraction_warnings || []).filter(Boolean);
  const hasSegments = segments.length > 0;
  const pages = record.pages_processed ?? 0;

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/60 z-40 no-print"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-viewer-title"
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[26rem] lg:w-[30rem] bg-surface border-l border-border shadow-2xl flex flex-col no-print"
      >
        <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="source-viewer-title"
                className="text-xs font-extrabold text-ink uppercase tracking-wider"
              >
                Source material
              </h2>
              <p className="text-xs text-ink-muted truncate flex items-center gap-1.5 mt-0.5">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span title={record.filename}>{record.filename || 'Uploaded material'}</span>
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close source viewer"
              className="p-2 rounded-xl text-ink-soft hover:text-ink hover:bg-sunken transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
            <span className="px-2 py-0.5 rounded-full border border-border bg-sunken text-ink-soft">
              {fileTypeLabel}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full border ${QUALITY_STYLES[quality] || QUALITY_STYLES.unknown}`}
            >
              {QUALITY_LABELS[quality] || QUALITY_LABELS.unknown}
            </span>
            <span className="text-ink-muted font-semibold">
              {pages} {pages === 1 ? 'page/slide' : 'pages/slides'}
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4" ref={containerRef}>
          <p className="text-[11px] leading-relaxed text-ink-muted bg-sunken border border-border rounded-xl p-3">
            Text extracted from your material, grouped by page or slide where the file
            provided them. Verify important statements against the original file — StudySnap
            does not claim the extraction is complete.
          </p>

          {warnings.length > 0 && (
            <div className="rounded-xl border border-amber-line bg-amber-soft/70 p-3 space-y-1.5">
              <p className="text-[11px] font-bold text-amber-ink inline-flex items-center gap-1.5">
                <TriangleAlert className="w-3.5 h-3.5 shrink-0" />
                Extraction warnings
              </p>
              {warnings.map((warning, idx) => (
                <p key={idx} className="text-[11px] leading-relaxed text-amber-ink">
                  {warning}
                </p>
              ))}
            </div>
          )}

          {record.segments_truncated && hasSegments && (
            <p className="text-[11px] leading-relaxed text-ink-soft border border-border rounded-xl p-3 bg-sunken">
              Only part of the extracted text is stored for this record, to keep local history
              small. Search covers the stored portion only — re-upload the original file for the
              full text.
            </p>
          )}

          {hasSegments && (
            <div className="sticky top-0 -mx-4 px-4 py-2 bg-surface/95 backdrop-blur-sm z-10 border-b border-border/70 no-print">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-ink-muted" />
                <input
                  type="text"
                  inputMode="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setCursor(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      stepMatch(event.shiftKey ? -1 : 1);
                    }
                  }}
                  aria-label="Search the extracted source text"
                  placeholder="Search in source..."
                  className="w-full pl-8 pr-24 py-2 text-xs rounded-xl border border-border bg-sunken focus:bg-surface focus:outline-none focus:border-accent"
                />
                <div className="absolute right-2 top-1.5 flex items-center space-x-1">
                  <span
                    className="text-[10px] text-ink-muted font-semibold tabular-nums"
                    role="status"
                    aria-live="polite"
                  >
                    {query.trim()
                      ? matches.length === 0
                        ? 'No matches'
                        : `${activeMatch + 1}/${matches.length}`
                      : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => stepMatch(-1)}
                    disabled={matches.length === 0}
                    aria-label="Previous match"
                    className="p-1 rounded-md text-ink-soft hover:bg-sunken disabled:opacity-40"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => stepMatch(1)}
                    disabled={matches.length === 0}
                    aria-label="Next match"
                    className="p-1 rounded-md text-ink-soft hover:bg-sunken disabled:opacity-40"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {hasSegments ? (
            <div className="space-y-3">
              {segments.map((segment, idx) => (
                <article
                  key={
                    flashSeg === idx
                      ? `seg-flash-${targetSeq}-${idx}`
                      : `seg-${segment.source_type}-${segment.source_index}-${idx}`
                  }
                  data-seg={idx}
                  className={`rounded-xl border p-3 scroll-mt-4 transition-colors ${
                    flashSeg === idx
                      ? 'border-accent ring-2 ring-accent bg-accent-soft/40 animate-[source-flash_2.6s_ease-out_1]'
                      : 'border-border bg-surface'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-accent-line bg-accent-soft text-accent-ink">
                      {segment.label}
                    </span>
                    <span className="text-[10px] text-ink-muted">
                      {segment.text.trim().length > 0
                        ? `${segment.text.length} characters`
                        : 'No text extracted'}
                    </span>
                  </div>
                  {segment.text.trim().length > 0 ? (
                    <div className="text-xs leading-relaxed text-ink-soft whitespace-pre-wrap break-words">
                      {renderSegmentText(idx, segment.text)}
                    </div>
                  ) : (
                    <p className="text-[11px] leading-relaxed text-amber-ink">
                      No usable text was extracted here, so nothing from this part of the file
                      could be used or verified.
                    </p>
                  )}
                </article>
              ))}

              {segments.every((segment) => segment.text.trim().length === 0) && (
                <p className="text-[11px] leading-relaxed text-rose-ink border border-rose-line bg-rose-soft/60 rounded-xl p-3">
                  No text could be extracted from this material. The reviewer may be limited or
                  empty as a result.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-sunken p-4">
              <p className="text-xs leading-relaxed text-ink-soft">
                Source material was not stored with this record, so there is nothing to show
                here. This usually means the record was created before source viewing was
                available.
              </p>
              <p className="text-[11px] leading-relaxed text-ink-muted mt-2">
                Re-upload the original file to extract and inspect its text again.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SourceViewer;
