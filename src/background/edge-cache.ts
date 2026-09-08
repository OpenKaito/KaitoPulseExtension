import { storage } from 'wxt/utils/storage';
import { logDev } from '@/lib/env';
import type { AdFlagQueryItem } from '@/shared/ad-flag';
import type { BadgeItem } from '@/shared/social-card';
import {
  mergeEntries,
  removeEntry,
  splitFresh,
  type TtlCacheMap,
  type TtlCachePolicy,
} from '@/shared/ttl-cache';

/**
 * Background-only L2 cache for the two hottest per-item lookups the content
 * scripts fan out (badges by author, ad-flags by tweet). The signal layer's
 * per-tab SwrCache stays as L1; this layer survives MV3 service-worker
 * restarts and is shared across tabs, which is where most duplicate origin
 * requests come from. `session:` storage is background-only by default and
 * clears on browser restart, so entries can never outlive a browser session.
 */

const BADGE_POLICY: TtlCachePolicy<BadgeItem> = {
  positiveTtlMs: 30 * 60_000,
  // null = author has no badge (most of the timeline); incomplete = server
  // still backfilling smartFollowers. Both retry sooner than full items.
  negativeTtlMs: 10 * 60_000,
  maxEntries: 1500,
  isComplete: (badge) => badge.smartFollowers != null,
};

const AD_FLAG_POLICY: TtlCachePolicy<AdFlagQueryItem> = {
  positiveTtlMs: 30 * 60_000,
  negativeTtlMs: 10 * 60_000,
  maxEntries: 1500,
};

const badgeCacheItem = storage.defineItem<TtlCacheMap<BadgeItem>>('session:kaito.cache.badges', {
  fallback: {},
});

// Entries carry the viewer's own my_reason, so this cache must be cleared on
// any session change (see clearEdgeCaches callers in worker-core).
const adFlagCacheItem = storage.defineItem<TtlCacheMap<AdFlagQueryItem>>(
  'session:kaito.cache.adFlags',
  { fallback: {} },
);

// Serialize read-modify-write per cache so concurrent handler calls in one
// service-worker lifetime cannot drop each other's writes.
const writeQueues = new Map<string, Promise<unknown>>();
function serialize<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = writeQueues.get(key) ?? Promise.resolve();
  const next = previous.then(task, task);
  writeQueues.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}

interface EdgeCacheConfig<T> {
  key: string;
  item: { getValue(): Promise<TtlCacheMap<T>>; setValue(map: TtlCacheMap<T>): Promise<void> };
  policy: TtlCachePolicy<T>;
}

const BADGE_CACHE: EdgeCacheConfig<BadgeItem> = {
  key: 'badges',
  item: badgeCacheItem,
  policy: BADGE_POLICY,
};

const AD_FLAG_CACHE: EdgeCacheConfig<AdFlagQueryItem> = {
  key: 'adFlags',
  item: adFlagCacheItem,
  policy: AD_FLAG_POLICY,
};

async function cachedBatchFetch<T>(
  cache: EdgeCacheConfig<T>,
  ids: readonly string[],
  fetchMisses: (missIds: string[]) => Promise<Record<string, T | null>>,
): Promise<Record<string, T | null>> {
  const map = await cache.item.getValue();
  const { hits, misses } = splitFresh(map, ids, Date.now(), cache.policy);
  if (misses.length === 0) return hits;

  const fetched = await fetchMisses(misses);
  // Stamp every requested miss so "no data" answers negative-cache too.
  const updates: Record<string, T | null> = {};
  for (const id of misses) {
    updates[id] = fetched[id] ?? null;
  }
  // Best-effort: a failed cache write must not fail the fetch itself.
  await serialize(cache.key, async () => {
    const latest = await cache.item.getValue();
    await cache.item.setValue(mergeEntries(latest, updates, Date.now(), cache.policy));
  }).catch((error) => {
    logDev(`edge-cache write failed (${cache.key})`, error);
  });
  return { ...hits, ...updates };
}

export function cachedFetchBadges(
  twitterIds: readonly string[],
  fetchMisses: (missIds: string[]) => Promise<Record<string, BadgeItem | null>>,
): Promise<Record<string, BadgeItem | null>> {
  return cachedBatchFetch(BADGE_CACHE, twitterIds, fetchMisses);
}

export function cachedFetchAdFlags(
  tweetIds: readonly string[],
  fetchMisses: (missIds: string[]) => Promise<Record<string, AdFlagQueryItem | null>>,
): Promise<Record<string, AdFlagQueryItem | null>> {
  return cachedBatchFetch(AD_FLAG_CACHE, tweetIds, fetchMisses);
}

/** Write-through after a successful ad-flag put/remove. */
export function setCachedAdFlag(tweetId: string, item: AdFlagQueryItem): Promise<void> {
  return serialize(AD_FLAG_CACHE.key, async () => {
    const latest = await adFlagCacheItem.getValue();
    await adFlagCacheItem.setValue(
      mergeEntries(latest, { [tweetId]: item }, Date.now(), AD_FLAG_POLICY),
    );
  });
}

/** Drop one author's badge (e.g. the signed-in user after a fresh proof). */
export function invalidateBadge(twitterId: string): Promise<void> {
  return serialize(BADGE_CACHE.key, async () => {
    const latest = await badgeCacheItem.getValue();
    const next = removeEntry(latest, twitterId);
    if (next !== latest) await badgeCacheItem.setValue(next);
  });
}

/** Sign-in/sign-out: ad-flag entries embed the viewer's my_reason. */
export async function clearEdgeCaches(): Promise<void> {
  await Promise.all([
    serialize(BADGE_CACHE.key, () => badgeCacheItem.setValue({})),
    serialize(AD_FLAG_CACHE.key, () => adFlagCacheItem.setValue({})),
  ]);
}
