import { SIGNAL_DOM_SELECTORS as SELECTORS } from "./selectors";
import type { SignalSurfaceKey } from "../settings";

export function findPrimaryAvatarRoot(root: ParentNode): HTMLElement | null {
  return (root.querySelector(SELECTORS.AVATAR_CONTAINER) as HTMLElement | null) ??
    (root.querySelector(SELECTORS.AVATAR) as HTMLElement | null);
}

export function canonicalAvatarRoot(candidate: HTMLElement): HTMLElement {
  if (candidate.matches(SELECTORS.AVATAR_CONTAINER)) return candidate;
  return (candidate.querySelector(SELECTORS.AVATAR_CONTAINER) as HTMLElement | null) ?? candidate;
}

export function surfaceForAvatarHost(avatarRoot: HTMLElement): SignalSurfaceKey {
  if (avatarRoot.closest(SELECTORS.HOVER_CARD)) return 'avatar.hovercard';
  if (avatarRoot.closest(SELECTORS.USER_CELL)) return 'avatar.usercell';
  return 'avatar.feed';
}

export interface AddedSurfaceMatches {
  feed: boolean;
  userCell: boolean;
  hoverCard: boolean;
}

function nodeMatches(node: HTMLElement, selector: string): boolean {
  return node.matches?.(selector) === true || node.querySelector?.(selector) != null;
}

export function classifyAddedNodes(
  mutations: MutationRecord[],
  selectors: { feed: string; userCell: string; hoverCard: string },
): AddedSurfaceMatches {
  const matches: AddedSurfaceMatches = { feed: false, userCell: false, hoverCard: false };
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (!matches.feed && nodeMatches(node, selectors.feed)) matches.feed = true;
      if (!matches.userCell && nodeMatches(node, selectors.userCell)) matches.userCell = true;
      if (!matches.hoverCard && nodeMatches(node, selectors.hoverCard)) matches.hoverCard = true;
      if (matches.feed && matches.userCell && matches.hoverCard) return matches;
    }
  }
  return matches;
}
