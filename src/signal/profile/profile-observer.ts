import { createLogger } from "../logger";
import { findProfileHeader, getViewedHandle } from "./profile-dom";

const SCAN_DELAY = 150;

export interface ProfileObserverCallbacks {

  onMount: (handle: string, header: HTMLElement) => void;

  onEnsure: (handle: string, header: HTMLElement) => void;

  onUnmount: () => void;
}

export class ProfileObserver {
  private readonly logger = createLogger("profile-observer");
  private readonly doc: Document;
  private readonly callbacks: ProfileObserverCallbacks;
  private observer: MutationObserver | null = null;
  private scanTimer: ReturnType<typeof setTimeout> | undefined;
  private currentHandle: string | null = null;

  constructor(callbacks: ProfileObserverCallbacks, doc: Document = document) {
    this.doc = doc;
    this.callbacks = callbacks;
  }

  observe(target: Node = this.doc): void {
    this.reconcile();
    this.observer = new MutationObserver(() => this.scheduleScan());
    this.observer.observe(target, { childList: true, subtree: true });
  }

  private scheduleScan(): void {
    if (this.scanTimer !== undefined) return;
    this.scanTimer = setTimeout(() => {
      this.scanTimer = undefined;
      this.reconcile();
    }, SCAN_DELAY);
  }

  private reconcile(): void {
    const header = findProfileHeader(this.doc);
    const handle = header ? getViewedHandle(header, this.doc) : null;

    if (!handle || !header) {
      if (this.currentHandle !== null) {
        this.logger.log("left profile", this.currentHandle);
        this.currentHandle = null;
        this.callbacks.onUnmount();
      }
      return;
    }

    if (handle !== this.currentHandle) {
      if (this.currentHandle !== null) this.callbacks.onUnmount();
      this.logger.log("entered profile", handle);
      this.currentHandle = handle;
      this.callbacks.onMount(handle, header);
      return;
    }

    this.callbacks.onEnsure(handle, header);
  }

  cleanup(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.scanTimer !== undefined) {
      clearTimeout(this.scanTimer);
      this.scanTimer = undefined;
    }
    this.currentHandle = null;
  }
}
