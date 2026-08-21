
const IDLE_THRESHOLD_MS = 60_000;
const THROTTLE_MS = 1_000;
const CHECK_INTERVAL_MS = 5_000;
const INTERACTION_EVENTS: (keyof DocumentEventMap)[] = ['mousemove', 'scroll', 'keydown', 'touchstart'];

export class IdleDetector {
  private lastInteractionAt = Date.now();
  private lastUpdateAt = 0;
  private idle = false;
  private checkTimer: ReturnType<typeof setInterval> | undefined;
  private onIdleChange: ((idle: boolean) => void) | undefined;
  private readonly listener = (): void => this.onInteraction();

  start(onIdleChange: (idle: boolean) => void): void {
    this.onIdleChange = onIdleChange;
    this.lastInteractionAt = Date.now();
    this.idle = false;
    for (const type of INTERACTION_EVENTS) {
      document.addEventListener(type, this.listener, { passive: true, capture: true });
    }
    this.checkTimer = setInterval(() => this.checkIdle(), CHECK_INTERVAL_MS);
  }

  stop(): void {
    for (const type of INTERACTION_EVENTS) {
      document.removeEventListener(type, this.listener, true);
    }
    if (this.checkTimer !== undefined) clearInterval(this.checkTimer);
    this.onIdleChange = undefined;
  }

  private onInteraction(): void {
    const now = Date.now();
    if (now - this.lastUpdateAt < THROTTLE_MS) return;
    this.lastUpdateAt = now;
    this.lastInteractionAt = now;
    if (this.idle) {
      this.idle = false;
      this.onIdleChange?.(false);
    }
  }

  private checkIdle(): void {
    if (this.idle) return;
    if (Date.now() - this.lastInteractionAt >= IDLE_THRESHOLD_MS) {
      this.idle = true;
      this.onIdleChange?.(true);
    }
  }
}
