
import {
  activityInsightsConsentItem,
  attnFingerprintItem,
  attnPendingEventsItem,
  attnPendingServeEventsItem,
} from '@/shared/storage';
import type { AttentionBehaviorEvent, AttentionFingerprint, AttentionServeEvent } from '@/shared/attention';

const MAX_STORAGE_BYTES = 8 * 1024 * 1024;

let writeChain: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeChain.then(fn, fn);
  writeChain = result.catch(() => undefined);
  return result;
}

export function byteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function evictToBudget(
  behaviorEvents: AttentionBehaviorEvent[],
  serveEvents: AttentionServeEvent[],
): { behaviorEvents: AttentionBehaviorEvent[]; serveEvents: AttentionServeEvent[] } {
  let events = behaviorEvents;
  let serves = serveEvents;
  while (byteLength(events) + byteLength(serves) > MAX_STORAGE_BYTES) {
    if (events.length > 0) events = events.slice(1);
    else if (serves.length > 0) serves = serves.slice(1);
    else break;
  }
  return { behaviorEvents: events, serveEvents: serves };
}

export function recordAttentionEvents(
  events: AttentionBehaviorEvent[],
  serveEvents: AttentionServeEvent[],
  fp: AttentionFingerprint,
): Promise<{ ok: true }> {
  return serialize(async () => {
    if ((await activityInsightsConsentItem.getValue()) !== 'granted') return { ok: true };

    await attnFingerprintItem.setValue(fp);
    if (events.length === 0 && serveEvents.length === 0) return { ok: true };
    const [currentEvents, currentServeEvents] = await Promise.all([
      attnPendingEventsItem.getValue(),
      attnPendingServeEventsItem.getValue(),
    ]);
    const merged = evictToBudget(currentEvents.concat(events), currentServeEvents.concat(serveEvents));
    await Promise.all([
      attnPendingEventsItem.setValue(merged.behaviorEvents),
      attnPendingServeEventsItem.setValue(merged.serveEvents),
    ]);
    return { ok: true };
  });
}

export async function peekPendingBatch(
  maxEvents: number,
  maxBytes: number,
): Promise<{ events: AttentionBehaviorEvent[]; serveEvents: AttentionServeEvent[] }> {
  const [events, serveEvents] = await Promise.all([
    attnPendingEventsItem.getValue(),
    attnPendingServeEventsItem.getValue(),
  ]);
  const takenEvents: AttentionBehaviorEvent[] = [];
  let bytes = 0;
  for (const event of events) {
    if (takenEvents.length >= maxEvents) break;
    const size = byteLength(event);
    if (takenEvents.length > 0 && bytes + size > maxBytes) break;
    takenEvents.push(event);
    bytes += size;
  }
  const takenServeEvents: AttentionServeEvent[] = [];
  for (const serveEvent of serveEvents) {
    const size = byteLength(serveEvent);

    if (bytes + size > maxBytes) break;
    takenServeEvents.push(serveEvent);
    bytes += size;
  }
  return { events: takenEvents, serveEvents: takenServeEvents };
}

export function removeSentBatch(sentEventIds: Set<string>, sentServeCount: number): Promise<void> {
  return serialize(async () => {
    const [events, serveEvents] = await Promise.all([
      attnPendingEventsItem.getValue(),
      attnPendingServeEventsItem.getValue(),
    ]);
    await Promise.all([
      attnPendingEventsItem.setValue(events.filter((e) => !sentEventIds.has(e.eventId))),
      attnPendingServeEventsItem.setValue(serveEvents.slice(sentServeCount)),
    ]);
  });
}
