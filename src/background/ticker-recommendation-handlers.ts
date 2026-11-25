import { api } from '@/lib/api';
import type {
  GetTickerRecommendationsResponse,
  GetTickerScreenerResponse,
} from '@/shared/messages';
import type { TickerRecommendationsResponse } from '@/shared/ticker-recommendations';
import { createLogger } from '@/signal/logger';
import { toAuthedError } from './authed-error';
import { createFirstPageReuse } from './first-page-reuse';
import { authedCall } from './worker-core';

const logger = createLogger('ticker-recommendations');
const firstPage = createFirstPageReuse<TickerRecommendationsResponse>(60_000);

const SCREENER_CACHE_TTL_MS = 120_000;
type ScreenerResult = Awaited<ReturnType<typeof api.getTickerScreener>>;
const screenerCache = new Map<string, { at: number; result: ScreenerResult }>();
const screenerInflight = new Map<string, Promise<ScreenerResult>>();

export async function handleGetTickerRecommendations(
  limit?: number,
): Promise<GetTickerRecommendationsResponse> {
  try {
    return {
      result: await authedCall((token) =>
        firstPage.get(token, () => api.getTickerRecommendations(limit, token)),
      ),
    };
  } catch (error) {
    logger.error('getTickerRecommendations error', error);
    return toAuthedError(error, 'ticker recommendations fetch failed');
  }
}

export async function handleGetTickerScreener(
  tickers: string[],
): Promise<GetTickerScreenerResponse> {
  const key = [...tickers].sort().join(',');
  const cached = screenerCache.get(key);
  if (cached && Date.now() - cached.at < SCREENER_CACHE_TTL_MS) {
    return { result: cached.result };
  }
  try {
    let pending = screenerInflight.get(key);
    if (!pending) {
      pending = authedCall((token) => api.getTickerScreener(tickers, token));
      screenerInflight.set(key, pending);
      void pending.finally(() => {
        if (screenerInflight.get(key) === pending) screenerInflight.delete(key);
      });
    }
    const result = await pending;
    if (result?.data?.length) {
      screenerCache.set(key, { at: Date.now(), result });
    }
    return { result };
  } catch (error) {
    logger.error('getTickerScreener error', error);
    return toAuthedError(error, 'ticker screener fetch failed');
  }
}
