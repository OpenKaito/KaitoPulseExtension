import { api } from '@/lib/api';
import type { GetTradingSummaryResponse } from '@/shared/messages';
import { createLogger } from '@/signal/logger';
import { toAuthedError } from './authed-error';
import { authedCall } from './worker-core';

const logger = createLogger('trading');

export async function handleGetTradingSummary(): Promise<GetTradingSummaryResponse> {
  try {
    const result = await authedCall((token) => api.getTradingSummary(token));
    return { result };
  } catch (error) {
    logger.error('getTradingSummary error', error);
    return toAuthedError(error, 'trading summary fetch failed');
  }
}
