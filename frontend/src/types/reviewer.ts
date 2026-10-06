export interface SourceReference {
  type: 'page' | 'slide' | 'text' | 'image';
  index?: number;
  label?: string;
}

/** One extracted page/slide/text block, stored once per reviewer record. */
export interface SourceSegment {
  source_type: string;
  source_index: number;
  label: string;
  text: string;
}

export type ExtractionWarning = string;

export interface ExtractionMetadata {
  pages?: number;
  slides?: number;
  words?: number;
  characters?: number;
  filename?: string;
  width?: number;
  height?: number;
  format?: string;
}

/** Response shape of POST /api/extract. */
export interface ExtractionResult {
  success: boolean;
  filename: string;
  text: string;
  segments: SourceSegment[];
  page_count: number;
  file_type: string;
  metadata?: ExtractionMetadata;
  quality: ExtractionQuality;
  extraction_quality: ExtractionQuality;
  warnings: ExtractionWarning[];
  extraction_warnings: ExtractionWarning[];
  image_b64?: string;
  mime_type?: string;
  error?: string;
}

export interface KeywordItem {
  term: string;
  definition: string;
  importance?: 'high' | 'medium';
  starred?: boolean;
  sources?: SourceReference[];
}

export interface CoreConceptItem {
  concept: string;
  explanation: string;
  points: string[];
  sources?: SourceReference[];
}

export interface MustRememberItem {
  text: string;
  sources?: SourceReference[];
}

export interface ComparisonAspect {
  aspect: string;
  a_val: string;
  b_val: string;
}

export interface ComparisonItem {
  concept_a: string;
  concept_b: string;
  aspects: ComparisonAspect[];
  sources?: SourceReference[];
}

export interface ProcessStep {
  step_number: number;
  title: string;
  description: string;
}

export interface ProcessItem {
  process_title: string;
  steps: ProcessStep[];
  sources?: SourceReference[];
}

export interface FormulaVariable {
  symbol: string;
  meaning: string;
}

export interface FormulaItem {
  name: string;
  formula: string;
  variables: FormulaVariable[];
  when_to_use: string;
  example?: string;
  sources?: SourceReference[];
}

export interface ExampleItem {
  concept: string;
  example: string;
  explanation: string;
  sources?: SourceReference[];
}

export interface QuizPointItem {
  question_clue: string;
  key_fact: string;
  question_type: string;
  sources?: SourceReference[];
}

export type ReviewerSectionName =
  | 'quick_review'
  | 'keywords'
  | 'core_concepts'
  | 'must_remember'
  | 'compare'
  | 'process_steps'
  | 'formulas_rules'
  | 'examples'
  | 'possible_quiz_points'
  | 'one_minute_review';

export interface GenerationMeta {
  source_characters: number;
  source_segments: number;
  sections_generated: number;
  sections_empty: ReviewerSectionName[];
  warnings: string[];
  provider: string;
}

export type ExtractionQuality = 'good' | 'partial' | 'poor' | 'unknown';

export interface ReviewerData {
  subject: string;
  lesson_title: string;
  quick_review: string[];
  keywords: KeywordItem[];
  core_concepts: CoreConceptItem[];
  must_remember: MustRememberItem[];
  compare: ComparisonItem[];
  process_steps: ProcessItem[];
  formulas_rules: FormulaItem[];
  examples: ExampleItem[];
  possible_quiz_points: QuizPointItem[];
  one_minute_review: string;
  source_flags?: string[];
}

export interface ReviewerRecord {
  id: string;
  title: string;
  subject: string;
  date_created: string;
  pages_processed: number;
  /** Present on history entries only ("Ready"). */
  status?: string;
  compression?: 'quick' | 'standard' | 'detailed';
  tone?: 'standard' | 'simpler' | 'eli5';
  ai_provider?: string;
  filename: string;
  reviewer: ReviewerData;
  generation_meta?: GenerationMeta;
  extraction_quality?: ExtractionQuality;
  extraction_warnings?: ExtractionWarning[];
  /** Source verification payload. Absent on records saved before source viewing. */
  file_type?: string;
  segments?: SourceSegment[];
  segments_truncated?: boolean;
}

export interface QuizQuestion {
  id: number;
  type: 'multiple_choice' | 'true_false' | 'identification';
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
  topic: string;
}

export interface QuizConfig {
  question_count: number;
  question_type: 'mixed' | 'multiple_choice' | 'true_false' | 'identification';
}

export type ProcessingStage = 'idle' | 'reading' | 'finding_concepts' | 'building' | 'complete' | 'error';

/** Legacy reviewers stored must_remember as plain strings; tolerate both forms. */
export const mustRememberText = (item: MustRememberItem | string): string =>
  typeof item === 'string' ? item : item?.text ?? '';
