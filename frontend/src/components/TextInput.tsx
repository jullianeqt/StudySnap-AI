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
        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
          <span>Try a sample college lecture:</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {SAMPLE_LESSONS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectSample(sample.content)}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-medium border border-slate-200 hover:border-indigo-200 transition-colors"
            >
              ⚡ {sample.category}
            </button>
          ))}
        </div>
      </div>

      <div className="relative rounded-2xl border border-slate-300 bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Paste lecture notes, textbook chapters, slide transcripts, or study guidelines here..."
          className="w-full h-48 p-4 text-sm text-slate-800 placeholder-slate-400 bg-transparent border-0 resize-none focus:outline-none focus:ring-0 leading-relaxed"
        />

        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-100 rounded-b-2xl text-xs text-slate-500">
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
              className="inline-flex items-center space-x-1 text-slate-400 hover:text-rose-600 font-medium transition-colors"
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

