
import { behaviorEventsItem } from '@/shared/storage';
import type { BehaviorEvent, BehaviorEventSnapshot } from '@/shared/behavior';

const MAX_EVENTS = 5000;

let writeChain: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeChain.then(fn, fn);
  writeChain = result.catch(() => undefined);
  return result;
}

export function recordBehaviorEvents(batch: BehaviorEvent[]): Promise<{ ok: true }> {
  return serialize(async () => {
    if (batch.length > 0) {
      const current = await behaviorEventsItem.getValue();
      const next = current.concat(batch);
      const trimmed = next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
      await behaviorEventsItem.setValue(trimmed);
    }
    return { ok: true };
  });
}

export function getBehaviorEventSnapshot(): Promise<BehaviorEventSnapshot> {
  return serialize(async () => {
    const entries = await behaviorEventsItem.getValue();
    return { entries: entries.slice().reverse() };
  });
}

export function clearBehaviorEvents(): Promise<BehaviorEventSnapshot> {
  return serialize(async () => {
    await behaviorEventsItem.setValue([]);
    return { entries: [] };
  });
}
