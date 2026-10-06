import type { SourceReference } from './types/reviewer';

/** Honest extraction-quality labels shared by the reviewer header and source viewer. */
export const QUALITY_STYLES: Record<string, string> = {
  good: 'bg-emerald-soft text-emerald-ink border-emerald-line',
  partial: 'bg-amber-soft text-amber-ink border-amber-line',
  poor: 'bg-rose-soft text-rose-ink border-rose-line',
  unknown: 'bg-sunken text-ink-muted border-border',
};

export const QUALITY_LABELS: Record<string, string> = {
  good: 'Extraction: good',
  partial: 'Extraction: partial',
  poor: 'Extraction: poor',
  unknown: 'Extraction: not rated',
};

export const sourceRefLabel = (ref: SourceReference): string => {
  if (ref.label) return ref.label;
  if (ref.type === 'page') return ref.index ? `Page ${ref.index}` : 'Page';
  if (ref.type === 'slide') return ref.index ? `Slide ${ref.index}` : 'Slide';
  if (ref.type === 'image') return 'Image';
  return 'Text';
};
