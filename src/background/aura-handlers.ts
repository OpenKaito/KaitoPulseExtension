import { api } from '@/lib/api';
import type { GetAuraSummaryResponse } from '@/shared/messages';
import { createLogger } from '@/signal/logger';
import { toAuthedError } from './authed-error';
import { authedCall } from './worker-core';

const logger = createLogger('aura');

export async function handleGetAuraSummary(): Promise<GetAuraSummaryResponse> {
  try {
    const result = await authedCall((token) => api.getAuraSummary(token));
    return { result };
  } catch (error) {
    logger.error('getAuraSummary error', error);
    return toAuthedError(error, 'aura summary fetch failed');
  }
}
