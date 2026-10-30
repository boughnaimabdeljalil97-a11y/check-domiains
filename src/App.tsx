import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { DomainInput } from './components/DomainInput';
import { ProgressBar } from './components/ProgressBar';
import { SummaryCards } from './components/SummaryCards';
import { ResultsTable } from './components/ResultsTable';
import { DetailModal } from './components/DetailModal';
import { HelpModal } from './components/HelpModal';
import { DomainRecord, CheckerSummary } from './types/domain';
import { DomainQueueRunner } from './utils/queueRunner';
import { checkSingleDomain } from './utils/checker';

export default function App() {
  const [records, setRecords] = useState<DomainRecord[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeWorkers, setActiveWorkers] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedRecord, setSelectedRecord] = useState<DomainRecord | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const runnerRef = useRef<DomainQueueRunner | null>(null);
  const timerRef = useRef<number | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Summary counts
  const summary: CheckerSummary = useMemo(() => {
    let completed = 0;
    let pending = 0;
    let checking = 0;
    let sslYes = 0;
    let sslNo = 0;
    let websiteYes = 0;
    let websiteNo = 0;
    let bothYes = 0;
    let whoisFound = 0;

    for (const r of records) {
      if (r.status === 'completed') completed++;
      else if (r.status === 'pending') pending++;
      else if (r.status === 'checking') checking++;

      if (r.ssl === 'yes') sslYes++;
      else if (r.ssl === 'no') sslNo++;

      if (r.website === 'yes') websiteYes++;
      else if (r.website === 'no') websiteNo++;

      if (r.ssl === 'yes' && r.website === 'yes') bothYes++;
      if (r.registeredOn && r.registeredOn !== 'no data') whoisFound++;
    }

    return {
      total: records.length,
      completed,
      pending,
      checking,
      sslYes,
      sslNo,
      websiteYes,
      websiteNo,
      bothYes,
      whoisFound,
    };
  }, [records]);

  // Handle record updates from concurrent runner
  const handleRecordUpdate = useCallback((updated: DomainRecord) => {
    setRecords((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
    if (runnerRef.current) {
      const status = runnerRef.current.getStatus();
      setActiveWorkers(status.activeCount);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (runnerRef.current) {
        runnerRef.current.cancel();
      }
    };
  }, [stopTimer]);

  // Start new verification batch
  const handleStartCheck = (domains: string[], concurrency = 4, timeoutMs = 12000) => {
    stopTimer();

    const newRecords: DomainRecord[] = domains.map((d, index) => ({
      id: `${d}-${index}-${Date.now()}`,
      domain: d,
      status: 'pending',
      registeredOn: 'no data',
      updatedOn: 'no data',
      ssl: 'pending',
      website: 'pending',
    }));

    setRecords(newRecords);
    setIsRunning(true);
    setIsPaused(false);
    setElapsedSeconds(0);
    setActiveFilter('all');

    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    const runner = new DomainQueueRunner({
      concurrency,
      timeoutMs,
      onUpdate: handleRecordUpdate,
      onFinish: () => {
        setIsRunning(false);
        setIsPaused(false);
        setActiveWorkers(0);
        stopTimer();
      },
    });

    runnerRef.current = runner;
    runner.start(newRecords);
  };

  const handlePause = () => {
    if (runnerRef.current) {
      runnerRef.current.pause();
      setIsPaused(true);
      stopTimer();
    }
  };

  const handleResume = () => {
    if (runnerRef.current) {
      runnerRef.current.resume();
      setIsPaused(false);
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
  };

  const handleCancel = () => {
    if (runnerRef.current) {
      runnerRef.current.cancel();
    }
    setIsRunning(false);
    setIsPaused(false);
    setActiveWorkers(0);
    stopTimer();
  };

  // Re-check single domain
  const handleRecheckDomain = async (record: DomainRecord) => {
    setRecords((prev) =>
      prev.map((r) =>
        r.id === record.id
          ? { ...r, status: 'checking', ssl: 'checking', website: 'checking' }
          : r
      )
    );

    const result = await checkSingleDomain(record.domain, 12000);

    setRecords((prev) =>
      prev.map((r) =>
        r.id === record.id
          ? {
              ...r,
              status: 'completed',
              registeredOn: result.registeredOn,
              updatedOn: result.updatedOn,
              ssl: result.ssl,
              website: result.website,
              websiteReason: result.websiteReason,
              dnsResolves: result.dnsResolves,
              registrar: result.registrar,
              expiresOn: result.expiresOn,
              nameservers: result.nameservers,
              whoisUrl: result.whoisUrl,
              durationMs: result.durationMs,
              error: result.error,
              checkedAt: new Date().toLocaleTimeString(),
            }
          : r
      )
    );
  };

  // Re-check all failed domains
  const handleRecheckFailed = () => {
    if (isRunning) return;

    const failedItems = records.filter(
      (r) => r.status === 'completed' && (r.ssl === 'no' || r.website === 'no' || r.website === '?')
    );
    if (failedItems.length === 0) return;

    const failedIds = new Set(failedItems.map((f) => f.id));
    const updatedRecords = records.map((r) =>
      failedIds.has(r.id)
        ? {
            ...r,
            status: 'pending' as const,
            ssl: 'pending' as const,
            website: 'pending' as const,
          }
        : r
    );

    setRecords(updatedRecords);
    setIsRunning(true);
    setIsPaused(false);
    setElapsedSeconds(0);

    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    const runner = new DomainQueueRunner({
      concurrency: 4,
      timeoutMs: 12000,
      onUpdate: handleRecordUpdate,
      onFinish: () => {
        setIsRunning(false);
        setIsPaused(false);
        setActiveWorkers(0);
        stopTimer();
      },
    });

    runnerRef.current = runner;
    runner.start(updatedRecords.filter((r) => failedIds.has(r.id)));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-900">
      {/* Header */}
      <Header onOpenHelp={() => setShowHelp(true)} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Input Card */}
        <DomainInput
          onStartCheck={handleStartCheck}
          isRunning={isRunning}
        />

        {/* Live Progress Bar */}
        {(isRunning || records.length > 0) && (
          <ProgressBar
            total={summary.total}
            completed={summary.completed}
            activeCount={activeWorkers}
            isRunning={isRunning}
            isPaused={isPaused}
            elapsedSeconds={elapsedSeconds}
            onPause={handlePause}
            onResume={handleResume}
            onCancel={handleCancel}
          />
        )}

        {/* Summary Cards */}
        {records.length > 0 && (
          <SummaryCards
            summary={summary}
            activeFilter={activeFilter}
            onSelectFilter={setActiveFilter}
          />
        )}

        {/* Results Table */}
        <ResultsTable
          records={records}
          activeFilter={activeFilter}
          onSelectFilter={setActiveFilter}
          onRecheckDomain={handleRecheckDomain}
          onRecheckFailed={handleRecheckFailed}
          onSelectRecord={setSelectedRecord}
          isRunning={isRunning}
        />
      </main>

      {/* Detail Modal */}
      <DetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onRecheck={handleRecheckDomain}
      />

      {/* Help Modal */}
      <HelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />

      {/* Clean Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-4 text-center text-xs text-slate-500">
        <p>
          Domain Checker Pro • 100% Client-Side • RDAP WHOIS, Browser SSL Handshake & Content Analysis
        </p>
      </footer>
    </div>
  );
}
