
import type { BehaviorEvent } from '@/shared/behavior';
import { sendKaitoMessage } from '@/signal/messaging';
import { createLogger } from '@/signal/logger';
import { FLUSH_SIZE_THRESHOLD, FlushScheduler } from '@/lib/flush-scheduler';

export class BehaviorEventBuffer {
  private readonly logger = createLogger('behavior.buffer');
  private queue: BehaviorEvent[] = [];
  private readonly scheduler = new FlushScheduler(() => { void this.flush(); });

  start(): void {
    this.scheduler.start();
  }

  push(event: BehaviorEvent): void {
    if (this.scheduler.disposed) return;
    this.queue.push(event);
    if (this.queue.length >= FLUSH_SIZE_THRESHOLD) void this.flush();
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.queue.length);
    try {
      await sendKaitoMessage({
        target: 'kaitoExtension',
        action: 'recordBehaviorEvents',
        events: batch,
      });
    } catch (error) {
      this.logger.warn('flush failed, dropping batch', error);
    }
  }

  dispose(): void {
    this.scheduler.dispose();
  }
}
