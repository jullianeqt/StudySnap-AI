// Mirrored from backend/content_rules.json for independent deployment roots.
// The backend regression suite checks that these shared rules stay identical.
import rules from './contentRules.json';
import type { ReviewerData, ReviewerRecord, QuizQuestion } from './types/reviewer';

const matches = (rule: 'institution' | 'academic' | 'advice' | 'administrative', text: string) =>
  new RegExp(rules[rule], 'i').test(text);

export function cleanText(value: string): string {
  const parts: string[] = [];
  let changed = false;
  for (const line of value.split(/\r?\n/)) {
    for (let part of line.split(/(?<=[.!?])\s+(?=[A-Za-z])|\s*[—–|]\s*|\s+-\s+/)) {
      part = part.trim();
      if (!part) continue;
      const original = part;
      const prefix = new RegExp(`^(?:#{1,6}\\s*)?(?:${rules.label}|${rules.course})\\s*(?:[:.,;\\-]\\s*)?`, 'i');
      while (true) {
        const stripped = part.replace(prefix, '').trim();
        if (stripped === part) break;
        part = stripped;
      }
      const colon = part.indexOf(':');
      if (colon >= 0) {
        const heading = part.slice(0, colon);
        if (matches('institution', heading) && !matches('academic', heading)) {
          part = part.slice(colon + 1).trim();
        }
      }
      const probe = part.replace(/^[ .,:;#-]+|[ .,:;#-]+$/g, '');
      if (!probe || matches('advice', probe) || matches('administrative', probe)) { changed = true; continue; }
      if (matches('institution', probe) && !matches('academic', probe) && probe.split(/\s+/).length <= 12) { changed = true; continue; }
      changed ||= part !== original;
      parts.push(part);
    }
  }
  return changed ? parts.join(' ').trim() : value.trim();
}

export function cleanTree(value: unknown, field = ''): unknown {
  if (rules.protected.includes(field)) return value;
  if (typeof value === 'string') return cleanText(value);
  if (Array.isArray(value)) {
    const required = (rules.required as Record<string, string[]>)[field] || [];
    return value.map(item => cleanTree(item, field)).filter(item => {
      if (!item || (Array.isArray(item) && !item.length)) return false;
      if (typeof item !== 'object') return true;
      const meaningful = (key: string) => {
        const entry = (item as Record<string, unknown>)[key];
        return Boolean(entry) && (!Array.isArray(entry) || entry.length > 0);
      };
      const contentKeys = (rules.content_any as Record<string, string[]>)[field];
      return required.every(meaningful) && (!contentKeys || contentKeys.some(meaningful));
    });
  }
  if (value !== null && typeof value === 'object') {
    const raw = value as Record<string, unknown>;
    const result = Object.fromEntries(Object.entries(raw).map(([key, item]) => [key, cleanTree(item, key)]));
    for (const [heading, body] of [['term', 'definition'], ['concept', 'explanation'], ['correct_answer', 'explanation']]) {
      const label = raw[heading];
      const explanation = raw[body];
      if (!result[heading] && typeof label === 'string' && typeof explanation === 'string' &&
        matches('institution', label) && explanation.toLowerCase().includes(label.toLowerCase()) && matches('academic', explanation)) result[heading] = label;
    }
    return result;
  }
  return value;
}

export const cleanReviewer = (reviewer: ReviewerData): ReviewerData => cleanTree(reviewer) as ReviewerData;

export function cleanRecord(record: ReviewerRecord): ReviewerRecord {
  const reviewer = cleanReviewer(record.reviewer);
  return {
    ...record, reviewer,
    title: cleanText(record.title || '') || reviewer?.lesson_title || 'Study Reviewer',
    subject: cleanText(record.subject || '') || reviewer?.subject || 'General Study',
  };
}

export function cleanQuiz(questions: QuizQuestion[]): QuizQuestion[] {
  const seen = new Set<string>();
  const seenIds = new Set<number>();
  return questions.flatMap(item => {
    if (new RegExp(`${rules.label}|${rules.course}`, 'i').test(cleanText(item.question))) return [];
    const question = cleanTree(item) as QuizQuestion;
    if (!question.question || !question.correct_answer) return [];
    if (question.type === 'multiple_choice') {
      const options = question.options || [];
      const keys = options.map(option => option.trim().toLowerCase());
      if (options.length < 2 || options.length !== item.options?.length || new Set(keys).size !== keys.length || !options.includes(question.correct_answer)) return [];
    }
    if (question.type === 'true_false' && !['true', 'false'].includes(question.correct_answer.toLowerCase())) return [];
    const key = question.question.toLowerCase();
    if (seen.has(key) || seenIds.has(question.id)) return [];
    seen.add(key);
    seenIds.add(question.id);
    return [question];
  });
}
