import { getStoredSession } from '@/lib/client-storage';
import { api } from '@/lib/api';
import type { AdFlagQueryMessageResponse, AdFlagWriteResponse } from '@/shared/messages';
import { createLogger } from '@/signal/logger';
import { toAuthedError } from './authed-error';
import { authedCall } from './worker-core';

const logger = createLogger('ad-flag');

export async function handlePutAdFlag(tweetId: string, reason: string): Promise<AdFlagWriteResponse> {
  try {
    const result = await authedCall((token) => api.putAdFlag(token, tweetId, reason));
    return { result };
  } catch (error) {
    return toWriteError('putAdFlag', error);
  }
}

export async function handleRemoveAdFlag(tweetId: string): Promise<AdFlagWriteResponse> {
  try {
    const result = await authedCall((token) => api.removeAdFlag(token, tweetId));
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
    const response = await api.queryAdFlags(tweetIds, stored.sessionToken);
    return { items: response.items };
  } catch (error) {
    logger.error('queryAdFlags error', error);
    return { error: (error as Error)?.message || 'ad-flag query failed' };
  }
}

function toWriteError(action: string, error: unknown): AdFlagWriteResponse {
  logger.error(`${action} error`, error);
  return toAuthedError(error, 'ad-flag write failed');
}
