/**
 * Keeps a local copy of the sheet and an outbox of changes waiting to be sent.
 *
 *  confirmed  what the sheet last said (getAll, plus answers to sent changes)
 *  outbox     changes not yet confirmed, oldest first
 *  view       confirmed with the outbox applied on top: what the screens show
 *
 * Changes are sent one at a time, in order. Because ids come from the app,
 * sending the same change twice updates the same row, so retries are safe.
 * Plain TypeScript (no React) so it can be tested directly.
 */
import { ApiError, type AllData, type Api } from '../api/types';
import { applyOp, applyResult, emptyData, sendOp, type Op } from './ops';
import type { KeyValueStore } from './storage';

export const SYNC_KEYS = {
  cache: 'ct.cache',
  outbox: 'ct.outbox',
  failed: 'ct.failed',
} as const;

export const RETRY_BASE_MS = 2_000;
export const RETRY_MAX_MS = 60_000;

export interface OutboxItem {
  /** Local sequence number, for keys and tests. */
  seq: number;
  op: Op;
  attempts: number;
}

export interface FailedItem extends OutboxItem {
  message: string;
}

export type SyncStatus =
  | { kind: 'synced' }
  | { kind: 'pending'; count: number }
  | { kind: 'offline'; count: number }
  | { kind: 'error'; count: number; message: string };

export interface SyncSnapshot {
  /** null until the first load (from cache or the sheet). */
  data: AllData | null;
  status: SyncStatus;
  loading: boolean;
  lastSyncedAt: number | null;
  failed: FailedItem[];
}

export interface SyncEngineOptions {
  api: Api;
  store: KeyValueStore;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export function retryDelay(attempts: number): number {
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1));
}

/** Errors that will never succeed by retrying the same change. */
function isPermanent(e: unknown): e is ApiError {
  return e instanceof ApiError && (e.code === 'BAD_INPUT' || e.code === 'NOT_FOUND');
}

function readJson<T>(store: KeyValueStore, key: string, fallback: T): T {
  const raw = store.get(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export class SyncEngine {
  private api: Api;
  private store: KeyValueStore;
  private now: () => number;
  private setTimer: (fn: () => void, ms: number) => unknown;
  private clearTimer: (handle: unknown) => void;

  private confirmed: AllData | null;
  private outbox: OutboxItem[];
  private failed: FailedItem[];
  private seq: number;
  private offline = false;
  private serverError = '';
  private loading = false;
  private lastSyncedAt: number | null = null;
  private retryHandle: unknown = null;
  private chain: Promise<unknown> = Promise.resolve();
  private flushQueued = false;
  private listeners = new Set<() => void>();
  private snapshot: SyncSnapshot;

  constructor(opts: SyncEngineOptions) {
    this.api = opts.api;
    this.store = opts.store;
    this.now = opts.now ?? Date.now;
    this.setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));

    const cache = readJson<{ data: AllData; at: number } | null>(this.store, SYNC_KEYS.cache, null);
    this.confirmed = cache?.data ?? null;
    this.lastSyncedAt = cache?.at ?? null;
    this.outbox = readJson<OutboxItem[]>(this.store, SYNC_KEYS.outbox, []);
    this.failed = readJson<FailedItem[]>(this.store, SYNC_KEYS.failed, []);
    this.seq = Math.max(0, ...this.outbox.map((i) => i.seq), ...this.failed.map((i) => i.seq));
    this.snapshot = this.buildSnapshot();
  }

  /* ---------- reading ---------- */

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  getSnapshot = (): SyncSnapshot => this.snapshot;

  pendingOps(): Op[] {
    return this.outbox.map((i) => i.op);
  }

  private buildSnapshot(): SyncSnapshot {
    let data: AllData | null = this.confirmed;
    if (data || this.outbox.length) {
      data = this.outbox.reduce((d, item) => applyOp(d, item.op), data ?? emptyData());
    }
    return {
      data,
      status: this.status(),
      loading: this.loading,
      lastSyncedAt: this.lastSyncedAt,
      failed: this.failed,
    };
  }

  private status(): SyncStatus {
    const count = this.outbox.length;
    if (this.failed.length) {
      return { kind: 'error', count, message: this.failed[this.failed.length - 1].message };
    }
    if (this.serverError) return { kind: 'error', count, message: this.serverError };
    if (this.offline) return { kind: 'offline', count };
    if (count) return { kind: 'pending', count };
    return { kind: 'synced' };
  }

  private changed(): void {
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((fn) => fn());
  }

  private persist(): void {
    if (this.confirmed) this.store.set(SYNC_KEYS.cache, JSON.stringify({ data: this.confirmed, at: this.lastSyncedAt }));
    this.store.set(SYNC_KEYS.outbox, JSON.stringify(this.outbox));
    this.store.set(SYNC_KEYS.failed, JSON.stringify(this.failed));
  }

  /** Runs tasks one at a time, so a reload never races a send. */
  private serial<T>(task: () => Promise<T>): Promise<T> {
    const next = this.chain.then(task, task);
    this.chain = next.catch(() => undefined);
    return next;
  }

  /* ---------- writing ---------- */

  /** Applies a change on screen now and queues it for the sheet. */
  enqueue(op: Op): void {
    this.seq += 1;
    this.outbox.push({ seq: this.seq, op, attempts: 0 });
    this.persist();
    this.changed();
    void this.flush();
  }

  /** Sends queued changes, oldest first. Stops at the first one that can't go yet. */
  flush(): Promise<void> {
    if (this.flushQueued) return this.chain.then(() => undefined);
    this.flushQueued = true;
    return this.serial(async () => {
      this.flushQueued = false;
      await this.sendAll();
    });
  }

  private async sendAll(): Promise<void> {
    if (this.retryHandle !== null) {
      this.clearTimer(this.retryHandle);
      this.retryHandle = null;
    }
    while (this.outbox.length) {
      const item = this.outbox[0];
      try {
        const result = await sendOp(this.api, item.op);
        this.outbox.shift();
        this.confirmed = applyResult(this.confirmed ?? emptyData(), result);
        this.offline = false;
        this.serverError = '';
        this.persist();
        this.changed();
      } catch (e) {
        if (isPermanent(e)) {
          // The sheet refused this change; keep it aside so it can be shown, and carry on with the rest.
          this.outbox.shift();
          this.failed.push({ ...item, message: e.message });
          this.persist();
          this.changed();
          continue;
        }
        item.attempts += 1;
        if (e instanceof ApiError && e.code === 'AUTH') {
          // Sign-in expired: the app shows the sign-in screen; we resume after signing in.
          this.persist();
          this.changed();
          return;
        }
        if (e instanceof ApiError && e.code === 'SERVER') {
          this.serverError = e.message;
        } else {
          this.offline = true;
        }
        this.persist();
        this.changed();
        this.retryHandle = this.setTimer(() => {
          this.retryHandle = null;
          void this.flush();
        }, retryDelay(item.attempts));
        return;
      }
    }
  }

  /**
   * Sends anything waiting, then reloads everything from the sheet.
   * If changes are still waiting (offline), keeps the local copy instead.
   */
  refresh(): Promise<void> {
    this.loading = true;
    this.changed();
    return this.serial(async () => {
      try {
        await this.sendAll();
        if (this.outbox.length) return;
        try {
          const data = await this.api.getAll();
          this.confirmed = data;
          this.lastSyncedAt = this.now();
          this.offline = false;
          this.serverError = '';
          this.persist();
        } catch (e) {
          if (e instanceof ApiError && e.code === 'SERVER') this.serverError = e.message;
          else if (!(e instanceof ApiError && e.code === 'AUTH')) this.offline = true;
        }
      } finally {
        this.loading = false;
        this.changed();
      }
    });
  }

  /** Forgets changes the sheet refused (after the coach has seen the message). */
  dismissFailed(): void {
    this.failed = [];
    this.persist();
    this.changed();
  }

  /** Signing out: forget the local copy and anything waiting. */
  clear(): void {
    if (this.retryHandle !== null) this.clearTimer(this.retryHandle);
    this.retryHandle = null;
    this.confirmed = null;
    this.outbox = [];
    this.failed = [];
    this.offline = false;
    this.serverError = '';
    this.lastSyncedAt = null;
    Object.values(SYNC_KEYS).forEach((k) => this.store.remove(k));
    this.changed();
  }
}
