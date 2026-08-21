import type { AdFlagWriteResponse } from "@/shared/messages";
import { SIGNAL_CONFIG } from "../config";
import { createLogger } from "../logger";
import { sendKaitoMessage } from "../messaging";
import { SwrCache } from "../swr-cache";
import type { AdFlagReason } from "./types";

export interface AdFlagItem {
  count: number;

  myReason: string | null;
}

export type AdFlagWriteOutcome =
  | { ok: true }
  | { ok: false; error: string; status?: number };

const WINDOW_MS = 250;
const MAX_BATCH = 50;

function itemEquals(a: AdFlagItem | null, b: AdFlagItem | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.count === b.count && a.myReason === b.myReason;
}

export class AdFlagStore {
  private readonly logger = createLogger("ad-flag-store");
  private readonly cache: SwrCache<AdFlagItem>;

  constructor() {
    this.cache = new SwrCache<AdFlagItem>({
      freshTtl: SIGNAL_CONFIG.cacheFreshTtlMs,
      negativeTtl: SIGNAL_CONFIG.cacheNegativeTtlMs,
      errorBackoff: SIGNAL_CONFIG.cacheErrorBackoffMs,
      maxEntries: SIGNAL_CONFIG.cacheMaxEntries,
      batchWindowMs: WINDOW_MS,
      maxBatch: MAX_BATCH,
      equals: itemEquals,
      label: "ad-flags",
      fetchKeys: (ids) => this.fetchFlags(ids),
    });
  }

  observe(tweetId: string, cb: (item: AdFlagItem | null) => void): () => void {
    return this.cache.observe(tweetId, cb);
  }

  peek(tweetId: string): AdFlagItem | null | undefined {
    return this.cache.peek(tweetId);
  }

  async putFlag(tweetId: string, reason: AdFlagReason): Promise<AdFlagWriteOutcome> {
    const before = this.cache.peek(tweetId);
    const base = before ?? { count: 0, myReason: null };

    this.cache.set(tweetId, {
      count: base.myReason != null ? base.count : base.count + 1,
      myReason: reason,
    });

    const response = await sendKaitoMessage({
      target: "kaitoExtension",
      action: "putAdFlag",
      tweetId,
      reason,
    });
    return this.reconcile(tweetId, before, response);
  }

  async removeFlag(tweetId: string): Promise<AdFlagWriteOutcome> {
    const before = this.cache.peek(tweetId);
    const base = before ?? { count: 0, myReason: null };
    this.cache.set(tweetId, {
      count: base.myReason != null ? Math.max(0, base.count - 1) : base.count,
      myReason: null,
    });

    const response = await sendKaitoMessage({
      target: "kaitoExtension",
      action: "removeAdFlag",
      tweetId,
    });
    return this.reconcile(tweetId, before, response);
  }

  dispose(): void {
    this.cache.dispose();
  }

  private reconcile(
    tweetId: string,
    before: AdFlagItem | null | undefined,
    response: AdFlagWriteResponse,
  ): AdFlagWriteOutcome {
    if (response.error || !response.result) {

      this.cache.set(tweetId, before ?? null);
      this.logger.warn("ad-flag write failed", response.error, response.status);
      return { ok: false, error: response.error || "write_failed", status: response.status };
    }
    this.cache.set(tweetId, {
      count: response.result.count,
      myReason: response.result.reason,
    });
    return { ok: true };
  }

  private async fetchFlags(ids: string[]): Promise<Map<string, AdFlagItem | null>> {
    const response = await sendKaitoMessage({
      target: "kaitoExtension",
      action: "queryAdFlags",
      tweetIds: ids,
    });

    if (response.error || !response.items) {
      throw new Error(response.error || "ad-flag query failed");
    }
    const map = new Map<string, AdFlagItem | null>();
    for (const id of ids) {
      const item = response.items[id];
      map.set(
        id,
        item
          ? {
              count: item.count,
              myReason: item.my_reason ?? null,
            }
          :

            null,
      );
    }
    return map;
  }
}
