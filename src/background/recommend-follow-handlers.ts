import type { TabMessage } from '@/shared/tab-messages';
import { api } from '@/lib/api';
import { getStoredSession } from '@/lib/client-storage';
import type { FollowFromRecommendationResponse, GetFollowRecommendationsResponse } from '@/shared/messages';
import { pruneLocallyFollowed, type FollowActionReport } from '@/shared/recommend-follow';
import { recommendFollowLocallyFollowedItem } from '@/shared/storage';
import { createLogger } from '@/signal/logger';
import { toAuthedError } from './authed-error';
import { authedCall } from './worker-core';

const logger = createLogger('recommend-follow');

export async function handleGetFollowRecommendations(): Promise<GetFollowRecommendationsResponse> {
  try {
    const result = await authedCall((token) => api.getFollowRecommendations(token));
    return { result };
  } catch (error) {
    return toReadError(error);
  }
}

function toReadError(error: unknown): GetFollowRecommendationsResponse {
  logger.error('getFollowRecommendations error', error);
  return toAuthedError(error, 'recommendations fetch failed');
}

const X_TAB_URL_PATTERNS = ['*://x.com/*', '*://*.x.com/*'];
const TAB_SETTLE_MS = 400;

const TAB_LOAD_TIMEOUT_MS = 15_000;

let relayQueue: Promise<unknown> = Promise.resolve();

export function handleFollowFromRecommendation(
  twitterId: string,
  handle: string,
): Promise<FollowFromRecommendationResponse> {
  const run = relayQueue.then(() => performFollow(twitterId, handle));
  relayQueue = run.catch(() => undefined);
  return run;
}

async function performFollow(
  twitterId: string,
  handle: string,
): Promise<FollowFromRecommendationResponse> {
  try {

    const tabId = await findOrOpenXTab(handle);
    return await sendFollowRequest(tabId, twitterId);
  } catch (error) {
    logger.error(`followFromRecommendation(${handle}) error`, error);
    return { ok: false, error: (error as Error)?.message || 'follow_relay_failed' };
  }
}

function buildFollowTargetUrl(handle: string): string {
  const url = new URL('https://x.com/intent/follow');
  url.searchParams.set('screen_name', handle);
  return url.toString();
}

async function findOrOpenXTab(handle: string): Promise<number> {
  const targetUrl = buildFollowTargetUrl(handle);
  const existing = await chrome.tabs.query({ url: X_TAB_URL_PATTERNS }).catch(() => []);

  const target = existing.find((t) => typeof t.id === 'number' && !t.pinned);
  if (target && typeof target.id === 'number') {
    await chrome.tabs.update(target.id, { url: targetUrl, active: true });
    if (typeof target.windowId === 'number') {
      await chrome.windows.update(target.windowId, { focused: true }).catch(() => undefined);
    }

    await waitForTabComplete(target.id, { skipCompleteCheck: true });
    return target.id;
  }

  const created = await chrome.tabs.create({ url: targetUrl, active: true });
  if (typeof created.id !== 'number') throw new Error('tab_create_failed');
  if (typeof created.windowId === 'number') {
    await chrome.windows.update(created.windowId, { focused: true }).catch(() => undefined);
  }
  await waitForTabComplete(created.id);
  return created.id;
}

function waitForTabComplete(tabId: number, options: { skipCompleteCheck?: boolean } = {}): Promise<void> {
  let onUpdated: (updatedTabId: number, info: { status?: string }) => void = () => undefined;
  let onRemoved: (removedTabId: number) => void = () => undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const removeListeners = (): void => {
    chrome.tabs.onUpdated.removeListener(onUpdated);
    chrome.tabs.onRemoved.removeListener(onRemoved);
  };

  const settled = new Promise<void>((resolve) => {
    const settle = (): void => {
      setTimeout(resolve, TAB_SETTLE_MS);
    };
    onUpdated = (updatedTabId, info) => {
      if (updatedTabId !== tabId || info.status !== 'complete') return;
      removeListeners();
      settle();
    };
    onRemoved = (removedTabId) => {
      if (removedTabId !== tabId) return;
      removeListeners();
      resolve();
    };
    if (options.skipCompleteCheck) {
      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.tabs.onRemoved.addListener(onRemoved);
      return;
    }
    chrome.tabs.get(tabId).then((current) => {
      if (current.status === 'complete') {
        settle();
        return;
      }
      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.tabs.onRemoved.addListener(onRemoved);
    }, resolve);
  });

  const timedOut = new Promise<void>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      removeListeners();
      reject(new Error('tab_navigation_timeout'));
    }, TAB_LOAD_TIMEOUT_MS);
  });

  return Promise.race([settled, timedOut]).finally(() => clearTimeout(timeoutId));
}

async function sendFollowRequest(
  tabId: number,
  twitterId: string,
): Promise<FollowFromRecommendationResponse> {
  try {

    const response = await new Promise<unknown>((resolve, reject) => {
      chrome.tabs.sendMessage(
        tabId,
        { type: 'kaito:followFromRecommendation', twitterId } satisfies TabMessage,
        (reply) => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
            return;
          }
          resolve(reply);
        },
      );
    });
    if (response && typeof response === 'object' && typeof (response as { ok?: unknown }).ok === 'boolean') {
      return response as FollowFromRecommendationResponse;
    }
    return { ok: false, error: 'malformed_relay_response' };
  } catch (error) {

    return { ok: false, error: (error as Error)?.message || 'relay_unreachable' };
  }
}

async function markLocallyFollowed(twitterId: string): Promise<void> {
  const now = Date.now();
  const current = await recommendFollowLocallyFollowedItem.getValue();
  const pruned = pruneLocallyFollowed(current, now);
  pruned[twitterId] = now;
  await recommendFollowLocallyFollowedItem.setValue(pruned);
}

export function registerRecommendationFollowConfirmedHandler(): void {
  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (!message || typeof message !== 'object') return false;
    const { type, twitterId } = message as { type?: unknown; twitterId?: unknown };
    if (type !== 'kaito:followFromRecommendationConfirmed' || typeof twitterId !== 'string') return false;
    markLocallyFollowed(twitterId).catch((error) => {
      logger.error(`markLocallyFollowed(${twitterId}) failed`, error);
    });
    return false;
  });
}

export function registerFollowActionReporter(): void {
  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (!message || typeof message !== 'object') return false;
    const { type, report } = message as { type?: unknown; report?: unknown };
    if (type !== 'kaito:followActionReport' || !isFollowActionReport(report)) return false;
    void reportFollowAction(report);
    return false;
  });
}

async function reportFollowAction(report: FollowActionReport): Promise<void> {
  try {
    const session = await getStoredSession();
    if (!session) return;
    await api.postFollowAction(session.sessionToken, report);
    logger.log(`reported ${report.action} of ${report.targetTwitterId}`);
  } catch (error) {

    logger.warn(`postFollowAction(${report.targetTwitterId}) failed, exclusion falls back to the follow graph`, error);
  }
}

function isFollowActionReport(value: unknown): value is FollowActionReport {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.eventId === 'string' &&
    typeof r.targetTwitterId === 'string' &&
    /^[1-9]\d{0,19}$/.test(r.targetTwitterId) &&
    (r.action === 'follow' || r.action === 'unfollow') &&
    typeof r.occurredAt === 'number' &&
    Number.isFinite(r.occurredAt)
  );
}
