import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, Presentation, X } from 'lucide-react';

interface FileUploaderProps {
  onFileSelected: (file: File) => void;
  selectedFile: File | null;
  onClearFile: () => void;
  disabled?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelected,
  selectedFile,
  onClearFile,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    const validExtensions = ['.pdf', '.pptx', '.jpg', '.jpeg', '.png', '.webp', '.txt', '.md'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (validExtensions.includes(ext)) {
      onFileSelected(file);
    } else {
      alert(`Unsupported file format. Please upload a PDF, PowerPoint (PPTX), Image (JPG/PNG), or Text file.`);
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="w-8 h-8 text-rose" />;
    if (['ppt', 'pptx'].includes(ext || '')) return <Presentation className="w-8 h-8 text-amber" />;
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) return <ImageIcon className="w-8 h-8 text-emerald" />;
    return <FileText className="w-8 h-8 text-accent" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="w-full">
      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-accent bg-accent-soft/70 scale-[1.01]'
              : 'border-border-strong hover:border-accent bg-surface hover:bg-sunken/60'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.pptx,.jpg,.jpeg,.png,.webp,.txt,.md"
            className="hidden"
            onChange={handleFileInputChange}
            disabled={disabled}
            aria-label="Upload lesson file (PDF, PPTX, image, or text)"
          />

          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-accent-soft border border-accent-line flex items-center justify-center text-accent-ink shadow-sm transition-transform group-hover:scale-105">
              <UploadCloud className="w-8 h-8" />
            </div>

            <div>
              <p className="text-lg font-semibold text-ink">
                Drop your lesson here
              </p>
              <p className="text-sm text-ink-muted mt-1">
                Drag and drop files or <span className="text-accent-ink font-medium hover:underline">browse files</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-soft text-rose-ink border border-rose-line">
                PDF
              </span>
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-soft text-amber-ink border border-amber-line">
                PPTX
              </span>
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-soft text-emerald-ink border border-emerald-line">
                JPG • PNG (OCR & Diagrams)
              </span>
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-accent-soft text-accent-ink border border-accent-line">
                TXT
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-accent-line bg-accent-soft/40 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-4 min-w-0">
            <div className="p-3 bg-surface rounded-xl shadow-xs border border-accent-line">
              {getFileIcon(selectedFile.name)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-ink truncate max-w-xs md:max-w-md">
                {selectedFile.name}
              </p>
              <p className="text-xs text-ink-muted mt-0.5">
                {formatFileSize(selectedFile.size)} • Ready for high-yield analysis
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClearFile();
            }}
            className="p-2 text-ink-muted hover:text-rose-ink hover:bg-rose-soft rounded-xl transition-colors"
            title="Remove file"
            aria-label={`Remove file ${selectedFile.name}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};

