import { createLogger } from "./logger";

export interface SwrCacheOptions<V> {

  freshTtl: number;

  negativeTtl: number;

  errorBackoff: number;

  maxEntries: number;

  fetchKeys: (keys: string[]) => Promise<Map<string, V | null>>;

  batchWindowMs?: number;

  maxBatch?: number;

  equals?: (a: V | null, b: V | null) => boolean;

  isComplete?: (value: V) => boolean;

  now?: () => number;

  label?: string;
}

type Subscriber<V> = (value: V | null) => void;

interface Entry<V> {
  value: V | null;
  fetchedAt: number;
  resolved: boolean;
  isError: boolean;
  lastAccess: number;
  inflight?: Promise<unknown>;
  subscribers: Set<Subscriber<V>>;
  waiters: Array<(value: V | null) => void>;
}

export class SwrCache<V> {
  private readonly entries = new Map<string, Entry<V>>();
  private readonly pending = new Set<string>();
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;

  private readonly freshTtl: number;
  private readonly negativeTtl: number;
  private readonly errorBackoff: number;
  private readonly maxEntries: number;
  private readonly fetchKeys: (keys: string[]) => Promise<Map<string, V | null>>;
  private readonly batchWindowMs: number | undefined;
  private readonly maxBatch: number;
  private readonly equals: (a: V | null, b: V | null) => boolean;
  private readonly isComplete: ((value: V) => boolean) | undefined;
  private readonly now: () => number;
  private readonly logger: ReturnType<typeof createLogger>;

  constructor(options: SwrCacheOptions<V>) {
    this.freshTtl = options.freshTtl;
    this.negativeTtl = options.negativeTtl;
    this.errorBackoff = options.errorBackoff;
    this.maxEntries = options.maxEntries;
    this.fetchKeys = options.fetchKeys;
    this.batchWindowMs = options.batchWindowMs;
    this.maxBatch = options.maxBatch ?? 50;
    this.equals = options.equals ?? Object.is;
    this.isComplete = options.isComplete;
    this.now = options.now ?? Date.now;
    this.logger = createLogger(options.label ?? "swr-cache");
  }

  observe(key: string, cb: Subscriber<V>): () => void {
    if (this.disposed) return () => {};
    const entry = this.touch(key);
    entry.subscribers.add(cb);
    if (entry.resolved) {
      const value = entry.value;

      queueMicrotask(() => {
        if (entry.subscribers.has(cb)) cb(value);
      });
    }
    this.maybeRevalidate(key, entry);
    return () => {
      entry.subscribers.delete(cb);
    };
  }

  peek(key: string): V | null | undefined {
    const entry = this.entries.get(key);
    return entry?.resolved ? entry.value : undefined;
  }

  set(key: string, value: V | null): void {
    if (this.disposed) return;
    const entry = this.touch(key);
    const wasResolved = entry.resolved;
    const changed = !wasResolved || !this.equals(entry.value, value);
    entry.value = value;
    entry.fetchedAt = this.now();
    entry.resolved = true;
    entry.isError = false;
    if (entry.waiters.length > 0) {
      const waiters = entry.waiters.splice(0);
      for (const resolve of waiters) resolve(entry.value);
    }
    if (changed) this.notify(entry);
    this.evictIfNeeded();
  }

  request(key: string): Promise<V | null> {
    if (this.disposed) return Promise.resolve(null);
    const entry = this.touch(key);
    this.maybeRevalidate(key, entry);
    if (entry.resolved) return Promise.resolve(entry.value);
    return new Promise<V | null>((resolve) => {
      entry.waiters.push(resolve);
    });
  }

  dispose(): void {
    this.disposed = true;
    if (this.flushTimer !== undefined) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.pending.clear();
    for (const entry of this.entries.values()) {
      for (const resolve of entry.waiters) resolve(null);
      entry.waiters.length = 0;
      entry.subscribers.clear();
    }
    this.entries.clear();
  }

  size(): number {
    return this.entries.size;
  }

  private touch(key: string): Entry<V> {
    const existing = this.entries.get(key);
    if (existing) {
      existing.lastAccess = this.now();
      return existing;
    }
    const entry: Entry<V> = {
      value: null,
      fetchedAt: 0,
      resolved: false,
      isError: false,
      lastAccess: this.now(),
      subscribers: new Set(),
      waiters: [],
    };
    this.entries.set(key, entry);
    return entry;
  }

  private maybeRevalidate(key: string, entry: Entry<V>): void {
    if (this.disposed) return;
    if (entry.inflight || this.pending.has(key)) return;
    if (!entry.resolved) {
      this.scheduleFetch(key);
      return;
    }
    const age = this.now() - entry.fetchedAt;
    if (entry.isError) {
      if (age >= this.errorBackoff) this.scheduleFetch(key);
      return;
    }

    const incomplete =
      entry.value !== null && this.isComplete !== undefined && !this.isComplete(entry.value);
    const ttl = entry.value === null || incomplete ? this.negativeTtl : this.freshTtl;
    if (age >= ttl) this.scheduleFetch(key);
  }

  private scheduleFetch(key: string): void {
    if (this.batchWindowMs === undefined) {
      void this.runFetch([key]);
      return;
    }
    this.pending.add(key);
    if (this.flushTimer === undefined) {
      this.flushTimer = setTimeout(() => this.flush(), this.batchWindowMs);
    }
  }

  private flush(): void {
    this.flushTimer = undefined;
    if (this.disposed || this.pending.size === 0) return;
    const keys = Array.from(this.pending).slice(0, this.maxBatch);
    for (const key of keys) this.pending.delete(key);
    if (this.pending.size > 0 && this.flushTimer === undefined) {
      this.flushTimer = setTimeout(() => this.flush(), this.batchWindowMs);
    }
    void this.runFetch(keys);
  }

  private runFetch(keys: string[]): Promise<void> {
    const fetchPromise = this.fetchKeys(keys);
    for (const key of keys) {
      const entry = this.entries.get(key);
      if (entry) entry.inflight = fetchPromise;
    }
    return fetchPromise.then(
      (map) => {
        for (const key of keys) this.resolveEntry(key, map.get(key) ?? null, false);
      },
      (error) => {
        this.logger.error("fetchKeys failed", error);
        for (const key of keys) this.resolveEntry(key, null, true);
      },
    );
  }

  private resolveEntry(key: string, value: V | null, isError: boolean): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    const wasResolved = entry.resolved;
    entry.inflight = undefined;
    entry.fetchedAt = this.now();
    entry.isError = isError;
    entry.resolved = true;

    if (!isError) {
      const changed = !wasResolved || !this.equals(entry.value, value);
      entry.value = value;
      if (changed) this.notify(entry);
    }

    if (entry.waiters.length > 0) {
      const waiters = entry.waiters.splice(0);
      for (const resolve of waiters) resolve(entry.value);
    }
    this.evictIfNeeded();
  }

  private notify(entry: Entry<V>): void {
    for (const cb of [...entry.subscribers]) {
      try {
        cb(entry.value);
      } catch (error) {
        this.logger.error("subscriber threw; dropping it", error);
        entry.subscribers.delete(cb);
      }
    }
  }

  private evictIfNeeded(): void {
    if (this.entries.size <= this.maxEntries) return;
    const evictable: Array<[string, Entry<V>]> = [];
    for (const pair of this.entries) {
      const e = pair[1];
      if (e.subscribers.size === 0 && e.waiters.length === 0 && !e.inflight) {
        evictable.push(pair);
      }
    }
    evictable.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
    let toEvict = this.entries.size - this.maxEntries;
    for (const [key] of evictable) {
      if (toEvict <= 0) break;
      this.entries.delete(key);
      toEvict--;
    }
  }
}
