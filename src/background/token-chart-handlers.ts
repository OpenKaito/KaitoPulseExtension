import type { FetchTokenChartResponse } from "@/shared/messages";
import type { TokenChartPeriod, TokenChartPoint } from "@/shared/token-chart";
import { PERIOD_TO_DURATION } from "@/shared/token-chart";
import { api } from "@/lib/api";
import { getStoredSession } from "@/lib/client-storage";
import { createLogger } from "@/signal/logger";

const logger = createLogger("token-chart");

export async function handleFetchTokenChart(
  symbol: string,
  period: TokenChartPeriod,

  entity?: string,
): Promise<FetchTokenChartResponse> {

  const stored = await getStoredSession();
  if (!stored?.sessionToken) {
    return { error: "signed out" };
  }

  try {
    const response = await api.getTickerChart(symbol, PERIOD_TO_DURATION[period], entity, stored.sessionToken);
    const points: TokenChartPoint[] = response.timestamps.map((t, i) => ({
      t,
      price: response.price[i] ?? null,
      sentiment: response.sentiment[i] ?? null,

      event: response.events?.[i] ?? null,
    }));
    return { result: { symbol, points, meta: response.meta } };
  } catch (error) {
    logger.error("fetchTokenChart error", error);
    return { error: (error as Error)?.message || "token chart fetch failed" };
  }
}
