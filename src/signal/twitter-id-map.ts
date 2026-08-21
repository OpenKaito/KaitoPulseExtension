import { createLogger } from './logger';
import { TID_MAP_MESSAGE, type TidMapMessage } from './graphql-id-extractor';

const logger = createLogger('tid-map');

const RESOLVE_TIMEOUT_MS = 4_000;
const ID_RE = /^\d{1,32}$/;

function normalize(handle: string): string {
  return handle.replace(/^@/, '').toLowerCase();
}

class TwitterIdMap {
  private readonly map = new Map<string, string>();
  private readonly waiters = new Map<string, Array<(id: string | null) => void>>();
  private listening = false;
  private readonly onMessage = (event: MessageEvent): void => this.handleMessage(event);

  get size(): number {
    return this.map.size;
  }

  start(): void {
    if (this.listening) return;
    window.addEventListener('message', this.onMessage);
    this.listening = true;
  }

  stop(): void {
    if (!this.listening) return;
    window.removeEventListener('message', this.onMessage);
    this.listening = false;
    for (const list of this.waiters.values()) {
      for (const resolve of list) resolve(null);
    }
    this.waiters.clear();
  }

  resolve(handle: string): string | null {
    return this.map.get(normalize(handle)) ?? null;
  }

  resolveAsync(handle: string, timeoutMs = RESOLVE_TIMEOUT_MS): Promise<string | null> {
    const key = normalize(handle);
    if (!key) return Promise.resolve(null);
    const known = this.map.get(key);
    if (known) return Promise.resolve(known);
    if (!this.listening) return Promise.resolve(null);

    return new Promise((resolve) => {
      const settle = (id: string | null): void => {
        clearTimeout(timer);
        resolve(id);
      };
      const timer = setTimeout(() => {
        this.removeWaiter(key, settle);
        resolve(null);
      }, timeoutMs);
      const list = this.waiters.get(key);
      if (list) list.push(settle);
      else this.waiters.set(key, [settle]);
    });
  }

  private handleMessage(event: MessageEvent): void {

    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;

    const data = event.data as Partial<TidMapMessage> | null;
    if (!data || data.source !== TID_MAP_MESSAGE || !Array.isArray(data.pairs)) return;

    let learned = 0;
    for (const pair of data.pairs) {
      if (!pair || typeof pair.handle !== 'string' || typeof pair.id !== 'string') continue;
      const key = normalize(pair.handle);
      if (!key || !ID_RE.test(pair.id)) continue;
      const existed = this.map.get(key);
      this.map.set(key, pair.id);
      if (existed !== pair.id) learned++;
      if (!existed) this.flushWaiters(key, pair.id);
    }
    if (learned > 0) logger.log(`learned ${learned} handle→id pair(s); map size=${this.map.size}`);
  }

  private flushWaiters(key: string, id: string): void {
    const list = this.waiters.get(key);
    if (!list) return;
    this.waiters.delete(key);
    for (const resolve of list) resolve(id);
  }

  private removeWaiter(key: string, fn: (id: string | null) => void): void {
    const list = this.waiters.get(key);
    if (!list) return;
    const index = list.indexOf(fn);
    if (index >= 0) list.splice(index, 1);
    if (list.length === 0) this.waiters.delete(key);
  }
}

export const twitterIdMap = new TwitterIdMap();
