import { getStoredSession } from '@/lib/client-storage';
import { api } from '@/lib/api';
import type { AdFlagQueryItem, AdFlagWriteResult } from '@/shared/ad-flag';
import type { AdFlagQueryMessageResponse, AdFlagWriteResponse } from '@/shared/messages';
import { createLogger } from '@/signal/logger';
import { toAuthedError } from './authed-error';
import { cachedFetchAdFlags, setCachedAdFlag } from './edge-cache';
import { authedCall } from './worker-core';

const logger = createLogger('ad-flag');

function writeThroughCache(tweetId: string, result: AdFlagWriteResult): void {
  const item: AdFlagQueryItem = {
    count: result.count,
    ...(result.reason != null ? { my_reason: result.reason } : {}),
  };
  void setCachedAdFlag(tweetId, item).catch((error) => {
    logger.warn('ad-flag cache write-through failed', error);
  });
}

export async function handlePutAdFlag(
  tweetId: string,
  reason: string,
): Promise<AdFlagWriteResponse> {
  try {
    const result = await authedCall((token) => api.putAdFlag(token, tweetId, reason));
    writeThroughCache(tweetId, result);
    return { result };
  } catch (error) {
    return toWriteError('putAdFlag', error);
  }
}

export async function handleRemoveAdFlag(tweetId: string): Promise<AdFlagWriteResponse> {
  try {
    const result = await authedCall((token) => api.removeAdFlag(token, tweetId));
    writeThroughCache(tweetId, result);
    return { result };
  } catch (error) {
    return toWriteError('removeAdFlag', error);
  }
}

export async function handleQueryAdFlags(tweetIds: string[]): Promise<AdFlagQueryMessageResponse> {
  try {
    const stored = await getStoredSession();
    if (!stored?.sessionToken) {
      return { items: {} };
    }
    const merged = await cachedFetchAdFlags(tweetIds, async (missIds) => {
      const response = await api.queryAdFlags(missIds, stored.sessionToken);
      return response.items;
    });
    // The message contract has no null slot — absent means "no flag"; the
    // cache keeps the nulls internally as negative entries.
    const items: Record<string, AdFlagQueryItem> = {};
    for (const [tweetId, item] of Object.entries(merged)) {
      if (item) items[tweetId] = item;
    }
    return { items };
  } catch (error) {
    logger.error('queryAdFlags error', error);
    return { error: (error as Error)?.message || 'ad-flag query failed' };
  }
}

function toWriteError(action: string, error: unknown): AdFlagWriteResponse {
  logger.error(`${action} error`, error);
  return toAuthedError(error, 'ad-flag write failed');
}
