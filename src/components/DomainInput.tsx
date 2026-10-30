import React, { useState, useRef, useId, useMemo } from 'react';
import { Upload, Play, Sparkles, Trash2, CheckCircle2, FileText, AlertCircle } from 'lucide-react';
import { cleanAndDedupeDomains } from '../utils/domainCleaner';

interface DomainInputProps {
  onStartCheck: (domains: string[], concurrency: number, timeoutMs: number) => void;
  isRunning: boolean;
}

const SAMPLE_DOMAINS = [
  'https://www.google.com',
  'github.com/trending',
  'https://wikipedia.org',
  'cloudflare.com',
  'openai.com',
  'http://httpforever.com',
  'nytimes.com',
  'mozilla.org',
  'vellingcommtraining.com',
  'aquires.net',
  'ema-guitar.com',
  'myconnectise.net',
  'carcrashkits.com',
  'expired.badssl.com',
  'thisfakedomain99482718.xyz',
];

export const DomainInput: React.FC<DomainInputProps> = ({ onStartCheck, isRunning }) => {
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaId = useId();

  // Cleaned and deduplicated domain list
  const cleanedDomains = useMemo(() => {
    return cleanAndDedupeDomains(rawText);
  }, [rawText]);

  const handleFileUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setRawText(content);
        setFileName(file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const loadSample = () => {
    setRawText(SAMPLE_DOMAINS.join('\n'));
    setFileName(null);
  };

  const handleClear = () => {
    setRawText('');
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStart = () => {
    if (cleanedDomains.length === 0 || isRunning) return;
    onStartCheck(cleanedDomains, 4, 12000);
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
      {/* Top Header of Input Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
        <div>
          <label htmlFor={textareaId} className="text-sm font-bold text-slate-900 cursor-pointer">
            Input Domains
          </label>
          <p className="text-xs text-slate-500">
            Paste domains separated by newlines, commas, or semicolons, or upload a .txt/.csv file
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Upload file (.txt / .csv) button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
            className="hidden"
            id="file-upload-input"
          />
          <label
            htmlFor="file-upload-input"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer transition shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Upload file (.txt / .csv)</span>
          </label>

          {/* Sample domains button */}
          <button
            type="button"
            onClick={loadSample}
            disabled={isRunning}
            className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Samples</span>
          </button>

          {/* Clear button */}
          {rawText && (
            <button
              type="button"
              onClick={handleClear}
              disabled={isRunning}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer disabled:opacity-50"
              title="Clear input"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Large Textarea */}
      <div className="mt-4 relative" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
        <textarea
          id={textareaId}
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value);
            if (fileName) setFileName(null);
          }}
          disabled={isRunning}
          placeholder={`Enter domains here (separated by newlines, commas, or semicolons):
google.com
https://github.com/explore
www.wikipedia.org; cloudflare.com
openai.com, httpforever.com`}
          rows={6}
          className="w-full bg-slate-50/70 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-xl p-3.5 text-sm text-slate-900 placeholder-slate-400 font-mono resize-y outline-none transition focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
        />

        {fileName && (
          <div className="absolute top-3 right-3 flex items-center space-x-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-xs">
            <FileText className="w-3.5 h-3.5" />
            <span>Loaded: {fileName}</span>
          </div>
        )}
      </div>

      {/* Bottom Bar: Auto-clean status & Start Button */}
      <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center space-x-2 text-xs text-slate-600">
          {cleanedDomains.length > 0 ? (
            <span className="inline-flex items-center space-x-1.5 text-emerald-700 font-semibold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                <strong className="text-emerald-800">{cleanedDomains.length}</strong> clean unique domains ready
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1.5 text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>Strips protocols (https://), www, paths, queries & removes duplicates</span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleStart}
          disabled={isRunning || cleanedDomains.length === 0}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer ${
            isRunning || cleanedDomains.length === 0
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-200'
              : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-600/20 hover:shadow-md hover:-translate-y-0.5'
          }`}
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{isRunning ? 'Verification in Progress...' : `Check Domains (${cleanedDomains.length})`}</span>
        </button>
      </div>
    </div>
  );
};
