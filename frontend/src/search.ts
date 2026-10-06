/**
 * Whole-reviewer search: a flat, ordered index over every searchable field.
 *
 * Paths are stable identifiers (`kw.3.def`, `fm.0.expr`, ...) assigned in the
 * exact order the reviewer renders its sections, so match N in the index is
 * match N in the document. Highlighting re-derives the offsets inside each
 * field with the same case-insensitive matcher used to build the index.
 */

import type {
  KeywordItem,
  CoreConceptItem,
  ComparisonItem,
  ProcessItem,
  FormulaItem,
  ExampleItem,
  QuizPointItem,
} from './types/reviewer';

export interface SearchableSections {
  quickReview: string[];
  keywords: KeywordItem[];
  concepts: CoreConceptItem[];
  mustRemember: Array<{ text: string }>;
  comparisons: ComparisonItem[];
  processes: ProcessItem[];
  formulas: FormulaItem[];
  examples: ExampleItem[];
  quizPoints: QuizPointItem[];
  oneMinuteReview: string;
}

export interface SearchEntry {
  /** Global index of this field's first match. */
  offset: number;
  /** How many matches this field contributes. */
  count: number;
}

export interface ReviewerSearch {
  /** Trimmed, lower-safe query actually being matched. */
  query: string;
  entries: Map<string, SearchEntry>;
  total: number;
  /** Global index of the match currently in focus (prev/next navigation). */
  current: number;
}

export interface SearchFilterOptions {
  /** Starred Only mode: index only starred keywords/concepts. */
  stars?: Set<string> | null;
}

const MAX_MATCHES_PER_FIELD = 500;

export const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Case-insensitive offsets of every occurrence of `query` inside `text`. */
export const matchOffsets = (text: string, query: string, limit = MAX_MATCHES_PER_FIELD): number[] => {
  if (!query || !text) return [];
  const regex = new RegExp(escapeRegExp(query), 'gi');
  const offsets: number[] = [];
  let found = regex.exec(text);
  while (found !== null && offsets.length < limit) {
    offsets.push(found.index);
    if (found[0].length === 0) regex.lastIndex += 1;
    found = regex.exec(text);
  }
  return offsets;
};

export const countMatches = (text: string, query: string): number =>
  matchOffsets(text, query).length;

/** Build the ordered match index for the sections currently on screen. */
export const buildSearchIndex = (
  sections: SearchableSections,
  rawQuery: string,
  options: SearchFilterOptions = {},
): ReviewerSearch => {
  const query = rawQuery.trim();
  const entries = new Map<string, SearchEntry>();
  if (!query) return { query: '', entries, total: 0, current: 0 };

  let offset = 0;
  const add = (path: string, text: string | undefined | null) => {
    if (!text) return;
    const count = countMatches(text, query);
    if (count === 0) return;
    entries.set(path, { offset, count });
    offset += count;
  };

  sections.quickReview.forEach((point, i) => add(`quick.${i}`, point));

  sections.keywords.forEach((k, i) => {
    if (options.stars && !options.stars.has(k.term)) return;
    add(`kw.${i}.term`, k.term);
    add(`kw.${i}.def`, k.definition);
  });

  sections.concepts.forEach((c, i) => {
    if (options.stars && !options.stars.has(c.concept)) return;
    add(`cc.${i}.name`, c.concept);
    add(`cc.${i}.exp`, c.explanation);
    (c.points || []).forEach((point, j) => add(`cc.${i}.pt.${j}`, point));
  });

  sections.mustRemember.forEach((item, i) => add(`mr.${i}`, item.text));

  sections.comparisons.forEach((comp, i) => {
    add(`cmp.${i}.a`, comp.concept_a);
    add(`cmp.${i}.b`, comp.concept_b);
    (comp.aspects || []).forEach((aspect, j) => {
      add(`cmp.${i}.asp.${j}.name`, aspect.aspect);
      add(`cmp.${i}.asp.${j}.av`, aspect.a_val);
      add(`cmp.${i}.asp.${j}.bv`, aspect.b_val);
    });
  });

  sections.processes.forEach((proc, i) => {
    add(`ps.${i}.title`, proc.process_title);
    (proc.steps || []).forEach((step, j) => {
      add(`ps.${i}.st.${j}.t`, step.title);
      add(`ps.${i}.st.${j}.d`, step.description);
    });
  });

  sections.formulas.forEach((formula, i) => {
    add(`fm.${i}.name`, formula.name);
    add(`fm.${i}.expr`, formula.formula);
    (formula.variables || []).forEach((variable, j) => add(`fm.${i}.var.${j}`, variable.meaning));
    add(`fm.${i}.use`, formula.when_to_use);
    add(`fm.${i}.ex`, formula.example);
  });

  sections.examples.forEach((example, i) => {
    add(`ex.${i}.name`, example.concept);
    add(`ex.${i}.scn`, example.example);
    add(`ex.${i}.why`, example.explanation);
  });

  sections.quizPoints.forEach((quiz, i) => {
    add(`qp.${i}.clue`, quiz.question_clue);
    add(`qp.${i}.fact`, quiz.key_fact);
  });

  add('om', sections.oneMinuteReview);

  return { query, entries, total: offset, current: 0 };
};
