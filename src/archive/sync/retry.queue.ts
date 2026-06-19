import type { IRetryQueue, RetryItem, RetryQueueStats, SyncChangeSet } from "./sync.types";

const RETRY_STORE_KEY = "sync_retry_queue";
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_INITIAL_BACKOFF_MS = 2000;
const BACKOFF_MULTIPLIER = 2;

function generateRetryId(): string {
  return `retry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export class RetryQueue implements IRetryQueue {
  private items: Map<string, RetryItem> = new Map();
  private maxAttempts: number;
  private initialBackoffMs: number;
  private persist: boolean;

  constructor(options?: { maxAttempts?: number; initialBackoffMs?: number; persist?: boolean }) {
    this.maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.initialBackoffMs = options?.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS;
    this.persist = options?.persist ?? true;
    this.loadFromStorage();
  }

  async enqueue(change: SyncChangeSet, error?: string): Promise<RetryItem> {
    const existing = Array.from(this.items.values()).find(
      (i) => i.change.entityType === change.entityType && i.change.entityId === change.entityId
    );

    if (existing) {
      const updated: RetryItem = {
        ...existing,
        change,
        attempts: existing.attempts,
        lastError: error || existing.lastError,
        nextRetryAt: this.calculateNextRetry(existing.attempts),
        backoffMs: existing.backoffMs * BACKOFF_MULTIPLIER
      };
      this.items.set(existing.id, updated);
      this.saveToStorage();
      return updated;
    }

    const item: RetryItem = {
      id: generateRetryId(),
      change,
      attempts: 0,
      maxAttempts: this.maxAttempts,
      lastError: error,
      nextRetryAt: this.calculateNextRetry(0),
      backoffMs: this.initialBackoffMs
    };

    this.items.set(item.id, item);
    this.saveToStorage();
    return item;
  }

  async dequeue(): Promise<RetryItem | null> {
    const now = Date.now();
    const ready = Array.from(this.items.values())
      .filter((i) => i.nextRetryAt <= now && i.attempts < i.maxAttempts)
      .sort((a, b) => a.nextRetryAt - b.nextRetryAt);

    if (ready.length === 0) return null;

    const item = ready[0];
    const updated: RetryItem = {
      ...item,
      attempts: item.attempts + 1,
      nextRetryAt: this.calculateNextRetry(item.attempts + 1),
      backoffMs: item.backoffMs * BACKOFF_MULTIPLIER
    };

    this.items.set(item.id, updated);
    this.saveToStorage();
    return updated;
  }

  async getRetryable(): Promise<RetryItem[]> {
    const now = Date.now();
    return Array.from(this.items.values())
      .filter((i) => i.attempts < i.maxAttempts)
      .sort((a, b) => a.nextRetryAt - b.nextRetryAt);
  }

  async markSuccess(id: string): Promise<void> {
    this.items.delete(id);
    this.saveToStorage();
  }

  async markFailed(id: string, error: string): Promise<void> {
    const item = this.items.get(id);
    if (!item) return;

    if (item.attempts >= item.maxAttempts) {
      this.items.delete(id);
    } else {
      this.items.set(id, {
        ...item,
        lastError: error
      });
    }
    this.saveToStorage();
  }

  async getStats(): Promise<RetryQueueStats> {
    const all = Array.from(this.items.values());
    return {
      total: all.length,
      pending: all.filter((i) => i.attempts < i.maxAttempts).length,
      failed: all.filter((i) => i.attempts >= i.maxAttempts).length
    };
  }

  async clear(): Promise<void> {
    this.items.clear();
    this.saveToStorage();
  }

  getAll(): RetryItem[] {
    return Array.from(this.items.values());
  }

  getFailed(): RetryItem[] {
    return Array.from(this.items.values()).filter((i) => i.attempts >= i.maxAttempts);
  }

  private calculateNextRetry(attempts: number): number {
    const backoff = this.initialBackoffMs * Math.pow(BACKOFF_MULTIPLIER, attempts);
    const jitter = Math.random() * 1000;
    return Date.now() + backoff + jitter;
  }

  private loadFromStorage(): void {
    if (!this.persist || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(RETRY_STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as RetryItem[];
        this.items = new Map(parsed.map((i) => [i.id, i]));
      }
    } catch (e) {
      console.warn("Failed to load retry queue from storage:", e);
      this.items.clear();
    }
  }

  private saveToStorage(): void {
    if (!this.persist || typeof window === "undefined") return;
    try {
      const data = Array.from(this.items.values());
      window.localStorage.setItem(RETRY_STORE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Failed to persist retry queue:", e);
    }
  }
}

let retryQueueInstance: RetryQueue | null = null;

export function getRetryQueue(): RetryQueue {
  if (!retryQueueInstance) {
    retryQueueInstance = new RetryQueue();
  }
  return retryQueueInstance;
}
