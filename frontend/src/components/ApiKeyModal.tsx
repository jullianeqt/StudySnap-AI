import React, { useEffect, useState } from 'react';
import { Key, Check, X, Sparkles, ExternalLink } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
}) => {
  const [inputVal, setInputVal] = useState(apiKey);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveApiKey(inputVal.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  const handleClear = () => {
    setInputVal('');
    onSaveApiKey('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-key-dialog-title"
        className="bg-surface rounded-3xl max-w-md w-full p-6 shadow-2xl border border-border relative animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent-ink flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 id="api-key-dialog-title" className="font-bold text-ink text-lg">AI Engine Settings</h3>
              <p className="text-xs text-ink-muted">Configure the Gemini API key (gemini-2.5-flash)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close AI Engine Settings"
            className="p-1.5 text-ink-muted hover:text-ink-soft rounded-lg hover:bg-sunken transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div>
            <label htmlFor="gemini-api-key" className="block text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2">
              Gemini API Key (Optional)
            </label>
            <input
              id="gemini-api-key"
              type="password"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full p-3.5 rounded-xl border border-border-strong bg-surface text-ink text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-line"
            />
            <p className="text-xs text-ink-muted mt-1.5 flex items-center justify-between">
              <span>Saved locally in your browser storage.</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-accent-ink hover:underline inline-flex items-center space-x-0.5"
              >
                <span>Get free key</span>
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </a>
            </p>
          </div>

          <div className="p-3.5 bg-accent-soft/60 rounded-2xl border border-accent-line text-xs text-ink-soft space-y-1.5">
            <div className="flex items-center space-x-1.5 text-accent-ink font-semibold">
              <Sparkles className="w-4 h-4 text-accent-ink" />
              <span>Built-in Fallback Active</span>
            </div>
            <p className="leading-relaxed">
              With no API key, StudySnap uses an offline <strong>extractive engine</strong>: it only pulls statements
              that appear directly in your material, so unsupported sections are left empty instead of being
              invented. Image uploads and AI rewriting require a key.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between space-x-3">
            {apiKey && (
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2.5 rounded-xl border border-border text-ink-soft font-semibold text-xs hover:bg-sunken"
              >
                Clear Key
              </button>
            )}

            <button
              type="submit"
              className="flex-1 py-2.5 px-4 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center space-x-1.5 shadow-sm"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Key</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

