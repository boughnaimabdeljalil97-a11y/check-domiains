import React from 'react';
import { X, ShieldCheck, Globe, Zap, Database, Download } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">How Domain Checker Pro Works</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto text-sm text-slate-700">
          {/* Section 1 */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-purple-600" /> 1. RDAP WHOIS Lookup
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Fetches registration timestamps directly from <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded">https://rdap.org/domain/{'{domain}'}</code> with up to 3 retries, plus direct authoritative registry RDAP fallback (Verisign for .com/.net, PIR for .org, nic.info for .info). Reads the authoritative <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded">events[]</code> list:
              <br />• <strong className="text-slate-900">&quot;registration&quot;</strong> $\rightarrow$ Registered On (YYYY-MM-DD)
              <br />• <strong className="text-slate-900">&quot;last changed&quot;</strong> $\rightarrow$ Updated On (YYYY-MM-DD)
            </p>
          </div>

          {/* Section 2 */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-600" /> 2. Browser-Direct SSL Check
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Executes a browser-direct <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded">fetch(&quot;https://${'{domain}'}&quot;, {'{ mode: &quot;no-cors&quot; }'})</code> with a 12s timeout. If the promise resolves, the TLS/SSL handshake succeeded $\rightarrow$ <strong className="text-emerald-700">SSL = &quot;yes&quot;</strong>. If it rejects $\rightarrow$ <strong className="text-rose-700">SSL = &quot;no&quot;</strong>.
            </p>
          </div>

          {/* Section 3 */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-600" /> 3. Website Content Analysis (AllOrigins + CodeTabs + Jina)
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              A connectivity check alone is not enough — servers can return HTTP 200 while displaying error or parked pages. We fetch HTML via AllOrigins, CodeTabs, and Jina Reader (with JS rendering), handle redirects, and analyze the content:
            </p>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1 text-slate-600 font-mono">
              <div>• 404/410 HTTP code $\rightarrow$ Website = &quot;no&quot;</div>
              <div>• &lt;title&gt; contains &quot;404&quot;, &quot;not found&quot;, &quot;cannot be found&quot; $\rightarrow$ Website = &quot;no&quot;</div>
              <div>• Parked/expired markers (sedo, hugedomains, expired, renew, etc.) $\rightarrow$ Website = &quot;no&quot;</div>
              <div>• Empty stub without JS application scripts $\rightarrow$ Website = &quot;no&quot;</div>
              <div>• Valid content or JavaScript SPA (React/Vue) $\rightarrow$ <strong className="text-emerald-700 font-bold">Website = &quot;yes&quot;</strong></div>
            </div>
          </div>

          {/* Section 4 */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <Download className="w-4 h-4 text-indigo-600" /> 4. Styled Excel & CSV Export
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Export results to Excel via SheetJS with styled green &quot;yes&quot; and red &quot;no&quot; cells, auto-calculated column widths, and a dedicated &quot;Summary&quot; sheet.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
