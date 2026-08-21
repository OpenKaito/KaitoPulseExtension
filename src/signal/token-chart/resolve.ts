import type { CashtagOccurrence, ResolvedTicker } from "@/shared/ticker-resolve";
import { sendKaitoMessage } from "../messaging";
import { SwrCache } from "../swr-cache";
import { SIGNAL_CONFIG } from "../config";

const WINDOW_MS = 250;
const MAX_BATCH = 50;

function occurrenceKey(cashtag: string, tweetId: string | null | undefined): string {
  return `${cashtag}|${tweetId ?? ""}`;
}

function parseKey(key: string): { cashtag: string; tweetId?: string } {
  const sep = key.lastIndexOf("|");
  if (sep < 0) return { cashtag: key };
  const tweetId = key.slice(sep + 1);
  return { cashtag: key.slice(0, sep), tweetId: tweetId || undefined };
}

const MAX_TRACKED_AUTHORS = 500;
const authorByTweet = new Map<string, string>();

export function hasTweetAuthor(tweetId: string): boolean {
  return authorByTweet.has(tweetId);
}

export function rememberTweetAuthor(tweetId: string, authorId: string): void {
  if (!tweetId || !authorId) return;

  authorByTweet.delete(tweetId);
  authorByTweet.set(tweetId, authorId);
  if (authorByTweet.size > MAX_TRACKED_AUTHORS) {
    const oldest = authorByTweet.keys().next().value;
    if (oldest !== undefined) authorByTweet.delete(oldest);
  }
}

const cache = new SwrCache<ResolvedTicker>({
  freshTtl: SIGNAL_CONFIG.cacheFreshTtlMs,
  negativeTtl: SIGNAL_CONFIG.cacheNegativeTtlMs,
  errorBackoff: SIGNAL_CONFIG.cacheErrorBackoffMs,
  maxEntries: SIGNAL_CONFIG.cacheMaxEntries,
  batchWindowMs: WINDOW_MS,
  maxBatch: MAX_BATCH,
  label: "ticker-resolve",
  fetchKeys: async (keys) => {
    const occurrences: CashtagOccurrence[] = keys.map((key) => {
      const { cashtag, tweetId } = parseKey(key);
      const authorId = tweetId ? authorByTweet.get(tweetId) : undefined;
      return { cashtag, ...(tweetId ? { tweetId } : {}), ...(authorId ? { authorId } : {}) };
    });
    const response = await sendKaitoMessage({ target: "kaitoExtension", action: "resolveTickers", occurrences });

    if (response.error) throw new Error(response.error);

    const byOccurrence = new Map(response.resolved.map((r) => [occurrenceKey(r.cashtag, r.tweetId), r]));
    const map = new Map<string, ResolvedTicker | null>();
    for (const key of keys) map.set(key, byOccurrence.get(key) ?? null);
    return map;
  },
});

export function resolveTicker(symbol: string, tweetId?: string | null): Promise<ResolvedTicker | null> {
  return cache.request(occurrenceKey(symbol, tweetId));
}
