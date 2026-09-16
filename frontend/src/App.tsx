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
import type { ReviewerRecord, QuizQuestion, QuizConfig } from './types/reviewer';

const getApiUrl = (path: string) => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');
  return `${baseUrl || ''}${path}`;
};

export function App() {
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
      } else {
        throw new Error('No quiz questions generated.');
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

    try {
      const res = await fetch(getApiUrl('/api/transform'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewer: currentReviewer.reviewer,
          action: action,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.reviewer) {
          setCurrentReviewer({
            ...currentReviewer,
            reviewer: data.reviewer,
          });
        }
      }
    } catch (err) {
      console.error('Transform error:', err);
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-indigo-500/20">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 no-print">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentReviewer(null)}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-black text-lg shadow-md shadow-indigo-200">
              ⚡
            </div>
            <div>
              <span className="font-extrabold text-slate-900 text-lg tracking-tight">StudySnap</span>
              <span className="ml-1 text-xs font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">AI</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors inline-flex items-center space-x-1.5"
            >
              <History className="w-4 h-4" />
              <span>History</span>
              {historyList.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {historyList.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsApiModalOpen(true)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors inline-flex items-center space-x-1.5 ${
                apiKey
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>{apiKey ? 'Gemini 3.8 Active' : 'AI Engine'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-8 pb-16">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-10 no-print">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Smart Exam & Quiz Reviewer Generator</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-3">
            Turn your lessons into reviewers you'll <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">actually want to read</span>.
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl mx-auto">
            Upload a PDF, PPT, image, or text. StudySnap AI turns it into concise, high-yield notes for faster quiz and exam review.
          </p>
        </div>

        {/* Upload & Input Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 mb-10 no-print">
          {/* Tabs */}
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-4 mb-6">
            <button
              type="button"
              onClick={() => setActiveInputTab('upload')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center space-x-2 ${
                activeInputTab === 'upload'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
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
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
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
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center space-x-1.5 text-slate-500 font-semibold">
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                <span>Length:</span>
              </div>
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                {(['quick', 'standard', 'detailed'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setCompression(lvl)}
                    className={`px-2.5 py-1 rounded-md capitalize font-semibold transition-all ${
                      compression === lvl ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-1.5 text-slate-500 font-semibold ml-2">
                <span>Tone:</span>
              </div>
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
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
                      tone === t.id ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
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
              className="px-7 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center space-x-2 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Generate Study Reviewer</span>
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Processing State Animation */}
        {isProcessing && (
          <ProcessingState filename={selectedFile?.name || "Pasted Lecture"} />
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
      <footer className="bg-white border-t border-slate-200 py-6 px-4 text-center text-xs text-slate-400 no-print">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            StudySnap AI • Built for high-yield exam preparation.
          </p>
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1 text-slate-500">
              <Shield className="w-3.5 h-3.5 text-indigo-500" />
              <span>100% Faithful to Source Material</span>
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
