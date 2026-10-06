import React from 'react';
import { Trash2, BookOpen } from 'lucide-react';
import { SAMPLE_LESSONS } from '../data/sampleLessons';

interface TextInputProps {
  text: string;
  onChange: (val: string) => void;
  onSelectSample: (content: string) => void;
  disabled?: boolean;
}

export const TextInput: React.FC<TextInputProps> = ({
  text,
  onChange,
  onSelectSample,
  disabled = false,
}) => {
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2 text-xs text-ink-muted">
          <BookOpen className="w-3.5 h-3.5 text-accent-ink" />
          <span>Try a sample college lecture:</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {SAMPLE_LESSONS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectSample(sample.content)}
              aria-label={`Insert sample lesson: ${sample.category}`}
              className="text-xs px-2.5 py-1 rounded-lg bg-sunken hover:bg-accent-soft hover:text-accent-ink text-ink-soft font-medium border border-border hover:border-accent-line transition-colors"
            >
              ⚡ {sample.category}
            </button>
          ))}
        </div>
      </div>

      <div className="relative rounded-2xl border border-border-strong bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-line transition-all">
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label="Lesson content"
          placeholder="Paste lecture notes, textbook chapters, slide transcripts, or study guidelines here..."
          className="w-full h-48 p-4 text-sm text-ink bg-transparent border-0 resize-none focus:outline-none focus:ring-0 leading-relaxed"
        />

        <div className="flex items-center justify-between px-4 py-2.5 bg-sunken border-t border-border rounded-b-2xl text-xs text-ink-muted">
          <div className="flex items-center space-x-3">
            <span>{wordCount} words</span>
            <span>•</span>
            <span>{charCount} characters</span>
          </div>

          {text && (
            <button
              type="button"
              onClick={() => onChange('')}
              disabled={disabled}
              aria-label="Clear lesson content"
              className="inline-flex items-center space-x-1 text-ink-muted hover:text-rose-ink font-medium transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

