import React from 'react';
import { Pause, Play, Square, Loader2, Clock } from 'lucide-react';

interface ProgressBarProps {
  total: number;
  completed: number;
  activeCount: number;
  isRunning: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  total,
  completed,
  activeCount,
  isRunning,
  isPaused,
  elapsedSeconds,
  onPause,
  onResume,
  onCancel,
}) => {
  if (total === 0) return null;

  const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const isFinished = completed >= total && total > 0;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        {/* Progress Text: e.g. "Checking 5/25…" */}
        <div className="flex items-center space-x-3">
          {isRunning && !isPaused && (
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
          {isPaused && (
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
              <Pause className="w-4 h-4" />
            </div>
          )}
          {isFinished && (
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center shrink-0">
              <span className="font-bold text-xs">✓</span>
            </div>
          )}

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-slate-900">
                {isFinished
                  ? `Completed all ${total} domains`
                  : isPaused
                  ? `Paused: Checked ${completed}/${total} domains`
                  : `Checking ${completed}/${total}…`}
              </span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {percent}%
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {isRunning && !isFinished
                ? `Running 4 parallel browser workers • ${activeCount} currently in-flight`
                : `${completed} checks finished with WHOIS RDAP, SSL & content analysis`}
            </p>
          </div>
        </div>

        {/* Timer and Controls */}
        <div className="flex items-center space-x-2 self-end sm:self-auto">
          <div className="flex items-center space-x-1.5 text-xs font-mono font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{formatTime(elapsedSeconds)}</span>
          </div>

          {isRunning && (
            <div className="flex items-center space-x-1.5">
              {isPaused ? (
                <button
                  type="button"
                  onClick={onResume}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onPause}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-xl transition cursor-pointer"
                >
                  <Pause className="w-3 h-3 fill-current" />
                  <span>Pause</span>
                </button>
              )}

              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer"
                title="Stop verification"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Track */}
      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200/80">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isFinished
              ? 'bg-emerald-600'
              : isPaused
              ? 'bg-amber-500'
              : 'bg-emerald-500'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
