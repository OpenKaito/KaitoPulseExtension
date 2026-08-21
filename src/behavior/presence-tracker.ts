
import type { AttentionBehaviorEvent } from '@/shared/attention';
import { createAttentionEventId, sanitizePageUrl } from '@/shared/attention';

const MAX_SPAN_MS = 5 * 60_000;

const MIN_SPAN_MS = 1_000;

const TICK_MS = 30_000;

const STALE_TICK_MS = TICK_MS * 3;

export class PresenceTracker {

  private readonly tabId = createAttentionEventId();
  private spanStartedAt: number | null = null;
  private idle = false;
  private visible: boolean;
  private timer: ReturnType<typeof setInterval> | undefined;

  private lastTickAt = Date.now();

  constructor(
    private readonly doc: Document,
    private readonly emitAttention: (event: AttentionBehaviorEvent) => void,
  ) {
    this.visible = doc.visibilityState === 'visible';
  }

  start(): void {
    if (this.timer !== undefined) return;

    this.lastTickAt = Date.now();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.reconcile();
  }

  flushOpenSpan(): void {
    this.closeSpan();
  }

  stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    this.closeSpan();
  }

  setIdle(idle: boolean): void {
    if (this.idle === idle) return;
    this.idle = idle;
    this.reconcile();
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    this.reconcile();
  }

  private reconcile(): void {
    const present = this.visible && !this.idle;
    if (present && this.spanStartedAt === null) {
      this.spanStartedAt = Date.now();
      return;
    }
    if (!present && this.spanStartedAt !== null) {
      this.closeSpan();
    }
  }

  private tick(): void {
    const now = Date.now();
    const sinceLastTick = now - this.lastTickAt;
    this.lastTickAt = now;
    if (this.spanStartedAt === null) return;

    if (sinceLastTick > STALE_TICK_MS) {
      this.closeSpan(now - sinceLastTick);
      this.spanStartedAt = now;
      return;
    }

    const deadline = this.spanStartedAt + MAX_SPAN_MS;
    if (now < deadline) return;
    this.closeSpan(deadline);
    this.spanStartedAt = deadline;
  }

  private closeSpan(at?: number): void {
    const startedAt = this.spanStartedAt;
    if (startedAt === null) return;
    this.spanStartedAt = null;

    const requested = at ?? Date.now();
    const endedAt = Math.min(requested, startedAt + MAX_SPAN_MS);
    const durationMs = endedAt - startedAt;

    if (durationMs < MIN_SPAN_MS) return;

    this.emitAttention({
      eventId: createAttentionEventId(),
      type: 'presence',

      tweetId: '',
      authorHandle: null,
      authorTwitterId: null,
      targetTwitterId: null,
      isPromoted: false,
      truncated: false,
      tsStart: startedAt,
      tsEnd: endedAt,

      dwellMs: durationMs,
      clickKind: null,

      geo: { viewportW: 0, viewportH: 0, scrollY: 0, tweetTop: 0, tweetHeight: 0 },
      pageUrl: sanitizePageUrl(this.doc.location.href),
      tabId: this.tabId,
    });
  }
}
