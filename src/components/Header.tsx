import React from 'react';
import { Globe, ShieldCheck, HelpCircle, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  onOpenHelp: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenHelp }) => {
  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Domain Checker <span className="text-emerald-600 font-extrabold">Pro</span>
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                100% Client-Side
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              RDAP WHOIS dates • Direct SSL handshake • HTML content analysis
            </p>
          </div>
        </div>

        {/* Status badges & Help */}
        <div className="flex items-center space-x-3">
          <div className="hidden md:flex items-center space-x-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Zero API Keys</span>
            <span className="text-slate-300">•</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Concurrency 4x</span>
          </div>

          <button
            type="button"
            onClick={onOpenHelp}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl border border-slate-200 transition cursor-pointer"
            title="How it works"
          >
            <HelpCircle className="w-4 h-4 text-slate-500" />
            <span>How It Works</span>
          </button>
        </div>
      </div>
    </header>
  );
};
