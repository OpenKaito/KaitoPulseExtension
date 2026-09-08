import { api } from '@/lib/api';
import { getStoredSession } from '@/lib/client-storage';
import {
  attnCursorItem,
  attnFingerprintItem,
  attnOpenSpanSnapshotItem,
  attnPausedAuthItem,
  attnPendingEventsItem,
  attnPendingServeEventsItem,
  activityInsightsConsentItem,
  deviceFingerprintItem,
  sessionItem,
} from '@/shared/storage';
import { byteLength, peekPendingBatch, removeSentBatch } from './buffer';
import { getAttentionConfig, isConfigStale } from './remote-config';
import {
  createAttentionEventId,
  type AttentionBehaviorEvent,
  type AttentionEventBatch,
} from '@/shared/attention';
import { ApiError } from '@/shared/contracts';
import { logDev } from '@/lib/env';

const FLUSH_ALARM = 'attn-upload-flush';
const DEFAULT_FLUSH_PERIOD_SEC = 30;
// Chrome clamps anything shorter up to this anyway.
const MIN_ALARM_DELAY_MS = DEFAULT_FLUSH_PERIOD_SEC * 1000;
const BLOCKED_RETRY_MS = 5 * 60_000;

const MAX_BATCH_BYTES = 1024 * 1024;
const SERVER_MAX_BATCH_EVENTS = 500;

const BATCH_BYTES_SAFETY_MARGIN = 16 * 1024;

const BACKOFF_LADDER_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

let authWatchStarted = false;

let flushStartedAt = 0;
let flushToken = 0;

const FLUSH_STALE_MS = 2 * 60_000;

// The alarm is one-shot and only exists while there is something to send. A
// standing periodic alarm wakes the worker forever, which keeps the extension
// permanently non-idle and makes Chrome defer a pending update until the browser
// is restarted.
export function startAttentionUploader(): void {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === FLUSH_ALARM) void flushOnce();
  });
  if (!authWatchStarted) {
    authWatchStarted = true;

    sessionItem.watch((session) => {
      if (!session) return;
      void attnPausedAuthItem.setValue(false).then(() => scheduleAttentionFlush());
    });
  }
  void resumePendingFlush();
}

export async function scheduleAttentionFlush(delayMs = MIN_ALARM_DELAY_MS): Promise<void> {
  const delay = Math.max(delayMs, MIN_ALARM_DELAY_MS);
  const existing = await chrome.alarms.get(FLUSH_ALARM);
  if (
    existing &&
    existing.periodInMinutes === undefined &&
    existing.scheduledTime <= Date.now() + delay
  ) {
    return;
  }
  chrome.alarms.create(FLUSH_ALARM, { delayInMinutes: delay / 60_000 });
}

async function resumePendingFlush(): Promise<void> {
  const existing = await chrome.alarms.get(FLUSH_ALARM);
  // Alarms survive an update, so an install coming from 1.0.2 still carries the
  // periodic one this version stopped creating.
  if (existing?.periodInMinutes !== undefined) await chrome.alarms.clear(FLUSH_ALARM);
  if (await hasPendingEvents()) await scheduleAttentionFlush();
}

async function hasPendingEvents(): Promise<boolean> {
  const [events, serveEvents] = await Promise.all([
    attnPendingEventsItem.getValue(),
    attnPendingServeEventsItem.getValue(),
  ]);
  return events.length > 0 || serveEvents.length > 0;
}

async function scheduleNextFlush(outcome: FlushOutcome): Promise<void> {
  if (outcome === 'drained') {
    await chrome.alarms.clear(FLUSH_ALARM);
    return;
  }
  const cursor = await attnCursorItem.getValue();
  const base = outcome === 'blocked' ? BLOCKED_RETRY_MS : MIN_ALARM_DELAY_MS;
  await scheduleAttentionFlush(Math.max(cursor.nextRetryAt - Date.now(), base));
}

type FlushOutcome = 'drained' | 'pending' | 'blocked';

async function flushOnce(): Promise<void> {
  const startedAt = Date.now();
  if (flushStartedAt !== 0 && startedAt - flushStartedAt < FLUSH_STALE_MS) return;
  const token = ++flushToken;
  flushStartedAt = startedAt;
  let outcome: FlushOutcome = 'blocked';
  try {
    outcome = await flushOnceInner();
  } finally {
    if (flushToken === token) flushStartedAt = 0;
    await scheduleNextFlush(outcome);
  }
}

async function purgeIfNotConsented(): Promise<boolean> {
  const consent = await activityInsightsConsentItem.getValue();
  if (consent === 'granted') return true;
  await Promise.all([
    attnPendingEventsItem.setValue([]),
    attnPendingServeEventsItem.setValue([]),
    attnOpenSpanSnapshotItem.removeValue(),

    attnFingerprintItem.removeValue(),
    deviceFingerprintItem.removeValue(),
  ]);
  return false;
}

async function flushOnceInner(): Promise<FlushOutcome> {
  if (!(await purgeIfNotConsented())) return 'drained';
  if (await attnPausedAuthItem.getValue()) return 'blocked';
  const cursor = await attnCursorItem.getValue();
  if (Date.now() < cursor.nextRetryAt) return 'pending';

  const config = await getAttentionConfig();
  if (!config.collectEnabled || (await isConfigStale())) return 'blocked';

  const session = await getStoredSession();
  if (!session) return 'blocked';

  const fp = await attnFingerprintItem.getValue();
  if (!fp) return 'blocked';

  const context = { sessionUrl: '', extVersion: chrome.runtime.getManifest().version, fp };
  const envelope = {
    batchId: createAttentionEventId(),
    schemaVersion: 1 as const,
    sentAt: Date.now(),
    context,
    behaviorEvents: [],
    serveEvents: [],
  };
  const eventBudget = MAX_BATCH_BYTES - BATCH_BYTES_SAFETY_MARGIN - byteLength(envelope);
  const maxEvents = Math.min(config.maxBatchEvents, SERVER_MAX_BATCH_EVENTS);

  const { events, serveEvents } = await peekPendingBatch(maxEvents, eventBudget);
  if (events.length === 0 && serveEvents.length === 0) return 'drained';

  const batch: AttentionEventBatch = {
    ...envelope,
    behaviorEvents: events,
    serveEvents,
  };

  try {
    const response = await api.postAttentionEventBatch(session.sessionToken, batch);

    const accepted = response?.accepted;
    const rejected = response?.rejected;
    if (!Array.isArray(accepted) || !Array.isArray(rejected)) {
      throw new ApiError(0, undefined, 'attention batch: malformed 200 response');
    }
    await reportRejections(rejected, events.length);
    const settledIds = new Set(accepted.concat(rejected.map((r) => r.eventId)));
    await removeSentBatch(settledIds, serveEvents.length);
    await attnCursorItem.setValue({ nextRetryAt: 0, backoffLevel: 0 });
  } catch (error) {
    await handleUploadError(error, events, serveEvents.length);
  }
  return 'pending';
}

async function reportRejections(
  rejected: { eventId: string; reason: string }[],
  sentCount: number,
): Promise<void> {
  if (rejected.length === 0) return;
  const byReason: Record<string, number> = {};
  for (const item of rejected) byReason[item.reason] = (byReason[item.reason] ?? 0) + 1;
  logDev('attention upload rejections', sentCount, byReason);
}

async function handleUploadError(
  error: unknown,
  events: AttentionBehaviorEvent[],
  serveEventCount: number,
): Promise<void> {
  const status = error instanceof ApiError ? error.status : 0;
  if (status === 401) {
    await attnPausedAuthItem.setValue(true);
    logDev('attention upload paused: 401, waiting for re-sign-in');
    return;
  }
  if (status === 400 || status === 413) {
    logDev('attention upload dropped (malformed/oversized batch)', status, events.length);
    await removeSentBatch(new Set(events.map((e) => e.eventId)), serveEventCount);
    await attnCursorItem.setValue({ nextRetryAt: 0, backoffLevel: 0 });
    return;
  }

  const cursor = await attnCursorItem.getValue();
  const delayLevel = Math.min(cursor.backoffLevel, BACKOFF_LADDER_MS.length - 1);
  const nextLevel = Math.min(cursor.backoffLevel + 1, BACKOFF_LADDER_MS.length - 1);
  await attnCursorItem.setValue({
    nextRetryAt: Date.now() + BACKOFF_LADDER_MS[delayLevel],
    backoffLevel: nextLevel,
  });
}
