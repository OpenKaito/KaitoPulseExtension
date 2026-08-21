
import { type ViewerIdentity } from '@/shared/viewer';
import { viewerItem } from '@/shared/storage';
import { SIGNAL_DOM_SELECTORS } from './dom/selectors';
import { getAvatarRootHandle } from './dom/adapter';
import { normalizeHandleFromHref } from './identity';
import { twitterIdMap } from './twitter-id-map';
import { createLogger } from './logger';

const logger = createLogger('viewer');

export function deriveViewerHandle(doc: Document): string | null {
  const accountButton = doc.querySelector(SIGNAL_DOM_SELECTORS.ACCOUNT_SWITCHER);
  const avatarRoot = accountButton?.querySelector(SIGNAL_DOM_SELECTORS.AVATAR_CONTAINER);
  if (avatarRoot instanceof HTMLElement) {
    const handle = getAvatarRootHandle(avatarRoot);
    if (handle) return handle;
  }
  const profileLink = doc.querySelector(SIGNAL_DOM_SELECTORS.PROFILE_NAV_LINK);
  return normalizeHandleFromHref(profileLink?.getAttribute('href'));
}

export function deriveViewerId(doc: Document): string | null {
  const twid = doc.cookie.split('; ').find((c) => c.startsWith('twid='));
  if (!twid) return null;
  const value = decodeURIComponent(twid.slice('twid='.length)).replace(/^"|"$/g, '');
  const match = value.match(/u=(\d+)/);
  return match ? match[1] : null;
}

function resolveInheritedHandle(existing: ViewerIdentity | null, id: string | null): string | null {
  if (!existing || existing.id === null || existing.id !== id) return null;
  return existing.handle;
}

class ViewerIdentityTracker {
  private started = false;
  private doc: Document | null = null;
  private observer: MutationObserver | null = null;
  private lastHandle: string | null = null;
  private idWaitToken = 0;

  start(doc: Document): void {
    if (this.started) return;
    this.started = true;
    this.doc = doc;
    if (this.tryDerive()) return;

    this.observer = new MutationObserver(() => {
      if (this.tryDerive()) {
        this.observer?.disconnect();
        this.observer = null;
      }
    });
    this.observer.observe(doc.body, { childList: true, subtree: true });
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.observer?.disconnect();
    this.observer = null;
    this.idWaitToken++;
    this.doc = null;
    this.lastHandle = null;
  }

  private tryDerive(): boolean {
    if (!this.doc) return false;
    const handle = deriveViewerHandle(this.doc);

    const cookieId = deriveViewerId(this.doc);

    if (!handle) {

      if (cookieId) void this.persist(null, cookieId);
      return false;
    }
    if (handle === this.lastHandle) return true;
    this.lastHandle = handle;

    const id = cookieId ?? twitterIdMap.resolve(handle);
    void this.persist(handle, id);
    if (!id) this.fillId(handle);
    return true;
  }

  private fillId(handle: string): void {
    const token = ++this.idWaitToken;
    void twitterIdMap.resolveAsync(handle).then((id) => {
      if (token !== this.idWaitToken) return;
      if (id) void this.persist(handle, id);
    });
  }

  private async persist(handle: string | null, id: string | null): Promise<void> {
    let existing: ViewerIdentity | null = null;
    if (id === null || handle === null) {
      try {
        existing = await viewerItem.getValue();
      } catch {

      }
    }
    if (id === null && existing?.handle === handle && existing.id) {
      return;
    }
    const effectiveHandle = handle ?? resolveInheritedHandle(existing, id);
    const value: ViewerIdentity = { handle: effectiveHandle, id, updatedAt: Date.now() };
    try {
      await viewerItem.setValue(value);

      logger.log(`viewer @${effectiveHandle ?? '?'} id=${id ?? 'pending'}`);
    } catch {

    }
  }
}

export const viewerIdentity = new ViewerIdentityTracker();
