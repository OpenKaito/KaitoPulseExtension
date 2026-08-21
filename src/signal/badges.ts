import type { BadgeItem } from "@/shared/social-card";
import { sendKaitoMessage } from "./messaging";
import { createLogger } from "./logger";
import { SwrCache } from "./swr-cache";
import { SIGNAL_CONFIG } from "./config";

const WINDOW_MS = 250;
const MAX_BATCH = 50;

function badgeEquals(a: BadgeItem | null, b: BadgeItem | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.smartFollowers === b.smartFollowers &&
    a.platforms.hl === b.platforms.hl &&
    a.platforms.pm === b.platforms.pm &&
    a.platforms.hlPositions === b.platforms.hlPositions &&
    a.platforms.pmPositions === b.platforms.pmPositions &&
    tradingEquals(a.trading, b.trading)
  );
}

function tradingEquals(a: BadgeItem['trading'], b: BadgeItem['trading']): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.bucket === b.bucket &&
    a.platforms.length === b.platforms.length &&

    a.platforms.every((p, i) => p === b.platforms[i])
  );
}

export class BadgesBatcher {
  private readonly logger = createLogger("badges");
  private readonly cache: SwrCache<BadgeItem>;

  constructor() {
    this.cache = new SwrCache<BadgeItem>({
      freshTtl: SIGNAL_CONFIG.cacheFreshTtlMs,
      negativeTtl: SIGNAL_CONFIG.cacheNegativeTtlMs,
      errorBackoff: SIGNAL_CONFIG.cacheErrorBackoffMs,
      maxEntries: SIGNAL_CONFIG.cacheMaxEntries,
      batchWindowMs: WINDOW_MS,
      maxBatch: MAX_BATCH,
      equals: badgeEquals,

      isComplete: (badge) => badge.smartFollowers != null,
      label: "badges",
      fetchKeys: (ids) => this.fetchBadges(ids),
    });
  }

  request(twitterId: string): Promise<BadgeItem | null> {
    return this.cache.request(twitterId);
  }

  observe(twitterId: string, cb: (badge: BadgeItem | null) => void): () => void {
    return this.cache.observe(twitterId, cb);
  }

  dispose(): void {
    this.cache.dispose();
  }

  private async fetchBadges(ids: string[]): Promise<Map<string, BadgeItem | null>> {

    const response = await sendKaitoMessage({
      target: "kaitoExtension",
      action: "fetchBadges",
      twitterIds: ids,
    });
    if (response.error) this.logger.error("fetchBadges error", response.error);
    const items = response.items ?? {};
    const map = new Map<string, BadgeItem | null>();
    for (const id of ids) {
      const item = items[id];
      if (item !== undefined) {
        map.set(id, item);
      } else if (response.error) {

        map.set(id, {
          smartFollowers: null,
          platforms: { hl: false, pm: false, hlPositions: null, pmPositions: null },
        });
      } else {
        map.set(id, null);
      }
    }
    return map;
  }
}
