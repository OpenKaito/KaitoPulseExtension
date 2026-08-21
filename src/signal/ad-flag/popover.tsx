import { createSignal, Switch, Match, type Accessor, type Setter, type JSX } from "solid-js";
import { render } from "solid-js/web";
import { createShadowHost } from "../shared/shadow-host";
import { cancelAuthIntent, recordAuthIntent } from '@/shared/auth-gate';
import { showCompletionToast } from '../shared/toast';
import {
  isSignedIn,
  requestSignIn,
  watchAdFlagAuthReplay,
  type AdFlagAuthReplay,
} from './auth';
import { AD_FLAG_REPORT_REASON } from "./types";
import type { AdFlagStore } from "./store";
import { hostPrefersDark } from "../host-theme";
import { positionFloating } from "../shared/floating-position";
import { attachDismissWatcher } from "../shared/dismiss";
import popoverCss from "./popover.css?inline";

type AdFlagView = 'choose' | 'pending' | 'success' | 'flagged';
type PopoverEntry = { tweetId: string };

const PAID_PARTNERSHIPS_POLICY_URL =
  "https://help.x.com/en/rules-and-policies/paid-partnerships-policy";

const ABANDON_GRACE_MS = 1200;

function PopoverPanel(props: {
  ref: (el: HTMLDivElement) => void;
  view: Accessor<AdFlagView>;
  errorMsg: Accessor<string | null>;
  submitting: Accessor<boolean>;
  onCancel: () => void;
  onConfirm: () => void;
  onGotIt: () => void;
  onRemove: () => void;
}): JSX.Element {
  return (
    <div class="signal-ad-flag-popover" role="dialog" ref={props.ref}>
      <Switch>
        <Match when={props.view() === "choose"}>
          <div class="signal-ad-flag-popover__head">Report a Paid Partnership violation</div>
          <p class="signal-ad-flag-popover__question">
            Does this post appear to contain paid or incentivized promotion without the required
            Paid Partnership disclosure?
          </p>
          <a
            class="signal-ad-flag-popover__policy-link"
            href={PAID_PARTNERSHIPS_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            View X’s Paid Partnerships Policy
          </a>
          <p class="signal-ad-flag-popover__disclaimer">
            Your report will be included in the community count. Kaito has not verified this content.
          </p>
          {props.errorMsg() && <p class="signal-ad-flag-popover__error">{props.errorMsg()}</p>}
          <div class="signal-ad-flag-popover__actions">
            <button
              type="button"
              class="signal-ad-flag-popover__btn signal-ad-flag-popover__btn--secondary"
              onClick={props.onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              class="signal-ad-flag-popover__btn signal-ad-flag-popover__btn--primary"
              disabled={props.submitting()}
              onClick={props.onConfirm}
            >
              Report
            </button>
          </div>
        </Match>
        <Match when={props.view() === 'pending'}>
          <div class="signal-ad-flag-popover__pending" role="status" aria-live="polite">
            <span class="signal-ad-flag-popover__spinner" aria-hidden="true" />
            <div>
              <div class="signal-ad-flag-popover__head signal-ad-flag-popover__head--pending">
                Waiting for sign-in
              </div>
              <p class="signal-ad-flag-popover__pending-copy">
                We’ll finish this action automatically when you return.
              </p>
            </div>
          </div>
        </Match>
        <Match when={props.view() === "success"}>
          <div class="signal-ad-flag-popover__head signal-ad-flag-popover__head--pad">
            Reported successfully. Click the Kaito button again to remove your report
          </div>
          <div class="signal-ad-flag-popover__actions">
            <button
              type="button"
              class="signal-ad-flag-popover__btn signal-ad-flag-popover__btn--primary"
              onClick={props.onGotIt}
            >
              Got it
            </button>
          </div>
        </Match>
        <Match when={props.view() === "flagged"}>
          <div class="signal-ad-flag-popover__head signal-ad-flag-popover__head--pad">
            You've reported this post
          </div>
          {props.errorMsg() && <p class="signal-ad-flag-popover__error">{props.errorMsg()}</p>}
          <div class="signal-ad-flag-popover__actions">
            {}
            <button
              type="button"
              class="signal-ad-flag-popover__btn signal-ad-flag-popover__btn--secondary"
              disabled={props.submitting()}
              onClick={props.onRemove}
            >
              {props.submitting() ? 'Removing…' : 'Remove My Report'}
            </button>
          </div>
        </Match>
      </Switch>
    </div>
  );
}

export class AdFlagPopover {
  private readonly document: Document;
  private readonly window: Window;
  private readonly entries = new WeakMap<HTMLElement, PopoverEntry>();

  private rootEl: HTMLElement | null = null;
  private host: HTMLElement | null = null;
  private dispose: (() => void) | null = null;
  private currentTrigger: HTMLElement | null = null;
  private unsubscribeAuthReplay: (() => void) | null = null;
  private surfaceGeneration = 0;
  private latestActionToken = 0;
  private authRecordChain: Promise<void> = Promise.resolve();
  private pendingActionKind: AdFlagAuthReplay['kind'] | null = null;
  private abandonTimer = 0;
  private destroyed = false;
  private stopDismissWatcher: (() => void) | null = null;

  private readonly store: AdFlagStore;

  private view!: Accessor<AdFlagView>;
  private setView!: Setter<AdFlagView>;
  private errorMsg!: Accessor<string | null>;
  private setErrorMsg!: Setter<string | null>;
  private submitting!: Accessor<boolean>;
  private setSubmitting!: Setter<boolean>;

  constructor(doc: Document = document, store: AdFlagStore) {
    this.document = doc;
    this.window = doc.defaultView ?? window;
    this.store = store;
    [this.view, this.setView] = createSignal<AdFlagView>("choose");
    [this.errorMsg, this.setErrorMsg] = createSignal<string | null>(null);
    [this.submitting, this.setSubmitting] = createSignal(false);
    this.unsubscribeAuthReplay = watchAdFlagAuthReplay(
      this.document,
      this.store,
      () => this.latestActionToken,
      this.onAuthReplay,
      this.onAuthReplayError,
      this.onAuthIntentMissing,
    );

    this.window.addEventListener('focus', this.onOwnerWindowFocus);
  }

  register(trigger: HTMLElement, tweetId: string): void {
    this.entries.set(trigger, { tweetId });
    trigger.addEventListener("click", this.onTriggerClick);
  }

  unregister(trigger: HTMLElement): void {
    trigger.removeEventListener("click", this.onTriggerClick);
    this.entries.delete(trigger);
    if (this.currentTrigger === trigger) this.close();
  }

  private onTriggerClick = (event: Event): void => {

    event.stopPropagation();
    const trigger = event.currentTarget as HTMLElement;
    if (this.currentTrigger === trigger && this.isOpen()) {
      this.dismiss();
      return;
    }
    this.open(trigger);
  };

  private isOpen(): boolean {
    return this.rootEl?.classList.contains("signal-ad-flag-popover--open") ?? false;
  }

  private showView(view: AdFlagView): void {
    this.setView(view);
    this.rootEl?.classList.toggle('signal-ad-flag-popover--flagged', view === 'flagged');
    if (this.currentTrigger && this.rootEl) {
      this.position(this.currentTrigger.getBoundingClientRect());
    }
  }

  private open(trigger: HTMLElement): void {
    const entry = this.entries.get(trigger);
    if (!entry) return;
    this.surfaceGeneration += 1;
    this.ensureElement();

    this.rootEl!.classList.toggle("signal-ad-flag-popover--dark", hostPrefersDark(this.document));
    this.currentTrigger = trigger;
    this.setErrorMsg(null);
    this.setSubmitting(false);

    const initialView = this.store.peek(entry.tweetId)?.myReason != null ? "flagged" : "choose";
    this.showView(initialView);

    this.rootEl!.classList.add("signal-ad-flag-popover--open");
    this.attachDismissListeners();
  }

  private cancelPendingAuthIntent(): void {
    const kind = this.pendingActionKind;
    if (kind === null || this.view() !== 'pending') return;
    this.pendingActionKind = null;
    this.setSubmitting(false);
    this.setView('choose');
    void cancelAuthIntent(kind).catch(() => undefined);
  }

  private close = (): void => {
    this.surfaceGeneration += 1;
    if (!this.rootEl) return;
    this.rootEl.classList.remove("signal-ad-flag-popover--open");
    this.currentTrigger = null;
    this.detachDismissListeners();
  };

  private dismiss = (): void => {
    this.cancelPendingAuthIntent();
    this.close();
  };

  private readonly onOwnerWindowFocus = (): void => {
    if (this.pendingActionKind === null || this.view() !== 'pending') return;

    this.window.clearTimeout(this.abandonTimer);
    this.abandonTimer = this.window.setTimeout(() => {
      void this.dropIntentIfSignInAbandoned();
    }, ABANDON_GRACE_MS);
  };

  private async dropIntentIfSignInAbandoned(): Promise<void> {
    if (this.destroyed) return;
    if (this.pendingActionKind === null || this.view() !== 'pending') return;
    if (await isSignedIn()) return;
    if (this.destroyed) return;
    if (this.pendingActionKind === null || this.view() !== 'pending') return;

    this.cancelPendingAuthIntent();
  }

  private cancel = (): void => {
    this.dismiss();
  };

  private beginAction(kind: AdFlagAuthReplay['kind']): {
    actionToken: number;
    surfaceGeneration: number;
  } {
    const actionToken = ++this.latestActionToken;
    const surfaceGeneration = ++this.surfaceGeneration;
    this.pendingActionKind = kind;
    this.setSubmitting(true);
    return { actionToken, surfaceGeneration };
  }

  private ownsAction(
    trigger: HTMLElement,
    tweetId: string,
    surfaceGeneration: number,
  ): boolean {
    return (
      this.surfaceGeneration === surfaceGeneration &&
      this.isOpen() &&
      this.currentTrigger === trigger &&
      this.entries.get(trigger)?.tweetId === tweetId
    );
  }

  private finishAction(
    trigger: HTMLElement,
    tweetId: string,
    surfaceGeneration: number,
  ): boolean {
    if (!this.ownsAction(trigger, tweetId, surfaceGeneration)) return false;
    this.setSubmitting(false);
    return true;
  }

  private isLatestAction(actionToken: number): boolean {
    return !this.destroyed && this.latestActionToken === actionToken;
  }

  private recordAuthIntentForAction(
    actionToken: number,
    intent: Parameters<typeof recordAuthIntent>[0],
  ): Promise<boolean> {
    const result = this.authRecordChain.then(async () => {
      if (!this.isLatestAction(actionToken)) return false;
      await recordAuthIntent(intent);
      return this.isLatestAction(actionToken);
    });
    this.authRecordChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private showActionError(
    actionToken: number,
    surfaceGeneration: number,
    trigger: HTMLElement,
    tweetId: string,
    fallbackView: 'choose' | 'flagged',
    message = 'Something went wrong. Try again.',
  ): void {
    if (!this.isLatestAction(actionToken)) return;
    this.pendingActionKind = null;
    if (this.finishAction(trigger, tweetId, surfaceGeneration)) {
      this.setErrorMsg(message);
      this.showView(fallbackView);
    } else {
      this.setSubmitting(false);
      showCompletionToast('error', message);
    }
  }

  private async recordAndRequestSignIn(
    actionToken: number,
    surfaceGeneration: number,
    trigger: HTMLElement,
    tweetId: string,
    fallbackView: 'choose' | 'flagged',
    intent: Parameters<typeof recordAuthIntent>[0],
  ): Promise<void> {
    if (!this.isLatestAction(actionToken)) return;
    try {
      const recordedLatest = await this.recordAuthIntentForAction(actionToken, intent);
      if (!recordedLatest) return;
      if (this.finishAction(trigger, tweetId, surfaceGeneration)) {
        this.showView('pending');
      } else {
        this.setSubmitting(false);
      }
      if (!this.isLatestAction(actionToken)) return;
      try {
        await requestSignIn();
      } catch {

        if (!this.isLatestAction(actionToken)) return;
        void cancelAuthIntent(intent.kind).catch(() => undefined);
        this.showActionError(
          actionToken,
          surfaceGeneration,
          trigger,
          tweetId,
          fallbackView,
          'Could not open sign-in. Try again.',
        );
      }
    } catch {

      void requestSignIn().catch(() => undefined);
      this.showActionError(
        actionToken,
        surfaceGeneration,
        trigger,
        tweetId,
        fallbackView,
        'Sign in, then try again.',
      );
    }
  }

  private confirm = (): void => {
    const trigger = this.currentTrigger;
    const entry = trigger ? this.entries.get(trigger) : undefined;

    const reason = AD_FLAG_REPORT_REASON;
    if (!trigger || !entry || this.submitting()) return;
    const { actionToken, surfaceGeneration } = this.beginAction('ad-flag-submit');
    this.setErrorMsg(null);
    void (async () => {
      try {
        const signedIn = await isSignedIn();
        if (!this.isLatestAction(actionToken)) return;
        if (!signedIn) {
          await this.recordAndRequestSignIn(
            actionToken,
            surfaceGeneration,
            trigger,
            entry.tweetId,
            'choose',
            {
              kind: 'ad-flag-submit',
              params: { tweetId: entry.tweetId, reason },
            },
          );
          return;
        }
        const outcome = await this.store.putFlag(entry.tweetId, reason);
        if (!this.isLatestAction(actionToken)) return;
        if (!outcome.ok) {
          if (outcome.status === 401) {
            await this.recordAndRequestSignIn(
              actionToken,
              surfaceGeneration,
              trigger,
              entry.tweetId,
              'choose',
              {
                kind: 'ad-flag-submit',
                params: { tweetId: entry.tweetId, reason },
              },
            );
            return;
          }
          this.pendingActionKind = null;
          if (!this.finishAction(trigger, entry.tweetId, surfaceGeneration)) return;
          this.setErrorMsg(this.replayErrorMessage(outcome));
          return;
        }
        this.pendingActionKind = null;
        if (this.finishAction(trigger, entry.tweetId, surfaceGeneration)) {
          this.showView('success');
        }
      } catch {
        this.showActionError(
          actionToken,
          surfaceGeneration,
          trigger,
          entry.tweetId,
          'choose',
        );
      }
    })();
  };

  private gotIt = (): void => {
    this.close();
  };

  private remove = (): void => {
    const trigger = this.currentTrigger;
    const entry = trigger ? this.entries.get(trigger) : undefined;
    if (!trigger || !entry || this.submitting()) return;
    const { actionToken, surfaceGeneration } = this.beginAction('ad-flag-remove');
    this.setErrorMsg(null);
    void (async () => {
      try {
        const outcome = await this.store.removeFlag(entry.tweetId);
        if (!this.isLatestAction(actionToken)) return;
        if (!outcome.ok) {
          if (outcome.status === 401) {
            await this.recordAndRequestSignIn(
              actionToken,
              surfaceGeneration,
              trigger,
              entry.tweetId,
              'flagged',
              {
                kind: 'ad-flag-remove',
                params: { tweetId: entry.tweetId },
              },
            );
            return;
          }
          this.pendingActionKind = null;
          if (!this.finishAction(trigger, entry.tweetId, surfaceGeneration)) return;
          this.setErrorMsg(this.replayErrorMessage(outcome));
          this.showView('flagged');
          return;
        }
        this.pendingActionKind = null;
        if (this.finishAction(trigger, entry.tweetId, surfaceGeneration)) this.close();
      } catch {
        this.showActionError(
          actionToken,
          surfaceGeneration,
          trigger,
          entry.tweetId,
          'flagged',
        );
      }
    })();
  };

  private replayErrorMessage(outcome: AdFlagAuthReplay['outcome']): string {
    return !outcome.ok && outcome.status === 429
      ? 'Too many actions. Try again later.'
      : 'Something went wrong. Try again.';
  }

  private onAuthReplay = (replay: AdFlagAuthReplay): void => {
    if (replay.actionToken !== this.latestActionToken) {
      if (replay.outcome.ok) {
        showCompletionToast(
          'success',
          replay.kind === 'ad-flag-submit' ? 'Report submitted.' : 'Report removed.',
        );
      } else {
        showCompletionToast('error', this.replayErrorMessage(replay.outcome));
      }
      return;
    }
    this.pendingActionKind = null;
    const currentEntry = this.currentTrigger ? this.entries.get(this.currentTrigger) : undefined;
    const ownsPendingView =
      this.isOpen() &&
      this.view() === 'pending' &&
      currentEntry?.tweetId === replay.tweetId;

    if (replay.outcome.ok) {
      if (ownsPendingView) {
        if (replay.kind === 'ad-flag-submit') this.showView('success');
        else this.close();
      } else {
        showCompletionToast(
          'success',
          replay.kind === 'ad-flag-submit' ? 'Report submitted.' : 'Report removed.',
        );
      }
      return;
    }

    const message = this.replayErrorMessage(replay.outcome);
    if (ownsPendingView) {
      this.setErrorMsg(message);
      this.showView(replay.kind === 'ad-flag-submit' ? 'choose' : 'flagged');
    } else {
      showCompletionToast('error', message);
    }
  };

  private onAuthIntentMissing = (actionToken: number): void => {
    if (this.pendingActionKind === null || this.view() !== 'pending') return;
    this.onAuthReplayError(new Error('auth_intent_lost'), actionToken);
  };

  private onAuthReplayError = (_error: Error, actionToken: number): void => {

    const kind = this.pendingActionKind;
    if (kind === null || this.view() !== 'pending') return;
    this.pendingActionKind = null;
    const currentEntry = this.currentTrigger ? this.entries.get(this.currentTrigger) : undefined;
    const ownsPendingView =
      actionToken === this.latestActionToken &&
      this.isOpen() &&
      currentEntry !== undefined;
    const message = 'Something went wrong. Try again.';
    this.setSubmitting(false);
    if (ownsPendingView) {
      this.setErrorMsg(message);
      this.showView(kind === 'ad-flag-submit' ? 'choose' : 'flagged');
    } else {

      showCompletionToast('error', message);
    }
  };

  private ensureElement(): HTMLElement {
    if (this.rootEl) return this.rootEl;
    const { host, shadow } = createShadowHost(popoverCss);
    this.dispose = render(
      () => (
        <PopoverPanel
          ref={(el) => (this.rootEl = el)}
          view={this.view}
          errorMsg={this.errorMsg}
          submitting={this.submitting}
          onCancel={this.cancel}
          onConfirm={this.confirm}
          onGotIt={this.gotIt}
          onRemove={this.remove}
        />
      ),
      shadow,
    );
    this.document.body.appendChild(host);
    this.host = host;
    return this.rootEl!;
  }

  private position(triggerRect: DOMRect): void {
    const root = this.rootEl;
    if (!root) return;
    const { left, top } = positionFloating(
      triggerRect,
      { width: root.offsetWidth, height: root.offsetHeight },
      this.window,
    );
    root.style.left = `${Math.round(left)}px`;
    root.style.top = `${Math.round(top)}px`;
  }

  private attachDismissListeners(): void {
    this.stopDismissWatcher = attachDismissWatcher(this.window, this.document, () => this.rootEl, {
      onOutsideClick: (event) => {
        if (!this.isOpen()) return;
        if (this.currentTrigger && event.composedPath().includes(this.currentTrigger)) return;
        this.dismiss();
      },
      onScroll: () => this.close(),
      onResize: () => this.close(),
    });
  }

  private detachDismissListeners(): void {
    this.stopDismissWatcher?.();
    this.stopDismissWatcher = null;
  }

  destroy(): void {

    this.destroyed = true;
    this.surfaceGeneration += 1;
    this.window.clearTimeout(this.abandonTimer);
    this.window.removeEventListener('focus', this.onOwnerWindowFocus);
    this.detachDismissListeners();
    this.unsubscribeAuthReplay?.();
    this.unsubscribeAuthReplay = null;
    this.dispose?.();
    if (this.host) {
      this.host.remove();
      this.host = null;
    }
    this.rootEl = null;
    this.currentTrigger = null;
  }
}
