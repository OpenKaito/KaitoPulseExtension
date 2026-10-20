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

const BADGE_POLICY: TtlCachePolicy<BadgeItem> = {
  positiveTtlMs: 30 * 60_000,
  negativeTtlMs: 10 * 60_000,
  maxEntries: 1500,
  isComplete: (badge) => badge.smartFollowers != null,
};

const AD_FLAG_POLICY: TtlCachePolicy<AdFlagQueryItem> = {
  positiveTtlMs: 30 * 60_000,
  negativeTtlMs: 10 * 60_000,
  maxEntries: 1500,
};

const badgesPausedUntilItem = storage.defineItem<number>('session:kaito.badges.pausedUntil', {
  fallback: 0,
});

const BADGES_PROBE_MS = 60_000;

export type BadgesFetchClaim = { allowed: false } | { allowed: true; probe?: number };

export function claimBadgesFetch(): Promise<BadgesFetchClaim> {
  return serialize('badgesPause', async () => {
    const until = await badgesPausedUntilItem.getValue();
    const now = Date.now();
    if (now < until) return { allowed: false };
    if (until === 0) return { allowed: true };
    const probe = now + BADGES_PROBE_MS;
    await badgesPausedUntilItem.setValue(probe);
    return { allowed: true, probe };
  });
}

export function releaseBadgesProbe(probe: number): Promise<void> {
  return serialize('badgesPause', async () => {
    if ((await badgesPausedUntilItem.getValue()) === probe) {
      await badgesPausedUntilItem.setValue(0);
    }
  });
}

export function pauseBadgesUntil(
  until: number,
  stillCurrent: () => Promise<boolean>,
): Promise<void> {
  return serialize('badgesPause', async () => {
    if (!(await stillCurrent())) return;
    if (until > (await badgesPausedUntilItem.getValue())) {
      await badgesPausedUntilItem.setValue(until);
    }
  });
}

const badgeCacheItem = storage.defineItem<TtlCacheMap<BadgeItem>>('session:kaito.cache.badges', {
  fallback: {},
});

const adFlagCacheItem = storage.defineItem<TtlCacheMap<AdFlagQueryItem>>(
  'session:kaito.cache.adFlags',
  { fallback: {} },
);

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
  const updates: Record<string, T | null> = {};
  for (const id of misses) {
    updates[id] = fetched[id] ?? null;
  }
  await serialize(cache.key, async () => {
    const latest = await cache.item.getValue();
    await cache.item.setValue(mergeEntries(latest, updates, Date.now(), cache.policy));
  }).catch((error) => {
    logDev(`edge-cache write failed (${cache.key})`, error);
  });
  return { ...hits, ...updates };
}

export async function cachedBadgesIgnoringTtl(
  twitterIds: readonly string[],
): Promise<Record<string, BadgeItem | null>> {
  const map = await badgeCacheItem.getValue();
  const items: Record<string, BadgeItem | null> = {};
  for (const id of twitterIds) {
    if (map[id]) items[id] = map[id].v;
  }
  return items;
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

export function setCachedAdFlag(tweetId: string, item: AdFlagQueryItem): Promise<void> {
  return serialize(AD_FLAG_CACHE.key, async () => {
    const latest = await adFlagCacheItem.getValue();
    await adFlagCacheItem.setValue(
      mergeEntries(latest, { [tweetId]: item }, Date.now(), AD_FLAG_POLICY),
    );
  });
}

export function invalidateBadge(twitterId: string): Promise<void> {
  return serialize(BADGE_CACHE.key, async () => {
    const latest = await badgeCacheItem.getValue();
    const next = removeEntry(latest, twitterId);
    if (next !== latest) await badgeCacheItem.setValue(next);
  });
}

export async function clearEdgeCaches(): Promise<void> {
  await Promise.all([
    serialize(BADGE_CACHE.key, () => badgeCacheItem.setValue({})),
    serialize(AD_FLAG_CACHE.key, () => adFlagCacheItem.setValue({})),
    serialize('badgesPause', () => badgesPausedUntilItem.setValue(0)),
  ]);
}
