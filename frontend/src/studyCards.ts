/**
 * Study Mode flashcards, built only from sections that already exist.
 * No AI call, no invented content: every card is a reframing of reviewer data.
 */

import type { ReviewerData, MustRememberItem } from './types/reviewer';

export type StudyCardKind = 'keyword' | 'must_remember' | 'concept' | 'formula' | 'process';

export interface StudyCard {
  id: string;
  kind: StudyCardKind;
  section: string;
  front: string;
  back: string;
  points?: string[];
  formula?: string;
  variables?: Array<{ symbol: string; meaning: string }>;
  extraLabel?: string;
  extra?: string;
  example?: string;
}

const cutAtWord = (text: string, max: number): number => {
  if (text.length <= max) return text.length;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return lastSpace > 24 ? lastSpace : max;
};

/**
 * A recall cue for a high-yield fact: enough of the statement to identify it,
 * never the whole answer. Uses the first sentence only when it still hides a
 * meaningful tail; otherwise masks the statement at a word boundary.
 */
export const mustRememberCue = (text: string): string => {
  const value = text.trim();
  if (value.length <= 40) return value; // too short to mask without losing the cue

  const stop = value.search(/[.!?](\s|$)/);
  if (stop > 24 && stop + 1 <= Math.floor(value.length * 0.75)) {
    return value.slice(0, stop + 1);
  }

  const cut = cutAtWord(value, Math.max(24, Math.floor(value.length * 0.6)));
  return cut < value.length ? `${value.slice(0, cut).trimEnd()}…` : value;
};

/** Cards in study order: keywords, must-remember, concepts, formulas, processes. */
export const buildStudyCards = (data?: ReviewerData | null): StudyCard[] => {
  const source: Partial<ReviewerData> = data || {};
  const cards: StudyCard[] = [];

  (source.keywords || []).forEach((keyword, i) => {
    if (!keyword?.term) return;
    cards.push({
      id: `kw-${i}`,
      kind: 'keyword',
      section: 'Keyword',
      front: `What is ${keyword.term}?`,
      back: keyword.definition || '',
    });
  });

  const mustItems: Array<MustRememberItem | string> = source.must_remember || [];
  mustItems.forEach((item, i) => {
    const text = typeof item === 'string' ? item : item?.text;
    if (!text || !text.trim()) return;
    cards.push({
      id: `mr-${i}`,
      kind: 'must_remember',
      section: 'Must Remember',
      front: mustRememberCue(text),
      back: text,
    });
  });

  (source.core_concepts || []).forEach((concept, i) => {
    if (!concept?.concept) return;
    const points = (concept.points || []).filter(Boolean);
    cards.push({
      id: `cc-${i}`,
      kind: 'concept',
      section: 'Core Concept',
      front: concept.concept,
      back: concept.explanation || '',
      points: points.length > 0 ? points : undefined,
    });
  });

  (source.formulas_rules || []).forEach((formula, i) => {
    if (!formula?.name) return;
    cards.push({
      id: `fm-${i}`,
      kind: 'formula',
      section: 'Formula / Rule',
      front: formula.name,
      back: '',
      formula: formula.formula || '',
      variables: (formula.variables || []).filter((v) => v?.symbol || v?.meaning),
      extraLabel: formula.when_to_use ? 'When to use' : undefined,
      extra: formula.when_to_use || undefined,
      example: formula.example || undefined,
    });
  });

  (source.process_steps || []).forEach((proc, i) => {
    if (!proc?.process_title || !proc.steps?.length) return;
    cards.push({
      id: `ps-${i}`,
      kind: 'process',
      section: 'Process / Steps',
      front: proc.process_title,
      back: '',
      points: proc.steps.map(
        (step) => `${step.step_number}. ${step.title} — ${step.description}`,
      ),
    });
  });

  return cards;
};
