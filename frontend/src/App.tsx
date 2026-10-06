import { useState, useEffect } from 'react';
import {
  Sparkles, History, Key, FileText, Upload, Sliders, Shield, Zap, AlertCircle
} from 'lucide-react';
import { FileUploader } from './components/FileUploader';
import { TextInput } from './components/TextInput';
import { ProcessingState } from './components/ProcessingState';
import { Reviewer } from './components/Reviewer';
import { QuizGenerator } from './components/QuizGenerator';
import { QuizModal } from './components/QuizModal';
import { ReviewerHistory } from './components/ReviewerHistory';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ThemeMenu } from './components/ThemeMenu';
import { useTheme } from './theme';
import type { ReviewerRecord, QuizQuestion, QuizConfig } from './types/reviewer';

const getApiUrl = (path: string) => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');
  return `${baseUrl || ''}${path}`;
};

export function App() {
  const { preference: theme, setPreference: setTheme } = useTheme();
  const [activeInputTab, setActiveInputTab] = useState<'upload' | 'text'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState<string>('');
  
  // Reviewer Options
  const [compression, setCompression] = useState<'quick' | 'standard' | 'detailed'>('standard');
  const [tone, setTone] = useState<'standard' | 'simpler' | 'eli5'>('standard');
  
  // Loading & State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentReviewer, setCurrentReviewer] = useState<ReviewerRecord | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  
  // Modals & Panels
  const [isQuizGenOpen, setIsQuizGenOpen] = useState<boolean>(false);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState<boolean>(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState<boolean>(false);
  
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<ReviewerRecord[]>([]);
  
  const [isApiModalOpen, setIsApiModalOpen] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');
  
  // Topic jump for Quiz missed questions
  const [targetSearchTopic, setTargetSearchTopic] = useState<string>('');

  // Fetch History on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch(getApiUrl('/api/history'));
      if (res.ok) {
        const data = await res.json();
        if (data.history) {
          setHistoryList(data.history);
        }
      }
    } catch (e) {
      console.warn("Could not fetch history from backend:", e);
    }
  };

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    if (key) {
      localStorage.setItem('gemini_api_key', key);
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  };

  // Main submission handler
  const handleGenerate = async (
    requestedCompression = compression,
    requestedTone = tone,
  ) => {
    setErrorMsg(null);
    setIsProcessing(true);

    try {
      let extractedText = pastedText;
      let imageB64: string | undefined = undefined;
      let mimeType: string | undefined = undefined;
      let pageCount = 1;
      let filename = "Lecture Notes";
      let extractionSegments: unknown[] = [];
      let extractionWarnings: string[] = [];
      let extractionQuality = 'unknown';

      // If file was uploaded, extract via backend first
      if (activeInputTab === 'upload' && selectedFile) {
        filename = selectedFile.name;
        const formData = new FormData();
        formData.append('file', selectedFile);

        const extractRes = await fetch(getApiUrl('/api/extract'), {
          method: 'POST',
          body: formData,
        });

        if (!extractRes.ok) {
          const errData = await extractRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to extract content from uploaded file.');
        }

        const extractData = await extractRes.json();
        extractedText = extractData.text || '';
        imageB64 = extractData.image_b64;
        mimeType = extractData.mime_type;
        pageCount = extractData.page_count || 1;
        extractionSegments = Array.isArray(extractData.segments) ? extractData.segments : [];
        extractionWarnings = Array.isArray(extractData.extraction_warnings) ? extractData.extraction_warnings : [];
        extractionQuality = extractData.extraction_quality || 'unknown';
      }

      if (!extractedText.trim() && !imageB64) {
        throw new Error('Please enter text or upload a document to analyze.');
      }

      // Generate Study Reviewer
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['X-Gemini-Key'] = apiKey;
      }

      const generateRes = await fetch(getApiUrl('/api/generate-reviewer'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: extractedText,
          image_b64: imageB64,
          mime_type: mimeType,
          filename: filename,
          compression: requestedCompression,
          tone: requestedTone,
          page_count: pageCount,
          segments: extractionSegments,
          extraction_warnings: extractionWarnings,
          extraction_quality: extractionQuality,
        }),
      });

      if (!generateRes.ok) {
        const errData = await generateRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate study reviewer.');
      }

      const result = await generateRes.json();
      if (result.success && result.data) {
        setCurrentReviewer(result.data);
        fetchHistory();
        // Scroll to reviewer view smoothly
        setTimeout(() => {
          window.scrollTo({ top: 380, behavior: 'smooth' });
        }, 300);
      } else {
        throw new Error('Unexpected response format from generator.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred while creating your study reviewer.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate Quiz
  const handleGenerateQuiz = async (config: QuizConfig) => {
    if (!currentReviewer) return;
    setIsGeneratingQuiz(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['X-Gemini-Key'] = apiKey;
      }

      const res = await fetch(getApiUrl('/api/generate-quiz'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reviewer: currentReviewer.reviewer,
          question_count: config.question_count,
          question_type: config.question_type,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate practice quiz.');

      const data = await res.json();
      if (data.questions && data.questions.length > 0) {
        setQuizQuestions(data.questions);
        setIsQuizGenOpen(false);
        setIsQuizModalOpen(true);
        if (data.message) {
          alert(data.message);
        }
      } else {
        throw new Error(data.message || 'No quiz questions could be built from this reviewer.');
      }
    } catch (err: any) {
      alert(err.message || 'Quiz generation failed.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  // Transform Reviewer (make simpler, ELI5, shorten, expand)
  const handleTransform = async (action: 'make_simpler' | 'eli5' | 'make_shorter' | 'make_detailed') => {
    if (!currentReviewer) return;

    setInfoMsg(null);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['X-Gemini-Key'] = apiKey;
      }

      const res = await fetch(getApiUrl('/api/transform'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reviewer: currentReviewer.reviewer,
          action: action,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Transform failed.');
      }

      const data = await res.json();
      if (data.reviewer) {
        setCurrentReviewer({
          ...currentReviewer,
          reviewer: data.reviewer,
        });
      }
      // Honest disclosure when the AI engine could not (or did not) rewrite the content.
      if (data.note) {
        setInfoMsg(data.note);
        setTimeout(() => setInfoMsg(null), 8000);
      }
    } catch (err: any) {
      console.error('Transform error:', err);
      setInfoMsg(err.message || 'Transform failed. The original reviewer was kept unchanged.');
      setTimeout(() => setInfoMsg(null), 8000);
    }
  };

  const handleExportPdf = async () => {
    if (!currentReviewer) return;

    const response = await fetch(getApiUrl('/api/export-pdf'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentReviewer),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to export reviewer as PDF.');
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${currentReviewer.reviewer.lesson_title || currentReviewer.title || 'study-reviewer'}`
      .replace(/[^a-z0-9 -_]/gi, '_')
      .trim() + '.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  };

  const handleClearHistory = async () => {
    if (confirm('Clear all saved reviewer history?')) {
      try {
        await fetch(getApiUrl('/api/history'), { method: 'DELETE' });
        setHistoryList([]);
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="min-h-screen bg-page text-ink flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-elevated/80 backdrop-blur-md border-b border-border/80 px-4 sm:px-8 py-3.5 no-print">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrentReviewer(null)}
            className="flex items-center space-x-3 cursor-pointer text-left"
            aria-label="Back to the StudySnap home screen"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-accent to-violet flex items-center justify-center text-white font-black text-lg shadow-md shadow-accent-line">
              ⚡
            </div>
            <div>
              <span className="font-extrabold text-ink text-lg tracking-tight">StudySnap</span>
              <span className="ml-1 text-xs font-bold px-1.5 py-0.5 rounded bg-accent-soft text-accent-ink">AI</span>
            </div>
          </button>

          <div className="flex items-center space-x-2">
            <ThemeMenu preference={theme} onChange={setTheme} />
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-accent-ink hover:bg-sunken rounded-xl transition-colors inline-flex items-center space-x-1.5"
            >
              <History className="w-4 h-4" />
              <span>History</span>
              {historyList.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
                  {historyList.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsApiModalOpen(true)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors inline-flex items-center space-x-1.5 ${
                apiKey
                  ? 'border-emerald-line bg-emerald-soft text-emerald-ink'
                  : 'border-border bg-surface text-ink-soft hover:bg-sunken'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>{apiKey ? 'AI Engine Active' : 'AI Engine'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-8 pb-16">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-10 no-print">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-accent-soft border border-accent-line text-accent-ink text-xs font-bold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Smart Exam & Quiz Reviewer Generator</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-ink tracking-tight leading-tight mb-3">
            Turn your lessons into reviewers you'll <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-violet">actually want to read</span>.
          </h1>

          <p className="text-sm sm:text-base text-ink-soft leading-relaxed max-w-xl mx-auto">
            Upload a PDF, PPT, image, or text. StudySnap AI turns it into concise, high-yield notes for faster quiz and exam review.
          </p>
        </div>

        {/* Upload & Input Card */}
        <div className="bg-surface rounded-3xl border border-border shadow-sm p-6 sm:p-8 mb-10 no-print">
          {/* Tabs */}
          <div className="flex items-center space-x-2 border-b border-border pb-4 mb-6">
            <button
              type="button"
              onClick={() => setActiveInputTab('upload')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center space-x-2 ${
                activeInputTab === 'upload'
                  ? 'bg-accent text-white shadow-xs'
                  : 'bg-sunken text-ink-soft hover:bg-border/70'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Drop Lesson File (PDF, PPT, Image)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveInputTab('text')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center space-x-2 ${
                activeInputTab === 'text'
                  ? 'bg-accent text-white shadow-xs'
                  : 'bg-sunken text-ink-soft hover:bg-border/70'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Paste Lesson Content</span>
            </button>
          </div>

          {/* Tab Content */}
          {activeInputTab === 'upload' ? (
            <FileUploader
              selectedFile={selectedFile}
              onFileSelected={(file) => setSelectedFile(file)}
              onClearFile={() => setSelectedFile(null)}
              disabled={isProcessing}
            />
          ) : (
            <TextInput
              text={pastedText}
              onChange={(val) => setPastedText(val)}
              onSelectSample={(sampleContent) => setPastedText(sampleContent)}
              disabled={isProcessing}
            />
          )}

          {/* Reviewer Preferences (Compression & Tone) */}
          <div className="mt-6 pt-5 border-t border-border flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center space-x-1.5 text-ink-muted font-semibold">
                <Sliders className="w-3.5 h-3.5 text-accent-ink" />
                <span>Length:</span>
              </div>
              <div className="inline-flex rounded-lg bg-sunken p-0.5">
                {(['quick', 'standard', 'detailed'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setCompression(lvl)}
                    className={`px-2.5 py-1 rounded-md capitalize font-semibold transition-all ${
                      compression === lvl ? 'bg-surface text-accent-ink shadow-2xs' : 'text-ink-soft'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-1.5 text-ink-muted font-semibold ml-2">
                <span>Tone:</span>
              </div>
              <div className="inline-flex rounded-lg bg-sunken p-0.5">
                {[
                  { id: 'standard', label: 'Academic' },
                  { id: 'simpler', label: 'Simpler' },
                  { id: 'eli5', label: 'Explain like I\'m new' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.id as any)}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      tone === t.id ? 'bg-surface text-accent-ink shadow-2xs' : 'text-ink-soft'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              disabled={isProcessing || (activeInputTab === 'upload' && !selectedFile && !pastedText) || (activeInputTab === 'text' && !pastedText.trim())}
              onClick={() => handleGenerate()}
              className="px-7 py-3 rounded-2xl bg-accent hover:bg-accent-hover text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center space-x-2 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Generate Study Reviewer</span>
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mt-4 p-4 rounded-xl bg-rose-soft border border-rose-line text-rose-ink text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-ink shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Processing State Animation */}
        {isProcessing && (
          <ProcessingState filename={selectedFile?.name || "Pasted Lecture"} />
        )}

        {/* Honest notice for transforms / generation limits */}
        {currentReviewer && infoMsg && (
          <div className="mb-4 p-4 rounded-xl bg-amber-soft border border-amber-line text-amber-ink text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-ink shrink-0 mt-0.5" />
            <span>{infoMsg}</span>
          </div>
        )}

        {/* Active Study Reviewer Sheet */}
        {currentReviewer && !isProcessing && (
          <Reviewer
            record={currentReviewer}
            onOpenQuizGenerator={() => setIsQuizGenOpen(true)}
            onTransform={handleTransform}
            onExportPdf={handleExportPdf}
            onSelectCompression={(newLevel) => {
              setCompression(newLevel);
              handleGenerate(newLevel, tone);
            }}
            targetSearchTopic={targetSearchTopic}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-surface border-t border-border py-6 px-4 text-center text-xs text-ink-muted no-print">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            StudySnap AI • Built for high-yield exam preparation.
          </p>
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1 text-ink-soft">
              <Shield className="w-3.5 h-3.5 text-accent-ink" />
              <span>Source-grounded generation</span>
            </span>
          </div>
        </div>
      </footer>

      {/* Quiz Configuration Modal */}
      <QuizGenerator
        isOpen={isQuizGenOpen}
        onClose={() => setIsQuizGenOpen(false)}
        onGenerateQuiz={handleGenerateQuiz}
        isGenerating={isGeneratingQuiz}
      />

      {/* Quiz Interactive Test Modal */}
      <QuizModal
        isOpen={isQuizModalOpen}
        onClose={() => setIsQuizModalOpen(false)}
        questions={quizQuestions}
        onScrollToTopic={(topic) => {
          setTargetSearchTopic(topic);
          window.scrollTo({ top: 400, behavior: 'smooth' });
        }}
      />

      {/* Recent Reviewers Dashboard */}
      <ReviewerHistory
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={historyList}
        onSelectReviewer={(rec) => {
          setCurrentReviewer(rec);
          window.scrollTo({ top: 380, behavior: 'smooth' });
        }}
        onClearHistory={handleClearHistory}
      />

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
      />
    </div>
  );
}

export default App;
