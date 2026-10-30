import React from 'react';
import { X, ExternalLink, Calendar, Lock, Globe, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { DomainRecord } from '../types/domain';

interface DetailModalProps {
  record: DomainRecord | null;
  onClose: () => void;
  onRecheck: (record: DomainRecord) => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({ record, onClose, onRecheck }) => {
  if (!record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center space-x-2">
            <Globe className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 font-mono">{record.domain}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-sm text-slate-700">
          {/* Quick status summary grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mb-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-500" /> SSL Handshake
              </span>
              <div className="flex items-center space-x-2">
                <span
                  className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                    record.ssl === 'yes'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}
                >
                  {record.ssl.toUpperCase()}
                </span>
                <span className="text-xs text-slate-500">
                  {record.ssl === 'yes' ? 'Direct HTTPS succeeded' : 'TLS rejected'}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mb-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-500" /> Website Content
              </span>
              <div className="flex items-center space-x-2">
                <span
                  className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                    record.website === 'yes'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : record.website === '?'
                      ? 'bg-slate-200 text-slate-700 border border-slate-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}
                >
                  {record.website === '?' ? '?' : record.website.toUpperCase()}
                </span>
                <span className="text-xs text-slate-500">
                  {record.website === 'yes'
                    ? 'Live page verified'
                    : record.website === '?'
                    ? 'Could not verify (proxies failed)'
                    : 'Unreachable / parked'}
                </span>
              </div>
            </div>
          </div>

          {/* Website Content Analysis Diagnosis */}
          {record.websiteReason && (
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Content Analysis Note:</span>
                <span>{record.websiteReason}</span>
              </div>
            </div>
          )}

          {/* WHOIS RDAP Details */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2.5">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              RDAP WHOIS Registration Dates
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500 block">Registered On:</span>
                <span className="font-mono text-slate-900 font-semibold">{record.registeredOn}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Updated On:</span>
                <span className="font-mono text-slate-900 font-semibold">{record.updatedOn}</span>
              </div>
              {record.expiresOn && (
                <div>
                  <span className="text-slate-500 block">Expires On:</span>
                  <span className="font-mono text-slate-800 font-medium">{record.expiresOn}</span>
                </div>
              )}
              {record.registrar && (
                <div className={record.expiresOn ? '' : 'col-span-2'}>
                  <span className="text-slate-500 block">Registrar:</span>
                  <span className="text-slate-800 font-medium">{record.registrar}</span>
                </div>
              )}
              {record.nameservers && record.nameservers.length > 0 && (
                <div className="col-span-2 pt-1 border-t border-slate-200">
                  <span className="text-slate-500 block mb-0.5">Name Servers:</span>
                  <div className="flex flex-wrap gap-1">
                    {record.nameservers.map((ns, idx) => (
                      <span key={idx} className="bg-slate-200/60 font-mono text-[11px] px-1.5 py-0.5 rounded text-slate-700">
                        {ns}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Diagnostics info */}
          <div className="text-xs text-slate-500 space-y-1.5 pt-1">
            {record.dnsResolves !== undefined && (
              <div className="flex items-center justify-between">
                <span>Google DNS Resolution:</span>
                <span className="font-medium text-slate-800 flex items-center gap-1">
                  {record.dnsResolves ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Resolves (A-record ok)
                    </span>
                  ) : (
                    <span className="text-rose-600">NXDOMAIN / No A-record</span>
                  )}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" /> Probe Duration:
              </span>
              <span className="font-mono text-slate-700">{record.durationMs ? `${record.durationMs}ms` : 'N/A'}</span>
            </div>
          </div>

          {/* External links */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 text-xs">
            <a
              href={`https://${record.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 hover:underline font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Visit https://{record.domain}</span>
            </a>

            <div className="flex items-center space-x-3">
              <a
                href={`https://www.whois.com/whois/${encodeURIComponent(record.domain)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-slate-900 hover:underline"
              >
                <span>Whois.com Lookup</span>
              </a>

              <a
                href={`https://rdap.org/domain/${encodeURIComponent(record.domain)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-slate-900 hover:underline"
              >
                <span>RDAP JSON</span>
              </a>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={() => {
              onRecheck(record);
              onClose();
            }}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
          >
            Re-probe Domain
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
