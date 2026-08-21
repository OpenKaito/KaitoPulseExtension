
import type { UserInfoData, UsernameChange } from "../types";
import { hoverCardToUserInfoData } from "../social-card-map";
import { resolveTwitterId } from "../identity";
import { createLogger } from "../logger";
import { getHoverCard } from "../hover-card-store";

const logger = createLogger("profile-data");

export function getUsernameHistory(): UsernameChange[] {
  return [];
}

export type UserInfoLoad =
  | { status: "ok"; data: UserInfoData; partial: boolean }
  | { status: "no-id" }
  | { status: "empty" }
  | { status: "error" };

const emptyIds = new Set<string>();

export async function loadUserInfoData(handle: string): Promise<UserInfoLoad> {
  const twitterId = await resolveTwitterId(handle);
  if (!twitterId) {
    logger.log("no twitter_id yet for", handle);
    return { status: "no-id" };
  }
  if (emptyIds.has(twitterId)) return { status: "empty" };

  const result = await getHoverCard(twitterId);
  if (!result) {
    logger.log("hover-card load failed");
    return { status: "error" };
  }

  const data = hoverCardToUserInfoData(result);
  const hasContent =
    data.smartFollowers.length > 0 ||
    data.topSmartFollowers.length > 0 ||
    !!data.hyperliquid ||
    !!data.polymarket;
  if (!hasContent) {
    emptyIds.add(twitterId);
    return { status: "empty" };
  }

  return { status: "ok", data, partial: result.smartFollowers == null };
}
