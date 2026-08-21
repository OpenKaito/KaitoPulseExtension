import type { TabMessage } from '@/shared/tab-messages';
import type { FollowFromRecommendationResponse } from '@/shared/messages';
import { createLogger } from './logger';

const logger = createLogger('follow-relay');

const FIND_CONTROL_TIMEOUT_MS = 5_000;

const CONFIRM_SETTLE_MS = 3_000;

const TWITTER_ID_RE = /^\d+$/;

class FollowRelay {
  private listening = false;
  private readonly onRuntimeMessage = (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: FollowFromRecommendationResponse) => void,
  ): boolean => {
    if (!message || typeof message !== 'object') return false;
    const { type, twitterId } = message as {
      type?: string;
      twitterId?: string;
    };
    if (type !== 'kaito:followFromRecommendation' || typeof twitterId !== 'string') return false;
    if (!TWITTER_ID_RE.test(twitterId)) {
      sendResponse({ ok: false, error: 'invalid_twitter_id' });
      return true;
    }

    watchFollowConfirmation(twitterId).then(
      (result) => {
        const errorSuffix = result.error ? ` error=${result.error}` : '';
        logger.log(`follow click for ${twitterId} resolved: ok=${result.ok}${errorSuffix}`);
        sendResponse(result);
      },
      (error) => {

        logger.error(`follow click for ${twitterId} threw`, error);
        sendResponse({ ok: false, error: 'follow_relay_exception' });
      },
    );
    return true;
  };

  start(): void {
    if (this.listening) return;
    chrome.runtime.onMessage.addListener(this.onRuntimeMessage);
    this.listening = true;
  }

  stop(): void {
    if (!this.listening) return;
    chrome.runtime.onMessage.removeListener(this.onRuntimeMessage);
    this.listening = false;
    for (const watcher of pendingWatchers.values()) watcher.cleanup();
    pendingWatchers.clear();
  }
}

function queryFollowControl(twitterId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-testid="${twitterId}-follow"], [data-testid="${twitterId}-unfollow"]`,
  );
}

const POLL_INTERVAL_MS = 100;

function waitFor(predicate: () => HTMLElement | null, timeoutMs: number): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = (): void => {
      const el = predicate();
      if (el) {
        resolve(el);
        return;
      }
      if (performance.now() - start >= timeoutMs) {
        resolve(null);
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();
  });
}

const pendingWatchers = new Map<string, { control: HTMLElement; cleanup: () => void }>();

function watchForFollowConfirmation(twitterId: string, control: HTMLElement): void {
  const existing = pendingWatchers.get(twitterId);
  if (existing) {
    if (existing.control === control) return;
    existing.cleanup();
  }

  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  const clearSettleTimer = (): void => {
    if (settleTimer === undefined) return;
    clearTimeout(settleTimer);
    settleTimer = undefined;
  };

  const observer = new MutationObserver(() => {
    clearSettleTimer();
    if (control.getAttribute('data-testid') !== `${twitterId}-unfollow`) return;
    settleTimer = setTimeout(() => {
      cleanup();
      notifyFollowConfirmed(twitterId);
    }, CONFIRM_SETTLE_MS);
  });

  const cleanup = (): void => {
    clearSettleTimer();
    observer.disconnect();
    pendingWatchers.delete(twitterId);
  };

  observer.observe(control, { attributes: true, attributeFilter: ['data-testid'] });
  pendingWatchers.set(twitterId, { control, cleanup });
}

function notifyFollowConfirmed(twitterId: string): void {
  chrome.runtime.sendMessage({ type: 'kaito:followFromRecommendationConfirmed', twitterId } satisfies TabMessage).catch((error) => {
    logger.error(`follow confirmation relay for ${twitterId} failed`, error);
  });
}

async function watchFollowConfirmation(twitterId: string): Promise<FollowFromRecommendationResponse> {
  const control = await waitFor(() => queryFollowControl(twitterId), FIND_CONTROL_TIMEOUT_MS);
  if (!control) {

    return { ok: true };
  }

  if (control.getAttribute('data-testid') === `${twitterId}-unfollow`) {
    notifyFollowConfirmed(twitterId);
    return { ok: true };
  }

  watchForFollowConfirmation(twitterId, control);
  return { ok: true };
}

export const followRelay = new FollowRelay();
