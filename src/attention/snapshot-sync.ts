
import type { ImpressionTracker } from '@/behavior/impression-tracker';
import { attnOpenSpanSnapshotItem } from '@/shared/storage';
import type { AttentionBehaviorEvent } from '@/shared/attention';
import { createAttentionEventId } from '@/shared/attention';

const SYNC_INTERVAL_MS = 5_000;

export class SnapshotSync {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly impressionTracker: ImpressionTracker) {}

  start(): void {
    this.timer = setInterval(() => { void this.sync(); }, SYNC_INTERVAL_MS);
  }

  private async sync(): Promise<void> {
    const spans = this.impressionTracker.snapshotOpenSpans();
    await attnOpenSpanSnapshotItem.setValue({ spans, lastSeenAt: Date.now() });
  }

  dispose(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    void attnOpenSpanSnapshotItem.removeValue();
  }
}

export async function recoverCrashedSpans(pushEvent: (event: AttentionBehaviorEvent) => void): Promise<void> {
  const snapshot = await attnOpenSpanSnapshotItem.getValue();
  if (!snapshot || snapshot.spans.length === 0) return;
  for (const span of snapshot.spans) {
    pushEvent({
      eventId: createAttentionEventId(),
      type: 'impression',
      tweetId: span.tweetId,
      authorHandle: null,
      authorTwitterId: null,
      targetTwitterId: null,
      isPromoted: false,
      truncated: true,
      tsStart: span.tsStart,
      tsEnd: snapshot.lastSeenAt,
      dwellMs: Math.max(0, snapshot.lastSeenAt - span.tsStart),
      clickKind: null,
      geo: { viewportW: 0, viewportH: 0, scrollY: 0, tweetTop: 0, tweetHeight: 0 },
      pageUrl: '',

      tabId: null,
    });
  }
  await attnOpenSpanSnapshotItem.removeValue();
}
