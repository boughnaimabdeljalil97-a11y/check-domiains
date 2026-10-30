import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
  Info,
  ShieldCheck,
  AlertTriangle,
  Globe2,
} from 'lucide-react';
import { DomainRecord, FlagValue } from '../types/domain';
import { exportToExcel, exportToCsv } from '../utils/exporter';

interface ResultsTableProps {
  records: DomainRecord[];
  activeFilter: string;
  onSelectFilter: (filter: string) => void;
  onRecheckDomain: (record: DomainRecord) => void;
  onRecheckFailed: () => void;
  onSelectRecord: (record: DomainRecord) => void;
  isRunning: boolean;
}

type SortField = 'domain' | 'registeredOn' | 'updatedOn' | 'ssl' | 'website';
type SortDirection = 'asc' | 'desc';

export const ResultsTable: React.FC<ResultsTableProps> = ({
  records,
  activeFilter,
  onSelectFilter,
  onRecheckDomain,
  onRecheckFailed,
  onSelectRecord,
  isRunning,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('domain');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);

  // Filter items
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Text search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        if (
          !r.domain.toLowerCase().includes(query) &&
          !r.registeredOn.toLowerCase().includes(query) &&
          !(r.registrar || '').toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Filter category
      if (activeFilter === 'ssl-yes') return r.ssl === 'yes';
      if (activeFilter === 'website-yes') return r.website === 'yes';
      if (activeFilter === 'both-yes') return r.ssl === 'yes' && r.website === 'yes';
      if (activeFilter === 'whois-found') return r.registeredOn !== 'no data';
      if (activeFilter === 'failed') return r.ssl === 'no' || r.website === 'no';

      return true;
    });
  }, [records, searchTerm, activeFilter]);

  // Sort items
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      let valA: string = a[sortField] || '';
      let valB: string = b[sortField] || '';

      if (sortField === 'registeredOn' || sortField === 'updatedOn') {
        if (valA === 'no data') valA = '0000-00-00';
        if (valB === 'no data') valB = '0000-00-00';
      }

      const cmp = valA.localeCompare(valB);
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredRecords, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleCopy = (domain: string) => {
    navigator.clipboard.writeText(domain);
    setCopiedDomain(domain);
    setTimeout(() => setCopiedDomain(null), 1800);
  };

  const failedCount = useMemo(() => {
    return records.filter((r) => r.status === 'completed' && (r.ssl === 'no' || r.website === 'no' || r.website === '?')).length;
  }, [records]);

  // Pill badge render helper for SSL and Website
  const renderBadge = (value: FlagValue, tooltip?: string) => {
    if (value === 'checking') {
      return (
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
          <span>checking</span>
        </span>
      );
    }
    if (value === 'pending') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
          pending
        </span>
      );
    }
    if (value === 'yes') {
      return (
        <span className="inline-flex items-center space-x-1 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>yes</span>
        </span>
      );
    }
    if (value === '?') {
      return (
        <span
          className="inline-flex items-center space-x-1 px-3 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300 shadow-xs cursor-help"
          title={tooltip || 'could not verify'}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          <span>?</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-3 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
        <span>no</span>
      </span>
    );
  };

  // Sort indicator icon
  const renderSortArrow = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-emerald-600 inline ml-1" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-emerald-600 inline ml-1" />
    );
  };

  // Empty state before checking
  if (records.length === 0) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto mb-3">
          <Globe2 className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">No domains checked yet</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
          Paste domain names in the input area above or upload a .txt/.csv file, then click &quot;Check Domains&quot; to probe RDAP WHOIS, SSL certificates, and live website content.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
      {/* Controls Bar */}
      <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white">
        {/* Search input */}
        <div className="flex items-center space-x-3 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter domains..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>

          <span className="text-xs text-slate-500 whitespace-nowrap hidden sm:inline">
            Showing <strong className="text-slate-800">{sortedRecords.length}</strong> of{' '}
            <strong className="text-slate-800">{records.length}</strong>
          </span>
        </div>

        {/* Filter tags */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectFilter('all')}
            className={`px-2.5 py-1 text-xs rounded-xl font-semibold transition cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80'
            }`}
          >
            All ({records.length})
          </button>
          <button
            type="button"
            onClick={() => onSelectFilter('ssl-yes')}
            className={`px-2.5 py-1 text-xs rounded-xl font-semibold transition cursor-pointer ${
              activeFilter === 'ssl-yes'
                ? 'bg-emerald-600 text-white'
                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            SSL yes
          </button>
          <button
            type="button"
            onClick={() => onSelectFilter('website-yes')}
            className={`px-2.5 py-1 text-xs rounded-xl font-semibold transition cursor-pointer ${
              activeFilter === 'website-yes'
                ? 'bg-emerald-600 text-white'
                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            Website yes
          </button>
          {failedCount > 0 && (
            <button
              type="button"
              onClick={() => onSelectFilter('failed')}
              className={`px-2.5 py-1 text-xs rounded-xl font-semibold transition cursor-pointer ${
                activeFilter === 'failed'
                  ? 'bg-rose-600 text-white'
                  : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              Issues ({failedCount})
            </button>
          )}
        </div>

        {/* Export Buttons */}
        <div className="flex items-center space-x-2">
          {failedCount > 0 && !isRunning && (
            <button
              type="button"
              onClick={onRecheckFailed}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer"
              title="Retry checking domains with issues"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry ({failedCount})</span>
            </button>
          )}

          {/* Download CSV button */}
          <button
            type="button"
            onClick={() => exportToCsv(sortedRecords)}
            className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition cursor-pointer shadow-xs"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Download CSV</span>
          </button>

          {/* Download Excel (.xlsx) button */}
          <button
            type="button"
            onClick={() => exportToExcel(sortedRecords)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition cursor-pointer shadow-sm shadow-emerald-600/20"
            title="Download Excel (.xlsx) with styled sheets"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Download Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-700 select-none">
              {/* Domain */}
              <th
                onClick={() => handleSort('domain')}
                className="py-3 px-4 font-bold hover:text-slate-900 cursor-pointer transition w-[28%]"
              >
                Domain {renderSortArrow('domain')}
              </th>

              {/* Registered On */}
              <th
                onClick={() => handleSort('registeredOn')}
                className="py-3 px-4 font-bold hover:text-slate-900 cursor-pointer transition w-[20%]"
              >
                Registered On {renderSortArrow('registeredOn')}
              </th>

              {/* Updated On */}
              <th
                onClick={() => handleSort('updatedOn')}
                className="py-3 px-4 font-bold hover:text-slate-900 cursor-pointer transition w-[20%]"
              >
                Updated On {renderSortArrow('updatedOn')}
              </th>

              {/* SSL */}
              <th
                onClick={() => handleSort('ssl')}
                className="py-3 px-4 font-bold hover:text-slate-900 cursor-pointer transition text-center w-[12%]"
              >
                SSL {renderSortArrow('ssl')}
              </th>

              {/* Website */}
              <th
                onClick={() => handleSort('website')}
                className="py-3 px-4 font-bold hover:text-slate-900 cursor-pointer transition text-center w-[12%]"
              >
                Website {renderSortArrow('website')}
              </th>

              {/* Actions */}
              <th className="py-3 px-4 font-bold text-right text-slate-400 w-[8%]">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {sortedRecords.map((item) => {
              const isCopied = copiedDomain === item.domain;
              const isCheckingRow = item.status === 'checking';

              return (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50/70 transition-colors group"
                >
                  {/* Domain */}
                  <td className="py-3 px-4 font-mono font-medium text-slate-900">
                    <div className="flex items-center space-x-2">
                      {isCheckingRow && (
                        <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin shrink-0" />
                      )}
                      <span className="truncate max-w-[220px] sm:max-w-[280px]" title={item.domain}>
                        {item.domain}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(item.domain)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                        title="Copy domain"
                      >
                        {isCopied ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </td>

                  {/* Registered On */}
                  <td className="py-3 px-4">
                    {isCheckingRow ? (
                      <span className="text-slate-400 text-xs flex items-center space-x-1">
                        <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                        <span>probing…</span>
                      </span>
                    ) : item.registeredOn === 'no data' ? (
                      <span className="italic text-slate-400 font-mono text-xs">no data</span>
                    ) : (
                      <span className="font-mono text-slate-600 font-medium">{item.registeredOn}</span>
                    )}
                  </td>

                  {/* Updated On */}
                  <td className="py-3 px-4">
                    {isCheckingRow ? (
                      <span className="text-slate-400 text-xs flex items-center space-x-1">
                        <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                        <span>probing…</span>
                      </span>
                    ) : item.updatedOn === 'no data' ? (
                      <span className="italic text-slate-400 font-mono text-xs">no data</span>
                    ) : (
                      <span className="font-mono text-slate-600 font-medium">{item.updatedOn}</span>
                    )}
                  </td>

                  {/* SSL */}
                  <td className="py-3 px-4 text-center">
                    {renderBadge(item.ssl)}
                  </td>

                  {/* Website */}
                  <td className="py-3 px-4 text-center">
                    {renderBadge(item.website, item.websiteReason || (item.website === '?' ? 'could not verify' : undefined))}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <button
                        type="button"
                        onClick={() => onSelectRecord(item)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                        title="Inspect details & content analysis"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>

                      <a
                        href={`https://${item.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded text-slate-400 hover:text-emerald-700 hover:bg-slate-100 transition cursor-pointer"
                        title="Open in new tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table Footer Summary */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <div>
          <span>WHOIS RDAP dates via rdap.org • SSL browser handshake • AllOrigins content analysis</span>
        </div>
        <div>
          <span>{records.filter((r) => r.status === 'completed').length} of {records.length} checked</span>
        </div>
      </div>
    </div>
  );
};
