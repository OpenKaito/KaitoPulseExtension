
import { takeAuthIntent } from '@/shared/auth-gate';
import { ownerFocusCallbacks } from '@/shared/owner-focus';
import { sessionItem } from '@/shared/storage';
import { buildConnectUrl } from '@/verify/controller';
import { sendVerifyMessage } from '@/verify/messaging';
import type { AdFlagReason } from './types';
import type { AdFlagStore, AdFlagWriteOutcome } from './store';

export type AdFlagAuthReplay = {
  kind: 'ad-flag-submit' | 'ad-flag-remove';
  tweetId: string;
  outcome: AdFlagWriteOutcome;
  actionToken: number;
};

export async function isSignedIn(): Promise<boolean> {
  return (await sessionItem.getValue()) !== null;
}

export async function requestSignIn(): Promise<void> {
  const url = buildConnectUrl();
  const response = await sendVerifyMessage({ action: 'openSignIn', url });
  if (response?.ok !== true) throw new Error(response?.error || 'open_sign_in_failed');
}

export function watchAdFlagAuthReplay(
  doc: Document,
  store: AdFlagStore,
  getActionToken: () => number,
  onReplay: (replay: AdFlagAuthReplay) => void,
  onError: (error: Error, actionToken: number) => void,
  onIntentMissing: (actionToken: number) => void,
): () => void {
  let active = true;
  let replayInFlight = false;
  let replayArmed = false;
  let windowFocusObserved = false;
  const [isOwnerDocumentFocused, addWindowFocusListener, addVisibilityListener] =
    ownerFocusCallbacks(doc);
  let removeFocusListener: (() => void) | null = null;
  let removeVisibilityListener: (() => void) | null = null;

  const clearFocusListeners = (): void => {
    removeFocusListener?.();
    removeFocusListener = null;
    removeVisibilityListener?.();
    removeVisibilityListener = null;
  };

  const replay = async (): Promise<void> => {
    if (!active || replayInFlight) return;
    replayInFlight = true;
    const actionToken = getActionToken();
    try {
      const submit = await takeAuthIntent('ad-flag-submit');
      if (!active) return;
      if (submit) {
        const tweetId = submit.params.tweetId;
        const reason = submit.params.reason as AdFlagReason | undefined;
        if (!tweetId || !reason) throw new Error('invalid ad-flag submit intent');
        const outcome = await store.putFlag(tweetId, reason);
        if (active) onReplay({ kind: 'ad-flag-submit', tweetId, outcome, actionToken });
        return;
      }

      const remove = await takeAuthIntent('ad-flag-remove');
      if (!active) return;
      if (!remove) {

        onIntentMissing(actionToken);
        return;
      }
      const tweetId = remove.params.tweetId;
      if (!tweetId) throw new Error('invalid ad-flag remove intent');
      const outcome = await store.removeFlag(tweetId);
      if (active) onReplay({ kind: 'ad-flag-remove', tweetId, outcome, actionToken });
    } catch (error) {
      if (active) {
        onError(error instanceof Error ? error : new Error(String(error)), actionToken);
      }
    } finally {
      replayInFlight = false;
      if (active && replayArmed) replayWhenOwnerFocused();
    }
  };

  function replayWhenOwnerFocused(): void {
    if (!active || !replayArmed || replayInFlight) return;
    if (!isOwnerDocumentFocused()) {
      if (!removeFocusListener) removeFocusListener = addWindowFocusListener(onWindowFocus);
      if (!removeVisibilityListener) {
        removeVisibilityListener = addVisibilityListener(onVisibilityChange);
      }
      return;
    }
    replayArmed = false;
    clearFocusListeners();
    void replay();
  }

  function onWindowFocus(): void {
    windowFocusObserved = true;
    replayWhenOwnerFocused();
  }

  function onVisibilityChange(): void {

    if (windowFocusObserved) replayWhenOwnerFocused();
  }

  const unsubscribe = sessionItem.watch((session) => {
    if (!active || !session) return;
    replayArmed = true;
    windowFocusObserved = false;
    replayWhenOwnerFocused();
  });

  return () => {
    active = false;
    replayArmed = false;
    clearFocusListeners();
    unsubscribe();
  };
}
