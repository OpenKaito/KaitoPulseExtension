import type { AvatarSignalProfile, SignalProfileSnapshot } from "../types";
import type { SignalSurfaceKey } from "../settings";
import { SIGNAL_DOM_ATTRS as DOM_ATTRS, SIGNAL_DOM_SELECTORS as SELECTORS } from "./selectors";
import { canonicalAvatarRoot, classifyAddedNodes, findPrimaryAvatarRoot, surfaceForAvatarHost } from "./queries";
import { normalizeHandle, normalizeHandleFromHref, normalizeHandleFromText } from "../identity";

export interface AvatarAnchor {
  avatarRoot: HTMLElement;
  surface: SignalSurfaceKey;
}

export interface UserCellAvatarAnchor {
  avatarRoot: HTMLElement;
  id: string;
  handle: string | null;
}

export interface HoverCardAnchor {
  card: HTMLElement;
  avatarRoot: HTMLElement;
  id: string;
}

export interface QuotedAvatarAnchor {
  avatarRoot: HTMLElement;
  handle: string;
  surface: SignalSurfaceKey;
}

const TIMING = {
  FEED_SCAN_DELAY: 150,
  USER_CELL_SCAN_DELAY: 150,
  HOVER_CARD_SCAN_DELAY: 150,
} as const;

export interface SurfaceScans {
  onFeed(): void;
  onUserCell(): void;
  onHoverCard(): void;

  onMaintenance?(): void;
}

export class DomAdapter {
  private readonly document: Document;
  private feedScanTimer: ReturnType<typeof setTimeout> | undefined;
  private userCellScanTimer: ReturnType<typeof setTimeout> | undefined;
  private hoverCardScanTimer: ReturnType<typeof setTimeout> | undefined;
  private lastHref = '';
  private scans: SurfaceScans | undefined;

  constructor(doc: Document = document) {
    this.document = doc;
  }

  mount(
    avatarRoot: HTMLElement,
    tweetId: string,
    identity: string,
    avatarSize: AvatarSignalProfile['avatarSize'] = 'regular',
    surface: SignalSurfaceKey = 'avatar.feed',
  ): { container: HTMLElement; avatarRoot: HTMLElement } | null {

    const scope = avatarRoot.parentElement?.closest(SELECTORS.AVATAR) ?? avatarRoot;
    const existing = scope.querySelector(
      `[${DOM_ATTRS.AVATAR_INJECTED_FLAG}]`
    ) as HTMLElement | null;
    if (existing) {
      if (existing.getAttribute(DOM_ATTRS.AVATAR_HANDLE) === identity) return null;
      const staleHost = existing.parentElement;
      existing.remove();

      if (
        staleHost && staleHost !== avatarRoot &&
        !staleHost.querySelector(`[${DOM_ATTRS.AVATAR_INJECTED_FLAG}]`)
      ) {
        staleHost.classList.remove('signal-avatar-host');
      }
    }

    const container = this.document.createElement('div');
    container.setAttribute(DOM_ATTRS.AVATAR_INJECTED_FLAG, tweetId);
    container.setAttribute(DOM_ATTRS.AVATAR_HANDLE, identity);
    container.setAttribute(DOM_ATTRS.SURFACE, surface);
    container.className = avatarSize === 'compact'
      ? 'signal-avatar-mount signal-avatar-mount--compact'
      : 'signal-avatar-mount';

    avatarRoot.classList.add('signal-avatar-host');

    avatarRoot.appendChild(container);
    return { container, avatarRoot };
  }

  discoverFeedAvatars(
    article: HTMLElement,
    handle: string,
    index: Map<string, HTMLElement[]>,
  ): AvatarAnchor[] {
    return collectAvatarRoots(article, handle, index).map((avatarRoot) => ({
      avatarRoot,
      surface: surfaceForAvatarHost(avatarRoot),
    }));
  }

  buildFeedAvatarIndex(): Map<string, HTMLElement[]> {
    return buildAuthorAvatarIndex(this.document);
  }

  discoverQuotedAvatars(article: HTMLElement): QuotedAvatarAnchor[] {
    const out: QuotedAvatarAnchor[] = [];
    for (const card of article.querySelectorAll(SELECTORS.QUOTED_TWEET)) {
      const avatarRoot = findPrimaryAvatarRoot(card);
      if (!avatarRoot) continue;
      const handle = getAvatarRootHandle(avatarRoot);
      if (!handle) continue;
      out.push({ avatarRoot, handle, surface: 'avatar.quoted' });
    }
    return out;
  }

  discoverUserCellAvatars(): UserCellAvatarAnchor[] {
    const out: UserCellAvatarAnchor[] = [];
    for (const userCell of this.document.querySelectorAll(SELECTORS.USER_CELL)) {
      const candidate = userCell.querySelector(SELECTORS.AVATAR) as HTMLElement | null;
      if (!candidate) continue;

      const avatarRoot = canonicalAvatarRoot(candidate);
      const id = getContainerUserId(userCell as HTMLElement);
      if (!id) continue;
      const handle = getAvatarRootHandle(avatarRoot);
      out.push({ avatarRoot, id, handle });
    }
    return out;
  }

  discoverHoverCardSignals(): HoverCardAnchor[] {
    const out: HoverCardAnchor[] = [];
    for (const card of this.document.querySelectorAll(SELECTORS.HOVER_CARD)) {
      const cardEl = card as HTMLElement;
      const avatarRoot = cardEl.querySelector(SELECTORS.AVATAR_CONTAINER_KNOWN) as HTMLElement | null;
      if (!avatarRoot) continue;
      const id = getContainerUserId(cardEl);
      if (!id) continue;
      out.push({ card: cardEl, avatarRoot, id });
    }
    return out;
  }

  observe(scans: SurfaceScans, target: Node = this.document): () => void {
    this.scans = scans;
    this.lastHref = this.document.location?.href ?? '';
    scans.onFeed();
    scans.onUserCell();
    scans.onHoverCard();

    const observer = new MutationObserver((mutations) => {
      this.refreshAvatarsOnNavigation();
      this.scans?.onMaintenance?.();

      const added = classifyAddedNodes(mutations, {
        feed: SELECTORS.ARTICLE,
        userCell: SELECTORS.USER_CELL,
        hoverCard: SELECTORS.HOVER_CARD,
      });

      const feedContentChanged = !added.feed && mutations.some(
        (mutation) => mutation.target instanceof HTMLElement &&
          mutation.target.closest(SELECTORS.TWEET_TEXT) != null
      );
      if (added.feed || feedContentChanged) this.scheduleFeedScan();
      if (added.userCell) this.scheduleUserCellScan();
      if (added.hoverCard) this.scheduleHoverCardScan();
    });
    observer.observe(target, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (this.feedScanTimer !== undefined) { clearTimeout(this.feedScanTimer); this.feedScanTimer = undefined; }
      if (this.userCellScanTimer !== undefined) { clearTimeout(this.userCellScanTimer); this.userCellScanTimer = undefined; }
      if (this.hoverCardScanTimer !== undefined) { clearTimeout(this.hoverCardScanTimer); this.hoverCardScanTimer = undefined; }
    };
  }

  private scheduleFeedScan(): void {
    if (this.feedScanTimer !== undefined) return;
    this.feedScanTimer = setTimeout(() => { this.feedScanTimer = undefined; this.scans?.onFeed(); }, TIMING.FEED_SCAN_DELAY);
  }

  private scheduleUserCellScan(): void {
    if (this.userCellScanTimer !== undefined) return;
    this.userCellScanTimer = setTimeout(() => { this.userCellScanTimer = undefined; this.scans?.onUserCell(); }, TIMING.USER_CELL_SCAN_DELAY);
  }

  private scheduleHoverCardScan(): void {
    if (this.hoverCardScanTimer !== undefined) return;
    this.hoverCardScanTimer = setTimeout(() => { this.hoverCardScanTimer = undefined; this.scans?.onHoverCard(); }, TIMING.HOVER_CARD_SCAN_DELAY);
  }

  private refreshAvatarsOnNavigation(): void {
    const href = this.document.location?.href ?? '';
    if (href === this.lastHref) return;
    this.lastHref = href;

    for (const mount of this.document.querySelectorAll(`[${DOM_ATTRS.AVATAR_INJECTED_FLAG}]`)) {
      const mountEl = mount as HTMLElement;
      const host = mountEl.parentElement;
      if (!host) continue;
      const currentHandle = getAvatarRootHandle(host) ?? '';
      if (mountEl.getAttribute(DOM_ATTRS.AVATAR_HANDLE) === currentHandle) continue;
      mountEl.remove();
      if (!host.querySelector(`[${DOM_ATTRS.AVATAR_INJECTED_FLAG}]`)) {
        host.classList.remove('signal-avatar-host');
      }
    }
  }
}

export function getAvatarRootHandle(avatarRoot: HTMLElement): string | null {
  const testId = avatarRoot.getAttribute('data-testid');
  if (testId?.startsWith('UserAvatar-Container-')) {
    const handle = testId.slice('UserAvatar-Container-'.length);
    if (handle) return normalizeHandle(handle);
  }

  const link = avatarRoot.querySelector('a[href^="/"]') as HTMLAnchorElement | null;
  return normalizeHandleFromHref(link?.getAttribute('href'));
}

export function buildAuthorAvatarIndex(doc: Document): Map<string, HTMLElement[]> {
  const index = new Map<string, HTMLElement[]>();

  const seen = new Set<HTMLElement>();
  for (const candidate of doc.querySelectorAll(SELECTORS.AVATAR)) {
    const root = canonicalAvatarRoot(candidate as HTMLElement);
    if (seen.has(root)) continue;
    seen.add(root);

    if (root.closest(SELECTORS.ACCOUNT_SWITCHER)) continue;
    const handle = getAvatarRootHandle(root);
    if (!handle) continue;
    const existing = index.get(handle);
    if (existing) existing.push(root);
    else index.set(handle, [root]);
  }
  return index;
}

export function collectAvatarRoots(
  article: HTMLElement,
  authorHandle: string | null,
  index: Map<string, HTMLElement[]>,
): HTMLElement[] {
  const roots = new Set<HTMLElement>();
  const avatarRoot = findPrimaryAvatarRoot(article);
  if (avatarRoot) roots.add(avatarRoot);

  if (authorHandle) {
    for (const root of index.get(authorHandle) ?? []) roots.add(root);
  }

  return Array.from(roots);
}

export function getContainerUserId(container: HTMLElement): string | null {
  const followControl = container.querySelector(SELECTORS.FOLLOW_CONTROL) as HTMLElement | null;
  const numericId = followControl?.getAttribute('data-testid')?.match(/^(\d+)-(?:un)?follow$/)?.[1];
  if (numericId) return `user:${numericId}`;

  const avatarRoot = container.querySelector(SELECTORS.AVATAR) as HTMLElement | null;
  const handle = avatarRoot ? getAvatarRootHandle(avatarRoot) : null;
  return handle ? `user:${handle}` : null;
}

export function getArticleAuthorHandle(article: HTMLElement): string | null {
  const userNameLink = article.querySelector(
    `:is(${SELECTORS.USER_NAME}) a[role="link"][href^="/"]`
  ) as HTMLAnchorElement | null;
  const avatarRoot = findPrimaryAvatarRoot(article);

  return normalizeHandleFromHref(userNameLink?.getAttribute('href')) ??
    normalizeHandleFromText(article.querySelector(SELECTORS.USER_NAME)?.textContent) ??
    (avatarRoot ? getAvatarRootHandle(avatarRoot) : null);
}

export function getArticleTweetId(root: HTMLElement): string | null {
  for (const time of root.querySelectorAll('time')) {

    const quoted = time.closest(SELECTORS.QUOTED_TWEET);
    if (quoted && quoted !== root && root.contains(quoted)) continue;
    const match = time.closest('a')?.getAttribute('href')?.match(/\/status\/(\d+)/)?.[1];
    if (match) return match;
  }
  return null;
}

export function getArticleNoticeAnchor(article: HTMLElement): HTMLElement | null {
  const tweetText = article.querySelector('[data-testid="tweetText"]');
  const group = article.querySelector('[role="group"]');
  if (!tweetText || !group) return null;

  let node: Element = tweetText;
  while (node.parentElement && !node.parentElement.contains(group)) {
    node = node.parentElement;
  }
  return node.parentElement ? (node as HTMLElement) : null;
}

function textWithEmojiAlt(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as Element;
  if (el.tagName === 'IMG') return el.getAttribute('alt') ?? '';
  return Array.from(el.childNodes).map(textWithEmojiAlt).join('');
}

export function getArticleAuthorProfile(article: HTMLElement): SignalProfileSnapshot | null {
  const handle = getArticleAuthorHandle(article);
  if (!handle) return null;

  const nameLink = article.querySelector(
    `:is(${SELECTORS.USER_NAME}) a[role="link"][href^="/"]`
  ) as HTMLAnchorElement | null;
  const displayName = (nameLink ? textWithEmojiAlt(nameLink).trim() : '') || `@${handle}`;

  const avatarRoot = findPrimaryAvatarRoot(article);
  const avatarUrl = avatarRoot?.querySelector('img')?.src || undefined;

  return { handle, displayName, avatarUrl };
}
