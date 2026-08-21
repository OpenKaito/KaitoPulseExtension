import { api } from '@/lib/api';
import { TRADING_TOTALS_PUBLIC_KEY } from '@/shared/contracts';
import type { GetTradingTotalsPublicResponse, SetTradingTotalsPublicResponse } from '@/shared/messages';
import { createLogger } from '@/signal/logger';
import { toAuthedError } from './authed-error';
import { authedCall } from './worker-core';

const logger = createLogger('trading-visibility');

export async function handleGetTradingTotalsPublic(): Promise<GetTradingTotalsPublicResponse> {
  try {
    const list = await authedCall((token) => api.getPreferences(token));
    const entry = list.preferences.find((preference) => preference.key === TRADING_TOTALS_PUBLIC_KEY);

    return { enabled: entry?.enabled ?? null };
  } catch (error) {
    logger.error('getTradingTotalsPublic error', error);
    return toAuthedError(error, 'read preferences failed');
  }
}

export async function handleSetTradingTotalsPublic(enabled: boolean): Promise<SetTradingTotalsPublicResponse> {
  try {

    const result = await authedCall((token) => api.putTradingTotalsPublic(token, enabled === true));
    return { result };
  } catch (error) {
    logger.error('setTradingTotalsPublic error', error);
    return toAuthedError(error, 'set preference failed');
  }
}
