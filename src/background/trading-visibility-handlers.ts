import { api } from '@/lib/api';
import {
  TRADING_ACCOUNT_VALUE_PUBLIC_KEY,
  TRADING_ALL_TIME_PNL_PUBLIC_KEY,
  TRADING_TOTALS_PUBLIC_KEY,
} from '@/shared/contracts';
import type {
  GetTradingTotalsPublicResponse,
  SetTradingTotalsPublicResponse,
} from '@/shared/messages';
import { createLogger } from '@/signal/logger';
import { toAuthedError } from './authed-error';
import { authedCall } from './worker-core';

const logger = createLogger('trading-visibility');

export async function handleGetTradingTotalsPublic(): Promise<GetTradingTotalsPublicResponse> {
  try {
    const list = await authedCall((token) => api.getPreferences(token));
    const find = (key: string) => list.preferences.find((preference) => preference.key === key);
    const master = find(TRADING_TOTALS_PUBLIC_KEY);
    const accountValue = find(TRADING_ACCOUNT_VALUE_PUBLIC_KEY);
    const allTimePnl = find(TRADING_ALL_TIME_PNL_PUBLIC_KEY);

    return {
      enabled: master?.enabled ?? null,
      ...(accountValue ? { accountValuePublic: accountValue.enabled ?? null } : {}),
      ...(allTimePnl ? { allTimePnlPublic: allTimePnl.enabled ?? null } : {}),
    };
  } catch (error) {
    logger.error('getTradingTotalsPublic error', error);
    return toAuthedError(error, 'read preferences failed');
  }
}

export async function handleSetTradingTotalsPublic(
  enabled: boolean,
): Promise<SetTradingTotalsPublicResponse> {
  try {
    const result = await authedCall((token) => api.putTradingTotalsPublic(token, enabled === true));
    return { result };
  } catch (error) {
    logger.error('setTradingTotalsPublic error', error);
    return toAuthedError(error, 'set preference failed');
  }
}
