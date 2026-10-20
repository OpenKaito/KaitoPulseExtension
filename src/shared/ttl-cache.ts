export interface TtlCacheEntry<T> {
  v: T | null;
  t: number;
}

export type TtlCacheMap<T> = Record<string, TtlCacheEntry<T>>;

export interface TtlCachePolicy<T> {
  positiveTtlMs: number;
  negativeTtlMs: number;
  maxEntries: number;
  isComplete?: (value: T) => boolean;
}

function entryTtlMs<T>(entry: TtlCacheEntry<T>, policy: TtlCachePolicy<T>): number {
  if (entry.v === null) return policy.negativeTtlMs;
  if (policy.isComplete && !policy.isComplete(entry.v)) return policy.negativeTtlMs;
  return policy.positiveTtlMs;
}

function isFresh<T>(entry: TtlCacheEntry<T>, now: number, policy: TtlCachePolicy<T>): boolean {
  return now >= entry.t && now - entry.t < entryTtlMs(entry, policy);
}

export interface TtlSplitResult<T> {
  hits: Record<string, T | null>;
  misses: string[];
}

export function splitFresh<T>(
  map: TtlCacheMap<T>,
  ids: readonly string[],
  now: number,
  policy: TtlCachePolicy<T>,
): TtlSplitResult<T> {
  const hits: Record<string, T | null> = {};
  const misses: string[] = [];
  for (const id of ids) {
    const entry = map[id];
    if (entry && isFresh(entry, now, policy)) {
      hits[id] = entry.v;
    } else {
      misses.push(id);
    }
  }
  return { hits, misses };
}

export function mergeEntries<T>(
  map: TtlCacheMap<T>,
  updates: Record<string, T | null>,
  now: number,
  policy: TtlCachePolicy<T>,
): TtlCacheMap<T> {
  const next: TtlCacheMap<T> = {};
  for (const [id, entry] of Object.entries(map)) {
    if (isFresh(entry, now, policy)) next[id] = entry;
  }
  for (const [id, value] of Object.entries(updates)) {
    next[id] = { v: value, t: now };
  }

  const ids = Object.keys(next);
  if (ids.length > policy.maxEntries) {
    ids.sort((a, b) => next[a].t - next[b].t);
    const evictCount = ids.length - policy.maxEntries;
    for (const id of ids.slice(0, evictCount)) {
      delete next[id];
    }
  }
  return next;
}

export function removeEntry<T>(map: TtlCacheMap<T>, id: string): TtlCacheMap<T> {
  if (!(id in map)) return map;
  const { [id]: _removed, ...rest } = map;
  return rest;
}
