
import type { AttentionBehaviorEvent, AttentionFingerprint, AttentionServeEvent } from '@/shared/attention';
import { normalizeAttentionConfig } from '@/shared/attention';
import { sendKaitoMessage } from '@/signal/messaging';
import { createLogger } from '@/signal/logger';
import { collectFingerprint } from './fingerprint';
import { attnRemoteConfigItem } from '@/shared/storage';
import { FLUSH_SIZE_THRESHOLD, FlushScheduler } from '@/lib/flush-scheduler';

export class AttentionContentBuffer {
  private readonly logger = createLogger('attention.buffer');

  private fp: AttentionFingerprint | undefined;

  private fpPromise: Promise<AttentionFingerprint> | undefined;
  private events: AttentionBehaviorEvent[] = [];
  private serveEvents: AttentionServeEvent[] = [];
  private readonly scheduler = new FlushScheduler(() => { void this.flush(); });

  private collectEnabled = true;
  private serveSetEnabled = true;
  private configUnwatch: (() => void) | undefined;

  private discarded = false;

  start(): void {
    this.fpPromise ??= collectFingerprint().then((fp) => (this.fp = fp));
    this.scheduler.start();
    void attnRemoteConfigItem.getValue().then((config) => this.applyConfig(config));
    this.configUnwatch = attnRemoteConfigItem.watch((config) => this.applyConfig(config));
  }

  private applyConfig(config: Awaited<ReturnType<typeof attnRemoteConfigItem.getValue>>): void {
    if (!config) return;

    const normalized = normalizeAttentionConfig(config);
    this.collectEnabled = normalized.collectEnabled;
    this.serveSetEnabled = normalized.serveSetEnabled;
  }

  pushEvent(event: AttentionBehaviorEvent): void {
    if (this.scheduler.disposed || this.discarded || !this.collectEnabled) return;
    this.events.push(event);
    if (this.events.length >= FLUSH_SIZE_THRESHOLD) void this.flush();
  }

  pushServeEvents(events: AttentionServeEvent[]): void {
    if (this.scheduler.disposed || this.discarded || !this.collectEnabled || !this.serveSetEnabled || events.length === 0) return;
    this.serveEvents.push(...events);
    if (this.serveEvents.length >= FLUSH_SIZE_THRESHOLD) void this.flush();
  }

  async flush(): Promise<void> {
    if (this.discarded) return;
    if (this.events.length === 0 && this.serveEvents.length === 0) return;
    const events = this.events.splice(0, this.events.length);
    const serveEvents = this.serveEvents.splice(0, this.serveEvents.length);
    try {

      const fp = this.fp ?? (await (this.fpPromise ??= collectFingerprint().then((v) => (this.fp = v))));
      await sendKaitoMessage({
        target: 'kaitoExtension',
        action: 'recordAttentionEvents',
        events,
        serveEvents,
        fp,
      });
    } catch (error) {
      this.logger.warn('flush failed, re-queuing batch', error);

      if (!this.scheduler.disposed) {
        this.events.unshift(...events);
        this.serveEvents.unshift(...serveEvents);
      }
    }
  }

  discardPending(): void {
    this.discarded = true;
    this.events.length = 0;
    this.serveEvents.length = 0;
  }

  dispose(): void {
    this.scheduler.dispose(() => this.configUnwatch?.());
  }
}
