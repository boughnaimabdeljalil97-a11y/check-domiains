import { DomainRecord } from '../types/domain';
import { checkSingleDomain } from './checker';

export interface QueueOptions {
  concurrency?: number;
  timeoutMs?: number;
  onUpdate: (updatedRecord: DomainRecord) => void;
  onFinish?: () => void;
}

export class DomainQueueRunner {
  private queue: DomainRecord[] = [];
  private concurrency: number;
  private timeoutMs: number;
  private onUpdate: (updatedRecord: DomainRecord) => void;
  private onFinish?: () => void;
  private activeCount: number = 0;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private abortController: AbortController | null = null;
  private processedIds: Set<string> = new Set();

  constructor(options: QueueOptions) {
    this.concurrency = options.concurrency || 4;
    this.timeoutMs = options.timeoutMs || 12000;
    this.onUpdate = options.onUpdate;
    this.onFinish = options.onFinish;
  }

  public start(records: DomainRecord[]) {
    this.abortController = new AbortController();
    this.isRunning = true;
    this.isPaused = false;
    this.processedIds.clear();

    // Only queue items that need checking
    this.queue = [...records.filter(r => r.status === 'pending' || r.status === 'checking')];

    // Spawn concurrent workers
    for (let i = 0; i < this.concurrency; i++) {
      this.spawnWorker();
    }
  }

  public pause() {
    this.isPaused = true;
  }

  public resume() {
    if (!this.isRunning) return;
    this.isPaused = false;
    // Wake up workers
    while (this.activeCount < this.concurrency && this.queue.length > 0) {
      this.spawnWorker();
    }
  }

  public cancel() {
    this.isRunning = false;
    this.isPaused = false;
    if (this.abortController) {
      this.abortController.abort();
    }
    // Mark remaining in queue as cancelled
    for (const record of this.queue) {
      this.onUpdate({
        ...record,
        status: 'cancelled',
      });
    }
    this.queue = [];
    if (this.onFinish) this.onFinish();
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      activeCount: this.activeCount,
      remainingCount: this.queue.length,
    };
  }

  private async spawnWorker() {
    if (!this.isRunning || this.isPaused) return;
    if (this.queue.length === 0) {
      if (this.activeCount === 0) {
        this.isRunning = false;
        if (this.onFinish) this.onFinish();
      }
      return;
    }

    const currentRecord = this.queue.shift();
    if (!currentRecord) return;

    this.activeCount++;

    // Notify record is checking
    this.onUpdate({
      ...currentRecord,
      status: 'checking',
      ssl: 'checking',
      website: 'checking',
    });

    try {
      const result = await checkSingleDomain(
        currentRecord.domain,
        this.timeoutMs,
        this.abortController?.signal
      );

      const completedRecord: DomainRecord = {
        ...currentRecord,
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
      };

      this.processedIds.add(currentRecord.id);
      this.onUpdate(completedRecord);
    } catch (err: any) {
      // Safe fallback: never stops execution
      this.onUpdate({
        ...currentRecord,
        status: 'error',
        registeredOn: 'no data',
        updatedOn: 'no data',
        ssl: 'no',
        website: 'no',
        error: err?.message || 'Error checking domain',
        checkedAt: new Date().toLocaleTimeString(),
      });
    } finally {
      this.activeCount--;
      // Spawn next work item if not paused/stopped
      if (this.isRunning && !this.isPaused) {
        this.spawnWorker();
      } else if (this.activeCount === 0 && this.queue.length === 0) {
        this.isRunning = false;
        if (this.onFinish) this.onFinish();
      }
    }
  }
}
