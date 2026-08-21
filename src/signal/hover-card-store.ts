import type { HoverCardResult } from "@/shared/social-card";
import { sendKaitoMessage } from "./messaging";
import { SwrCache } from "./swr-cache";
import { SIGNAL_CONFIG } from "./config";

const cache = new SwrCache<HoverCardResult>({
  freshTtl: SIGNAL_CONFIG.cacheFreshTtlMs,
  negativeTtl: SIGNAL_CONFIG.cacheNegativeTtlMs,
  errorBackoff: SIGNAL_CONFIG.cacheErrorBackoffMs,
  maxEntries: SIGNAL_CONFIG.cacheMaxEntries,
  label: "hover-card",
  equals: (a, b) => JSON.stringify(a) === JSON.stringify(b),

  isComplete: (result) => result.smartFollowers != null,
  fetchKeys: async (ids) => {

    const id = ids[0];
    const response = await sendKaitoMessage({
      target: "kaitoExtension",
      action: "fetchHoverCard",
      twitterId: id,
    });
    if (response.error) throw new Error(response.error);
    return new Map([[id, response.result ?? null]]);
  },
});

export function getHoverCard(twitterId: string): Promise<HoverCardResult | null> {
  return cache.request(twitterId);
}
