import type { FetchResolveTickersResponse } from "@/shared/messages";
import type { CashtagOccurrence } from "@/shared/ticker-resolve";
import { api } from "@/lib/api";
import { getStoredSession } from "@/lib/client-storage";
import { createLogger } from "@/signal/logger";

const logger = createLogger("ticker-resolve");

const RESOLVE_BATCH_LIMIT = 50;

export async function handleResolveTickers(occurrences: CashtagOccurrence[]): Promise<FetchResolveTickersResponse> {
  const stored = await getStoredSession();
  if (!stored?.sessionToken) {
    return { resolved: [] };
  }

  const capped = occurrences.slice(0, RESOLVE_BATCH_LIMIT);
  if (capped.length < occurrences.length) {
    logger.warn(`resolve batch capped at ${RESOLVE_BATCH_LIMIT} (got ${occurrences.length})`);
  }

  try {
    const response = await api.resolveTickers(capped, stored.sessionToken);
    return { resolved: response.resolved };
  } catch (error) {
    logger.error("resolveTickers error", error);
    return { resolved: [], error: (error as Error)?.message || "resolve fetch failed" };
  }
}
