import type { FetchTokenChartResponse } from '@/shared/messages';
import type { TokenChartPeriod, TokenChartPoint } from '@/shared/token-chart';
import { PERIOD_TO_DURATION } from '@/shared/token-chart';
import { api } from '@/lib/api';
import { getStoredSession } from '@/lib/client-storage';
import { createLogger } from '@/signal/logger';

const logger = createLogger('token-chart');

type ChartResult = NonNullable<FetchTokenChartResponse['result']>;

const CHART_CACHE_TTL_MS = 5 * 60 * 1000;
const chartCache = new Map<string, { at: number; result: ChartResult }>();

export async function handleFetchTokenChart(
  symbol: string,
  period: TokenChartPeriod,

  entity?: string,
): Promise<FetchTokenChartResponse> {
  const stored = await getStoredSession();
  if (!stored?.sessionToken) {
    return { error: 'signed out' };
  }

  const cacheKey = `${symbol}|${period}|${entity ?? ''}`;
  const cached = chartCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CHART_CACHE_TTL_MS) {
    return { result: cached.result };
  }

  try {
    const response = await api.getTickerChart(
      symbol,
      PERIOD_TO_DURATION[period],
      entity,
      stored.sessionToken,
    );
    const points: TokenChartPoint[] = response.timestamps.map((t, i) => ({
      t,
      price: response.price[i] ?? null,
      sentiment: response.sentiment[i] ?? null,

      event: response.events?.[i] ?? null,
    }));
    const result: ChartResult = { symbol, points, meta: response.meta };
    chartCache.set(cacheKey, { at: Date.now(), result });
    return { result };
  } catch (error) {
    logger.error('fetchTokenChart error', error);
    return { error: (error as Error)?.message || 'token chart fetch failed' };
  }
}
