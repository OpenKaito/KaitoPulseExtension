
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
import { createAttentionEventId, type AttentionBehaviorEvent, type AttentionEventBatch } from '@/shared/attention';
import { ApiError } from '@/shared/contracts';
import { logDev } from '@/lib/env';

const FLUSH_ALARM = 'attn-upload-flush';
const DEFAULT_FLUSH_PERIOD_SEC = 30;

const MAX_BATCH_BYTES = 1024 * 1024;
const SERVER_MAX_BATCH_EVENTS = 500;

const BATCH_BYTES_SAFETY_MARGIN = 16 * 1024;

const BACKOFF_LADDER_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

let authWatchStarted = false;

let flushStartedAt = 0;
let flushToken = 0;

const FLUSH_STALE_MS = 2 * 60_000;

export function startAttentionUploader(): void {
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: DEFAULT_FLUSH_PERIOD_SEC / 60 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === FLUSH_ALARM) void flushOnce();
  });
  if (!authWatchStarted) {
    authWatchStarted = true;

    sessionItem.watch((session) => {
      if (session) void attnPausedAuthItem.setValue(false);
    });
  }
}

async function flushOnce(): Promise<void> {

  const startedAt = Date.now();
  if (flushStartedAt !== 0 && startedAt - flushStartedAt < FLUSH_STALE_MS) return;
  const token = ++flushToken;
  flushStartedAt = startedAt;
  try {
    await flushOnceInner();
  } finally {

    if (flushToken === token) flushStartedAt = 0;
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

async function flushOnceInner(): Promise<void> {
  if (!(await purgeIfNotConsented())) return;
  if (await attnPausedAuthItem.getValue()) return;
  const cursor = await attnCursorItem.getValue();
  if (Date.now() < cursor.nextRetryAt) return;

  const config = await getAttentionConfig();
  if (!config.collectEnabled || (await isConfigStale())) return;

  const session = await getStoredSession();
  if (!session) return;

  const fp = await attnFingerprintItem.getValue();
  if (!fp) return;

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
  if (events.length === 0 && serveEvents.length === 0) return;

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
