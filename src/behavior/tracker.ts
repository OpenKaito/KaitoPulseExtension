
import { BehaviorEventBuffer } from './buffer';
import { ImpressionTracker } from './impression-tracker';
import { ClickTracker } from './click-tracker';
import { FollowTracker } from './follow-tracker';
import { PresenceTracker } from './presence-tracker';
import { activityInsightsConsentItem, viewerItem } from '@/shared/storage';
import { guard } from '@/lib/guard';
import type { BehaviorActor, BehaviorEvent } from '@/shared/behavior';
import type { AttentionBehaviorEvent } from '@/shared/attention';
import { AttentionContentBuffer } from '@/attention/content-buffer';
import { IdleDetector } from '@/attention/idle-detector';
import { startRouteWatcher } from '@/attention/route-watcher';
import { SnapshotSync, recoverCrashedSpans } from '@/attention/snapshot-sync';
import { startServeSetListener } from '@/attention/serve-set-map';
import { reportFollowAction } from './follow-report';

export class BehaviorTracker {
  private readonly buffer = new BehaviorEventBuffer();
  private readonly attentionBuffer = new AttentionContentBuffer();
  private readonly idleDetector = new IdleDetector();
  private readonly impressionTracker: ImpressionTracker;
  private readonly clickTracker: ClickTracker;
  private readonly followTracker: FollowTracker;
  private readonly presenceTracker: PresenceTracker;
  private readonly snapshotSync: SnapshotSync;
  private readonly onVisibilityChange: () => void;
  private currentActor: BehaviorActor = { twitterId: null, handle: null };
  private actorUnwatch: (() => void) | undefined;
  private stopRouteWatcher: (() => void) | undefined;
  private stopServeSetListener: (() => void) | undefined;

  private stopped = false;

  private armed = false;

  private consentGranted = false;
  private consentUnwatch: (() => void) | undefined;

  constructor(private readonly doc: Document) {
    const getActor = (): BehaviorActor => this.currentActor;
    const emit = (event: BehaviorEvent) => this.buffer.push(event);

    const emitAttention = (event: AttentionBehaviorEvent) => {
      this.attentionBuffer.pushEvent(event);
      if (event.type === 'follow' || event.type === 'unfollow') reportFollowAction(event);
    };
    this.impressionTracker = new ImpressionTracker(getActor, emit, emitAttention);
    this.clickTracker = new ClickTracker(doc, getActor, emit, emitAttention);
    this.followTracker = new FollowTracker(doc, getActor, emit, emitAttention);

    this.presenceTracker = new PresenceTracker(doc, emitAttention);
    this.snapshotSync = new SnapshotSync(this.impressionTracker);
    this.onVisibilityChange = guard(() => {

      this.presenceTracker.setVisible(this.doc.visibilityState !== 'hidden');
      if (this.doc.visibilityState === 'hidden') {
        this.impressionTracker.flushAllOpenSpans();
      } else {

        this.impressionTracker.rearmVisibleSpans();
      }
    }, 'behavior.visibilitychange');
  }

  start(): void {
    void this.startAsync();
  }

  private async startAsync(): Promise<void> {
    await this.awaitConsentGranted();
    if (this.stopped) return;

    await recoverCrashedSpans((event) => this.attentionBuffer.pushEvent(event));

    if (this.stopped) return;

    this.armed = true;
    this.buffer.start();
    this.attentionBuffer.start();
    this.snapshotSync.start();
    this.clickTracker.start();
    this.followTracker.start();
    this.presenceTracker.start();
    this.doc.addEventListener('visibilitychange', this.onVisibilityChange);
    this.idleDetector.start((idle) => {
      this.impressionTracker.setIdle(idle);
      this.presenceTracker.setIdle(idle);
    });
    this.stopRouteWatcher = startRouteWatcher(() => this.impressionTracker.flushAllOpenSpans());
    this.stopServeSetListener = startServeSetListener((events) => {
      this.attentionBuffer.pushServeEvents(events);
    });
    void this.refreshActor();
    this.actorUnwatch = viewerItem.watch(() => void this.refreshActor());
  }

  private awaitConsentGranted(): Promise<void> {
    return new Promise((resolve) => {
      this.consentUnwatch = activityInsightsConsentItem.watch((value) => {
        this.onConsentValue(value, resolve);
      });
      void activityInsightsConsentItem.getValue().then((initial) => {
        if (this.stopped) return;

        if (initial === 'granted') this.onConsentValue(initial, resolve);
      });
    });
  }

  private onConsentValue(value: 'unset' | 'granted' | 'declined', resolve: () => void): void {
    if (value === 'granted') {
      this.consentGranted = true;
      resolve();
      return;
    }

    this.consentGranted = false;

    if (!this.armed || this.stopped) return;
    this.stopAndDiscard();
  }

  stopAndDiscard(): void {
    if (this.stopped) return;

    this.attentionBuffer.discardPending();

    this.snapshotSync.dispose();
    this.stop();
  }

  onArticleSwept = (article: HTMLElement): void => {
    if (this.consentGranted) this.impressionTracker.watch(article);
  };

  private async refreshActor(): Promise<void> {
    const viewer = await viewerItem.getValue();
    this.currentActor = { twitterId: viewer?.id ?? null, handle: viewer?.handle ?? null };
  }

  flushForUnload(): void {
    if (this.stopped) return;
    this.impressionTracker.flushAllOpenSpans();

    this.presenceTracker.flushOpenSpan();
    void this.buffer.flush();
    void this.attentionBuffer.flush();
    this.snapshotSync.dispose();
  }

  stop(): void {
    this.stopped = true;
    this.consentUnwatch?.();
    this.impressionTracker.flushAllOpenSpans();

    this.presenceTracker.stop();
    this.buffer.dispose();
    this.attentionBuffer.dispose();
    this.snapshotSync.dispose();
    this.impressionTracker.dispose();
    this.clickTracker.stop();
    this.followTracker.stop();
    this.idleDetector.stop();
    this.stopRouteWatcher?.();
    this.stopServeSetListener?.();
    this.doc.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.actorUnwatch?.();
  }
}
