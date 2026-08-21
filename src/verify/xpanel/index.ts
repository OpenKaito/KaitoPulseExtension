
import { render } from 'solid-js/web';
import verifyCss from '../verify.css?inline';
import { cancelAuthIntent, recordAuthIntent, takeAuthIntent } from '@/shared/auth-gate';
import { ownerFocusCallbacks } from '@/shared/owner-focus';
import { createShadowHost } from '@/signal/shared/shadow-host';
import { showCompletionToast } from '@/signal/shared/toast';
import { activeProofProgressItem, lastResultItem, meCacheItem, sessionItem } from '@/shared/storage';
import { type ExternalLastResult, toExternalLastResult } from '@/shared/messages';
import { createVerifyController, type VerifyController } from '../controller';
import { sendVerifyMessage } from '../messaging';
import { XPanel } from './panel';

const SHELL_CSS = `
:host { all: initial; }
/* FLOAT: right-side panel. */
.xpanel-float-wrap {
  position: fixed;
  top: 68px;
  right: 16px;
  width: 363px;
  max-width: calc(100vw - 32px);
  height: 80vh;
  height: 80dvh;
  z-index: 2147483100;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #eff3f4;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.16);
  display: none;
}
.xpanel-float-wrap:has(.kv-root--dark) {
  border-color: #23262c;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.65);
}
.xpanel-float-wrap.open { display: block; }
.xpanel-float-wrap .kv-panel { height: 100%; }
.kv-drag-handle { cursor: grab; }
.kv-drag-handle:active { cursor: grabbing; }
/* No .kv-body overflow override here: verify.css already declares it, and this
   sheet is appended AFTER that one — an equal-specificity duplicate would win on
   source order and silently re-enable body scrolling in the dock's pinned-header
   mode (.kv-body:has(> .kv-dock)). */
`;

class FloatPanel {
  private host: HTMLElement | null = null;
  private wrap: HTMLDivElement | null = null;
  private dispose: (() => void) | null = null;
  private dragHandle: HTMLElement | null = null;
  private dragCleanup: (() => void) | null = null;

  constructor(
    private readonly controller: VerifyController,
    private readonly onStartVerify: (taskId: string) => void,
    private readonly onCancelSignIn: () => void,
  ) {}

  mount(doc: Document): void {
    const { host, shadow } = createShadowHost(verifyCss + SHELL_CSS, 'kaito-verify-float');

    host.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;';
    const wrap = doc.createElement('div');
    wrap.className = 'xpanel-float-wrap';
    shadow.appendChild(wrap);
    this.dispose = render(
      () =>
        XPanel({
          controller: this.controller,
          variant: 'float',
          onClose: () => this.close(),
          dragHandleRef: (el) => this.wireDrag(doc, wrap, el),
          onStartVerify: (id) => this.onStartVerify(id),
          onCancelSignIn: () => this.onCancelSignIn(),
        }),
      wrap,
    );
    doc.body.appendChild(host);
    this.host = host;
    this.wrap = wrap;
  }

  open(): void {
    this.wrap?.classList.add('open');

    this.controller.goHub();
    void this.controller.refresh();
  }

  close(): void {
    this.wrap?.classList.remove('open');
  }

  isOpen(): boolean {
    return this.wrap?.classList.contains('open') ?? false;
  }

  private wireDrag(doc: Document, wrap: HTMLDivElement, handle: HTMLElement): void {
    if (this.dragHandle === handle) return;
    this.dragCleanup?.();
    this.dragHandle = handle;
    const view = doc.defaultView ?? window;
    let startX = 0;
    let startY = 0;
    let baseLeft = 0;
    let baseTop = 0;
    let dragging = false;

    const onMove = (e: PointerEvent): void => {
      if (!dragging) return;
      const w = wrap.offsetWidth;
      const h = wrap.offsetHeight;
      const left = Math.min(Math.max(0, baseLeft + (e.clientX - startX)), view.innerWidth - w);
      const top = Math.min(Math.max(0, baseTop + (e.clientY - startY)), view.innerHeight - h);
      wrap.style.left = `${left}px`;
      wrap.style.top = `${top}px`;
      wrap.style.right = 'auto';
    };
    const onUp = (e: PointerEvent): void => {
      dragging = false;
      try { handle.releasePointerCapture(e.pointerId); } catch {  }
    };
    const onDown = (e: PointerEvent): void => {
      const rect = wrap.getBoundingClientRect();
      baseLeft = rect.left;
      baseTop = rect.top;
      startX = e.clientX;
      startY = e.clientY;
      dragging = true;
      try { handle.setPointerCapture(e.pointerId); } catch {  }
      e.preventDefault();
    };
    handle.addEventListener('pointerdown', onDown);
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    this.dragCleanup = () => {
      handle.removeEventListener('pointerdown', onDown);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
    };
  }

  unmount(): void {
    this.dragCleanup?.();
    this.dragCleanup = null;
    this.dragHandle = null;
    this.dispose?.();
    this.dispose = null;
    this.host?.remove();
    this.host = null;
    this.wrap = null;
  }
}

function toastOpenFailure(kind: 'verification' | 'sign-in'): void {
  showCompletionToast('error', `Could not open ${kind}. Try again.`);
}

class VerifyAuthReplayController {
  private active = true;
  private replayArmed = false;
  private replayInFlight = false;
  private openWindowInFlight = false;
  private ownerWindowFocusObserved = false;
  private removeOwnerFocusListener: (() => void) | null = null;
  private removeOwnerVisibilityListener: (() => void) | null = null;

  constructor(
    private readonly controller: VerifyController,
    private readonly openFloat: () => void,
    private readonly closeFloat: () => void,
    private readonly isPendingSurfaceVisible: () => boolean,
    private readonly isOwnerDocumentFocused: () => boolean,
    private readonly addOwnerWindowFocusListener: (listener: () => void) => () => void,
    private readonly addOwnerVisibilityListener: (listener: () => void) => () => void,
  ) {}

  private readonly openVerifyWindow = async (taskId: string): Promise<void> => {
    const response = await sendVerifyMessage({
      action: 'openVerifyWindow',
      verifierId: taskId,
    });
    if (response.ok !== true) throw new Error(response.error);
  };

  private ownsPendingView(taskId: string): boolean {
    const view = this.controller.view();
    return (
      view.name === 'signing-in' &&
      view.taskId === taskId &&
      this.isPendingSurfaceVisible()
    );
  }

  private showReplayFailure(taskId: string | undefined, hadPending: boolean): void {
    if (taskId && this.ownsPendingView(taskId)) {
      this.controller.showAuthReplayFailure(taskId);
      return;
    }
    const onSigningIn = this.controller.view().name === 'signing-in';
    if (onSigningIn) this.controller.goHub();
    if (hadPending || onSigningIn) {
      toastOpenFailure('verification');
    }
  }

  readonly cancelPendingSignIn = (): void => {
    this.replayArmed = false;
    this.clearOwnerFocusListeners();
    void cancelAuthIntent('verify-start').catch(() => undefined);
    if (this.controller.view().name === 'signing-in') this.controller.goHub();
  };

  readonly startVerify = (taskId: string, openPendingSurface = true): void => {
    if (!this.active) return;
    if (this.controller.signedIn()) {

      if (this.openWindowInFlight) return;
      this.openWindowInFlight = true;

      this.closeFloat();
      void this.openVerifyWindow(taskId)
        .catch(() => {
          if (this.active) toastOpenFailure('verification');
        })
        .finally(() => {
          this.openWindowInFlight = false;
        });
      return;
    }
    if (openPendingSurface) this.openFloat();
    this.controller.showSigningIn(taskId);
    void (async () => {
      try {
        await recordAuthIntent({ kind: 'verify-start', params: { taskId } });
      } catch {

        if (!this.active) return;
        this.controller.goHub();
        this.controller.openSignIn();
        return;
      }
      if (!this.active) return;
      try {
        await this.controller.requestSignIn();
      } catch {

        if (!this.active) return;
        void cancelAuthIntent('verify-start').catch(() => undefined);
        if (this.controller.view().name === 'signing-in') this.controller.goHub();
        toastOpenFailure('sign-in');
      }
    })();
  };

  private clearOwnerFocusListeners(): void {
    this.removeOwnerFocusListener?.();
    this.removeOwnerFocusListener = null;
    this.removeOwnerVisibilityListener?.();
    this.removeOwnerVisibilityListener = null;
  }

  private readonly onOwnerWindowFocus = (): void => {
    this.ownerWindowFocusObserved = true;
    this.replayWhenOwnerFocused();
  };

  private readonly onOwnerVisibilityChange = (): void => {

    if (this.ownerWindowFocusObserved) this.replayWhenOwnerFocused();
  };

  private replayWhenOwnerFocused(): void {
    if (!this.active || !this.replayArmed || this.replayInFlight) return;
    if (!this.isOwnerDocumentFocused()) {
      if (!this.removeOwnerFocusListener) {
        this.removeOwnerFocusListener = this.addOwnerWindowFocusListener(
          this.onOwnerWindowFocus,
        );
      }
      if (!this.removeOwnerVisibilityListener) {
        this.removeOwnerVisibilityListener = this.addOwnerVisibilityListener(
          this.onOwnerVisibilityChange,
        );
      }
      return;
    }

    this.replayArmed = false;
    this.clearOwnerFocusListeners();
    void this.resumeVerifyAfterSignIn();
  }

  readonly armReplayAfterSignIn = (): void => {
    if (!this.active) return;
    this.replayArmed = true;
    this.ownerWindowFocusObserved = false;
    this.replayWhenOwnerFocused();
  };

  private readonly resumeVerifyAfterSignIn = async (): Promise<void> => {
    if (!this.active || this.replayInFlight) return;
    this.replayInFlight = true;
    const pendingView = this.controller.view();
    const pendingTaskId =
      pendingView.name === 'signing-in' ? pendingView.taskId : undefined;
    let replayTaskId = pendingTaskId;

    let hadPending = pendingView.name === 'signing-in';
    try {
      const intent = await takeAuthIntent('verify-start');
      if (!this.active) return;
      const taskId = intent?.params.taskId;
      if (!taskId) {

        if (this.controller.view().name === 'signing-in') {
          this.showReplayFailure(pendingTaskId, true);
        }
        return;
      }
      hadPending = true;
      replayTaskId = taskId;
      await this.openVerifyWindow(taskId);
      if (!this.active) return;
      const ownsPendingView = this.ownsPendingView(taskId);

      if (this.controller.view().name === 'signing-in') {
        if (this.isPendingSurfaceVisible()) this.closeFloat();
        this.controller.goHub();
      }
      if (!ownsPendingView) showCompletionToast('success', 'Verification opened.');
    } catch {
      if (this.active) this.showReplayFailure(replayTaskId, hadPending);
    } finally {
      this.replayInFlight = false;
      if (this.active && this.replayArmed) this.replayWhenOwnerFocused();
    }
  };

  stop(): void {
    this.active = false;
    this.replayArmed = false;
    this.clearOwnerFocusListeners();
  }
}

export class YapsVerifySurface {
  private readonly controller = createVerifyController();
  private readonly float: FloatPanel;
  private readonly authReplay: VerifyAuthReplayController;
  private unsubscribers: Array<() => void> = [];
  private bootstrapPromise: Promise<void> | null = null;

  private pendingRefresh: Promise<void> | null = null;

  private readonly onRuntimeMessage = (
    msg: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: { ok: true }) => void,
  ): void => {
    if (!msg || typeof msg !== 'object') return;
    const message = msg as { type?: string; taskId?: string };
    if (message.type !== 'kaito:openVerifyPanel') return;
    if (message.taskId) {

      const taskId = message.taskId;
      void (this.bootstrapPromise ?? this.controller.bootstrap()).then(() => this.authReplay.startVerify(taskId));
    } else {
      this.float.open();
    }
    sendResponse({ ok: true });
  };

  private readonly onWindowMessage = (event: MessageEvent): void => {
    if (event.source !== this.doc.defaultView) return;
    const data = event.data as { source?: string; kind?: string; requestId?: string; verifierId?: string } | null;
    if (!data || data.source !== 'kaito-web' || typeof data.requestId !== 'string') return;
    const requestId = data.requestId;
    const reply = (payload: unknown): void => {
      this.doc.defaultView?.postMessage({ source: 'kaito-extension', requestId, payload }, event.origin);
    };

    const ready = (this.bootstrapPromise ?? this.controller.bootstrap()).then(() => this.pendingRefresh ?? undefined);
    if (data.kind === 'getVerifyStatus') {
      void ready.then(() => reply(this.buildStatus()));
    } else if (data.kind === 'openVerification' && typeof data.verifierId === 'string') {
      const verifierId = data.verifierId;
      void ready.then(() => { this.authReplay.startVerify(verifierId); reply({ ok: true, opened: true }); });
    }
  };

  private trackRefresh(): Promise<void> {
    const run = this.controller.refresh().finally(() => {
      if (this.pendingRefresh === run) this.pendingRefresh = null;
    });
    this.pendingRefresh = run;
    return run;
  }

  private readonly broadcastVerifyStatusChanged = (): void => {
    try {
      this.doc.defaultView?.postMessage({ source: 'kaito-extension', kind: 'verifyStatusChanged' }, this.doc.defaultView.location.origin);
    } catch {  }
  };

  private buildStatus(): {
    ok: true; installed: true; signedIn: boolean;
    verifiers: Array<{ id: string; name: string; platform: string }>;
    activeVerifierId?: string;
    verifications: Record<string, { verifiedAt: number }>;
    lastResult?: ExternalLastResult;
  } {
    const s = this.controller.state();
    const verifications: Record<string, { verifiedAt: number }> = {};
    for (const [id, proof] of Object.entries(s?.verifications ?? {})) {
      verifications[id] = { verifiedAt: proof.verifiedAt ?? 0 };
    }
    return {
      ok: true,
      installed: true,
      signedIn: this.controller.signedIn(),
      verifiers: (s?.verifiers ?? []).map((v) => ({ id: v.id, name: v.name, platform: v.platform })),
      activeVerifierId: s?.proofProgress?.verifierId,
      verifications,

      lastResult: toExternalLastResult(s?.lastResult),
    };
  }

  constructor(private readonly doc: Document) {
    const focusCallbacks = ownerFocusCallbacks(doc);
    this.authReplay = new VerifyAuthReplayController(
      this.controller,
      () => this.float.open(),
      () => this.float.close(),
      () => this.float.isOpen(),
      ...focusCallbacks,
    );
    this.float = new FloatPanel(
      this.controller,
      this.authReplay.startVerify,
      this.authReplay.cancelPendingSignIn,
    );
  }

  start(): void {
    this.float.mount(this.doc);
    this.bootstrapPromise = this.controller.bootstrap();
    chrome.runtime.onMessage.addListener(this.onRuntimeMessage);

    this.doc.documentElement.setAttribute('data-kaito-signal', '1');
    this.doc.defaultView?.addEventListener('message', this.onWindowMessage);

    try {
      this.doc.defaultView?.postMessage({ source: 'kaito-extension', kind: 'ready' }, this.doc.defaultView.location.origin);
    } catch {  }
    const refresh = () => void this.trackRefresh();

    const refreshAndNotifyPage = () => void this.trackRefresh().then(this.broadcastVerifyStatusChanged);
    const onSession = (session: Awaited<ReturnType<typeof sessionItem.getValue>>): void => {
      refresh();
      if (session) this.authReplay.armReplayAfterSignIn();
    };
    this.unsubscribers = [
      sessionItem.watch(onSession),
      meCacheItem.watch(refresh),
      lastResultItem.watch(refreshAndNotifyPage),
      activeProofProgressItem.watch(refreshAndNotifyPage),
    ];
  }

  stop(): void {
    this.authReplay.stop();
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
    try { chrome.runtime.onMessage.removeListener(this.onRuntimeMessage); } catch {  }
    try { this.doc.defaultView?.removeEventListener('message', this.onWindowMessage); } catch {  }
    this.doc.documentElement.removeAttribute('data-kaito-signal');
    this.float.unmount();
    this.controller.dispose();
    this.bootstrapPromise = null;
  }
}
