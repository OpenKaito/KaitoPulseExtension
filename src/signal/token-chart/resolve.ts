import type { CashtagOccurrence, ResolvedTicker } from '@/shared/ticker-resolve';
import { sendKaitoMessage } from '../messaging';
import { SwrCache } from '../swr-cache';
import { SIGNAL_CONFIG } from '../config';
import { createLogger } from '../logger';
import {
  conflictingOccurrenceResponseKeys,
  fromOccurrenceCacheKey,
  toOccurrenceCacheKey,
  toOccurrenceResponseKey,
} from './occurrence-key';

const WINDOW_MS = 250;
const MAX_BATCH = 50;
const logger = createLogger('ticker-resolve');

const cache = new SwrCache<ResolvedTicker>({
  freshTtl: SIGNAL_CONFIG.cacheFreshTtlMs,
  negativeTtl: SIGNAL_CONFIG.cacheNegativeTtlMs,
  errorBackoff: SIGNAL_CONFIG.cacheErrorBackoffMs,
  maxEntries: SIGNAL_CONFIG.cacheMaxEntries,
  batchWindowMs: WINDOW_MS,
  maxBatch: MAX_BATCH,
  label: 'ticker-resolve',
  fetchKeys: async (keys) => {
    const occurrences: CashtagOccurrence[] = keys.map(fromOccurrenceCacheKey);
    const conflictingResponseKeys = conflictingOccurrenceResponseKeys(occurrences);
    const safeOccurrences = occurrences.filter(
      (occurrence) =>
        !conflictingResponseKeys.has(
          toOccurrenceResponseKey(occurrence.cashtag, occurrence.tweetId),
        ),
    );
    if (conflictingResponseKeys.size > 0) {
      logger.warn(
        `omitting ${conflictingResponseKeys.size} conflicting ticker occurrence response keys`,
      );
    }

    let resolved: ResolvedTicker[] = [];
    if (safeOccurrences.length > 0) {
      const response = await sendKaitoMessage({
        target: 'kaitoExtension',
        action: 'resolveTickers',
        occurrences: safeOccurrences,
      });
      if (response.error) throw new Error(response.error);
      resolved = response.resolved;
    }

    const byOccurrence = new Map(
      resolved.map((item) => [toOccurrenceResponseKey(item.cashtag, item.tweetId), item]),
    );
    const map = new Map<string, ResolvedTicker | null>();
    keys.forEach((key, index) => {
      const occurrence = occurrences[index];
      const responseKey = toOccurrenceResponseKey(occurrence.cashtag, occurrence.tweetId);
      map.set(
        key,
        conflictingResponseKeys.has(responseKey) ? null : (byOccurrence.get(responseKey) ?? null),
      );
    });
    return map;
  },
});

export function resolveTicker(occurrence: CashtagOccurrence): Promise<ResolvedTicker | null> {
  return cache.request(toOccurrenceCacheKey(occurrence));
}
