import { logLocalError } from '@/lib/guard';
import { meCacheItem } from '@/shared/storage';
import { hostPrefersDark } from '../host-theme';
import { isEnabled, type SignalSettings } from '../settings';
import { findSidebarModuleAnchor } from '../activity-sidebar/placement';
import { createTickersCard, type TickersCardHandle } from './tickers-card';

const SCAN_DELAY_MS = 300;

export class TickersCardController {
  private readonly doc: Document;
  private settings: SignalSettings;
  private handle: TickersCardHandle | null = null;
  private observer: MutationObserver | null = null;
  private scanTimer: ReturnType<typeof setTimeout> | undefined;
  private xLinked = false;
  private unwatchMe: (() => void) | null = null;

  constructor(doc: Document = document, settings: SignalSettings = {}) {
    this.doc = doc;
    this.settings = settings;
  }

  observe(target: Node = this.doc): void {
    void meCacheItem
      .getValue()
      .then((me) => this.setXLinked(!!me?.twitterId))
      .catch((error) => logLocalError(error, 'tickersCard.me'));
    this.unwatchMe = meCacheItem.watch((me) => this.setXLinked(!!me?.twitterId));
    this.observer = new MutationObserver(() => this.scheduleScan());
    this.observer.observe(target, { childList: true, subtree: true });
    this.reconcile();
  }

  applySettings(next: SignalSettings): void {
    this.settings = next;
    this.reconcile();
  }

  cleanup(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.unwatchMe?.();
    this.unwatchMe = null;
    clearTimeout(this.scanTimer);
    this.scanTimer = undefined;
    this.unmount();
  }

  private setXLinked(linked: boolean): void {
    if (linked === this.xLinked) return;
    this.xLinked = linked;
    this.reconcile();
  }

  private scheduleScan(): void {
    if (this.scanTimer !== undefined) return;
    this.scanTimer = setTimeout(() => {
      this.scanTimer = undefined;
      this.reconcile();
    }, SCAN_DELAY_MS);
  }

  private reconcile(): void {
    if (!isEnabled(this.settings, 'activityFeed.sidebar') || !this.xLinked) {
      this.unmount();
      return;
    }
    if (this.handle?.root.isConnected) {
      this.handle.setDark(hostPrefersDark(this.doc));
      return;
    }
    const anchor = findSidebarModuleAnchor(this.doc, this.handle?.root ?? null);
    if (!anchor) return;
    if (!this.handle) this.handle = createTickersCard({ dark: hostPrefersDark(this.doc) });
    anchor.before(this.handle.root);
  }

  private unmount(): void {
    this.handle?.destroy();
    this.handle = null;
  }
}
