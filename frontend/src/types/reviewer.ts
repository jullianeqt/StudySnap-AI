export interface KeywordItem {
  term: string;
  definition: string;
  importance?: 'high' | 'medium';
  starred?: boolean;
}

export interface CoreConceptItem {
  concept: string;
  explanation: string;
  points: string[];
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
}

export interface ProcessStep {
  step_number: number;
  title: string;
  description: string;
}

export interface ProcessItem {
  process_title: string;
  steps: ProcessStep[];
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
}

export interface ExampleItem {
  concept: string;
  example: string;
  explanation: string;
}

export interface QuizPointItem {
  question_clue: string;
  key_fact: string;
  question_type: string;
}

export interface ReviewerData {
  subject: string;
  lesson_title: string;
  quick_review: string[];
  keywords: KeywordItem[];
  core_concepts: CoreConceptItem[];
  must_remember: string[];
  compare: ComparisonItem[];
  process_steps: ProcessItem[];
  formulas_rules: FormulaItem[];
  examples: ExampleItem[];
  possible_quiz_points: QuizPointItem[];
  one_minute_review: string;
}

export interface ReviewerRecord {
  id: string;
  title: string;
  subject: string;
  date_created: string;
  pages_processed: number;
  compression?: 'quick' | 'standard' | 'detailed';
  tone?: 'standard' | 'simpler' | 'eli5';
  ai_provider?: string;
  filename: string;
  reviewer: ReviewerData;
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

