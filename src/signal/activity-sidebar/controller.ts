import { logLocalError } from '@/lib/guard';
import { meCacheItem } from '@/shared/storage';
import { hostPrefersDark } from '../host-theme';
import { sendKaitoMessage } from '../messaging';
import { isEnabled, setSurface, type SignalSettings } from '../settings';
import { createActivitySidebar, type ActivitySidebarHandle } from './activity-sidebar';
import { findSidebarModuleAnchor } from './placement';

const SCAN_DELAY_MS = 300;
const DEFAULT_REFRESH_SECONDS = 60;

type RemoteConfig = { enabled: boolean; refreshSeconds: number };

export class ActivitySidebarController {
  private readonly doc: Document;
  private settings: SignalSettings;
  private handle: ActivitySidebarHandle | null = null;
  private observer: MutationObserver | null = null;
  private scanTimer: ReturnType<typeof setTimeout> | undefined;
  private xLinked = false;
  private config: RemoteConfig | null = null;
  private configRequested = false;
  private unwatchMe: (() => void) | null = null;

  constructor(doc: Document = document, settings: SignalSettings = {}) {
    this.doc = doc;
    this.settings = settings;
  }

  observe(target: Node = this.doc): void {
    void meCacheItem
      .getValue()
      .then((me) => this.setXLinked(!!me?.twitterId))
      .catch((error) => logLocalError(error, 'activitySidebar.me'));
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

  private requestConfig(): void {
    if (this.configRequested) return;
    this.configRequested = true;
    void sendKaitoMessage({ target: 'kaitoExtension', action: 'getActivityFeedConfig' })
      .then((response) => {
        this.config = {
          enabled: response.result?.enabled !== false,
          refreshSeconds: response.result?.refreshIntervalSeconds ?? DEFAULT_REFRESH_SECONDS,
        };
      })
      .catch(() => {
        this.config = { enabled: true, refreshSeconds: DEFAULT_REFRESH_SECONDS };
      })
      .finally(() => this.reconcile());
  }

  private reconcile(): void {
    if (!isEnabled(this.settings, 'activityFeed.sidebar') || !this.xLinked) {
      this.unmount();
      return;
    }
    if (!this.config) {
      this.requestConfig();
      return;
    }
    if (!this.config.enabled) {
      this.unmount();
      return;
    }

    const own = this.handle?.root ?? null;
    const anchor = findSidebarModuleAnchor(this.doc, own);
    if (!anchor) return;
    if (own?.isConnected && own.nextElementSibling === anchor) {
      this.handle?.setDark(hostPrefersDark(this.doc));
      return;
    }
    if (!this.handle) {
      this.handle = createActivitySidebar({
        refreshSeconds: this.config.refreshSeconds,
        dark: hostPrefersDark(this.doc),
        onHide: () => {
          void setSurface('activityFeed.sidebar', false).catch((error) =>
            logLocalError(error, 'activitySidebar.hide'),
          );
        },
      });
    }
    anchor.before(this.handle.root);
  }

  private unmount(): void {
    this.handle?.destroy();
    this.handle = null;
  }
}
