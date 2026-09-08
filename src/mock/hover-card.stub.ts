import type { BadgeItem, HoverCardResult } from '@/shared/social-card';
import type { WalletDetailOutcome, WalletDetailRequest } from '@/shared/wallet-detail';

export async function applyHoverCardMock(
  _twitterId: string,
  result: HoverCardResult,
): Promise<HoverCardResult> {
  return result;
}

export async function applyBadgesPlatformMock(
  _requestedIds: string[],
  items: Record<string, BadgeItem | null>,
): Promise<Record<string, BadgeItem | null>> {
  return items;
}

export function watchHoverCardMock(_cb: (description: string) => void): () => void {
  return () => {};
}

export async function applyWalletDetailMock(
  _request: WalletDetailRequest,
): Promise<WalletDetailOutcome | null> {
  return null;
}
