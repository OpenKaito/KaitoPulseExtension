import type { TokenChartPeriod, TokenChartResult } from "@/shared/token-chart";
import { sendKaitoMessage } from "../messaging";
import { SwrCache } from "../swr-cache";
import { SIGNAL_CONFIG } from "../config";

function cacheKey(symbol: string, period: TokenChartPeriod, entity?: string): string {

  return `${symbol}:${period}:${entity ?? ""}`;
}

const cache = new SwrCache<TokenChartResult>({
  freshTtl: SIGNAL_CONFIG.cacheFreshTtlMs,
  negativeTtl: SIGNAL_CONFIG.cacheNegativeTtlMs,
  errorBackoff: SIGNAL_CONFIG.cacheErrorBackoffMs,
  maxEntries: SIGNAL_CONFIG.cacheMaxEntries,
  label: "token-chart",
  equals: (a, b) => a?.symbol === b?.symbol && a?.points.length === b?.points.length,

  isComplete: (result) => result.meta.priceAvailable || result.meta.sentimentAvailable,
  fetchKeys: async (keys) => {

    const key = keys[0];
    const [symbol, period, entity] = key.split(":") as [string, TokenChartPeriod, string];
    const response = await sendKaitoMessage({
      target: "kaitoExtension",
      action: "fetchTokenChart",
      symbol,
      period,
      ...(entity ? { entity } : {}),
    });
    if (response.error) throw new Error(response.error);
    return new Map([[key, response.result ?? null]]);
  },
});

export function getTokenChart(
  symbol: string,
  period: TokenChartPeriod,
  entity?: string,
): Promise<TokenChartResult | null> {
  return cache.request(cacheKey(symbol, period, entity));
}
