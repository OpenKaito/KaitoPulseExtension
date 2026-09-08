export interface OccurrenceCacheIdentity {
  cashtag: string;
  tweetId?: string;
  authorId?: string;
  entityHint?: string;
  authorHandle?: string;
}

type SerializedOccurrence = [string, string | null, string | null, string | null, string | null];

export function toOccurrenceCacheKey(occurrence: OccurrenceCacheIdentity): string {
  return JSON.stringify([
    occurrence.cashtag,
    occurrence.tweetId ?? null,
    occurrence.authorId ?? null,
    occurrence.entityHint ?? null,
    occurrence.authorHandle ?? null,
  ] satisfies SerializedOccurrence);
}

export function fromOccurrenceCacheKey(key: string): OccurrenceCacheIdentity {
  const value: unknown = JSON.parse(key);
  if (!Array.isArray(value) || value.length !== 5 || typeof value[0] !== 'string') {
    throw new Error('invalid ticker occurrence cache key');
  }
  const [, ...optional] = value;
  if (optional.some((item) => item !== null && typeof item !== 'string')) {
    throw new Error('invalid ticker occurrence cache key fields');
  }
  const [cashtag, tweetId, authorId, entityHint, authorHandle] = value as SerializedOccurrence;
  return {
    cashtag,
    ...(tweetId ? { tweetId } : {}),
    ...(authorId ? { authorId } : {}),
    ...(entityHint ? { entityHint } : {}),
    ...(authorHandle ? { authorHandle } : {}),
  };
}

export function toOccurrenceResponseKey(cashtag: string, tweetId?: string | null): string {
  return JSON.stringify([cashtag, tweetId ?? null]);
}

/**
 * BFF currently echoes only `(cashtag, tweetId)`. If one batch contains different evidence
 * under that same response identity, the client cannot safely map either result back to its
 * anchor. Mark the whole response key as conflicting so the caller can fail closed.
 */
export function conflictingOccurrenceResponseKeys(
  occurrences: OccurrenceCacheIdentity[],
): Set<string> {
  const cacheKeysByResponse = new Map<string, Set<string>>();
  for (const occurrence of occurrences) {
    const responseKey = toOccurrenceResponseKey(occurrence.cashtag, occurrence.tweetId);
    const cacheKeys = cacheKeysByResponse.get(responseKey) ?? new Set<string>();
    cacheKeys.add(toOccurrenceCacheKey(occurrence));
    cacheKeysByResponse.set(responseKey, cacheKeys);
  }

  return new Set(
    [...cacheKeysByResponse.entries()]
      .filter(([, cacheKeys]) => cacheKeys.size > 1)
      .map(([responseKey]) => responseKey),
  );
}
