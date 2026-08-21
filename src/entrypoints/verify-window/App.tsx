
import { Show, createEffect, createSignal, onMount, onCleanup, type Component } from 'solid-js';
import { createVerifyController, resolvePlaceholderTaskId, resultKindForError } from '@/verify/controller';
import { sendVerifyMessage } from '@/verify/messaging';
import { ConsentView, PoweredByPrimus, ProgressView, ResultView } from '@/verify/ui/views';
import { ensureProofHostPermission, permissionHostLabel } from '@/verify/host-permission';
import type { ResultKind } from '@/verify/types';
import { activeProofProgressItem, lastResultItem, sessionItem } from '@/shared/storage';

const VERIFIED_AUTO_CLOSE_MS = 2500;

const RETURN_ACK_DEADLINE_MS = 400;

let ownWindowId: number | undefined;
const controller = createVerifyController({ ownerWindowId: () => ownWindowId });

function verifierIdFromUrl(): string {
  try {
    return new URLSearchParams(window.location.search).get('verifierId') ?? '';
  } catch {
    return '';
  }
}

export const App: Component = () => {
  const c = controller;
  const view = c.view;
  const [missing, setMissing] = createSignal(false);
  const [redirecting, setRedirecting] = createSignal(false);

  const [booted, setBooted] = createSignal(false);
  let rootEl!: HTMLDivElement;

  let autoCloseTimer: ReturnType<typeof setTimeout> | undefined;
  const clearAutoClose = (): void => {
    if (autoCloseTimer === undefined) return;
    clearTimeout(autoCloseTimer);
    autoCloseTimer = undefined;
  };
  onCleanup(clearAutoClose);
  const closeWindow = (): void => {
    clearAutoClose();
    void Promise.race([
      sendVerifyMessage({ action: 'returnFromVerifyWindow', windowId: ownWindowId }).catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, RETURN_ACK_DEADLINE_MS)),
    ]).finally(() => window.close());
  };

  onMount(async () => {
    ownWindowId = (await chrome.windows.getCurrent().catch(() => undefined))?.id;

    const unsubscribeSession = sessionItem.watch(() => {
      setRedirecting(false);
      void c.refresh();
    });
    onCleanup(unsubscribeSession);

    onCleanup(lastResultItem.watch(() => void c.refresh()));
    onCleanup(activeProofProgressItem.watch(() => void c.refresh()));

    const onWindowFocus = (): void => {
      setRedirecting(false);
      void c.refresh();
    };
    window.addEventListener('focus', onWindowFocus);
    onCleanup(() => window.removeEventListener('focus', onWindowFocus));

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = (): void => {
      rootEl.classList.toggle('kv-root--dark', mql.matches);
    };
    applyTheme();
    mql.addEventListener('change', applyTheme);
    onCleanup(() => mql.removeEventListener('change', applyTheme));

    try {
      await c.bootstrap();
      const verifierId = verifierIdFromUrl();

      if (c.state()?.proofProgress) {
        c.showActiveOrHub();
        return;
      }

      const resolvedId = verifierId ? resolvePlaceholderTaskId(verifierId, c.tasks()) : '';
      const task = resolvedId ? c.taskById(resolvedId) : undefined;
      if (task) c.openConsent(task.id);
      else setMissing(true);
    } finally {
      setBooted(true);
    }
  });

  const [permissionNotice, setPermissionNotice] = createSignal<string | undefined>(undefined);

  const startOrRedirect = (taskId: string): void => {
    const guideUrl = c.taskById(taskId)?.verifier?.guide.url;
    if (!guideUrl) {
      if (!c.signedIn()) setRedirecting(true);
      void c.startVerification(taskId);
      return;
    }
    setPermissionNotice(undefined);
    void ensureProofHostPermission(guideUrl).then((outcome) => {
      if (!outcome.ok && outcome.reason === 'denied') {
        setPermissionNotice(
          `Kaito Pulse needs access to ${permissionHostLabel(guideUrl)} to read the data for this ` +
            'verification. Nothing is verified without it — press Continue to allow it.',
        );
        return;
      }
      if (!c.signedIn()) setRedirecting(true);
      void c.startVerification(taskId);
    });
  };

  const kind = () =>
    view().name === 'result'
      ? (view() as Extract<ReturnType<typeof view>, { name: 'result' }>).kind
      : 'failed';

  const ownResult = () => {
    const result = c.state()?.lastResult;
    return result && typeof result.finishedAt === 'number' && result.verifierId === verifierIdFromUrl()
      ? result
      : undefined;
  };
  const ownTask = () => c.taskById(verifierIdFromUrl());
  const finishedKind = (): ResultKind => {
    const error = ownResult()?.error;
    return error ? resultKindForError(error.code) : 'verified';
  };

  const verifiedNow = (): boolean =>
    view().name === 'result'
      ? kind() === 'verified'
      : booted() &&
        !missing() &&
        view().name === 'hub' &&
        ownResult() !== undefined &&
        finishedKind() === 'verified';

  createEffect(() => {
    if (!verifiedNow() || autoCloseTimer !== undefined) return;
    autoCloseTimer = setTimeout(closeWindow, VERIFIED_AUTO_CLOSE_MS);
  });

  return (
    <div class="kv-root kv-panel kv-window-shell" ref={rootEl}>
      {}
      <div class="kv-body">
        <Show when={missing()}>
          <p class="kv-error-text" style={{ 'margin-top': '12px' }}>
            This verification is not available.
          </p>
        </Show>

        <Show when={view().name === 'consent' && c.activeTask()}>
          {(task) => (
            <ConsentView
              notice={permissionNotice()}
              task={task()}
              busy={c.busy()}
              redirecting={redirecting()}
              onCancel={() => closeWindow()}
              onContinue={() => startOrRedirect(task().id)}
            />
          )}
        </Show>

        <Show when={view().name === 'progress'}>
          <ProgressView
            task={c.activeTask()}
            progress={c.state()?.proofProgress}
            cancelRefused={c.cancelRefused()}
            onCancel={() => c.cancelVerification()}
          />
        </Show>

        <Show when={view().name === 'result'}>
          <ResultView
            task={c.activeTask()}
            kind={kind()}
            result={c.state()?.lastResult}
            busy={c.busy()}
            redirecting={redirecting()}
            onRetry={() => {
              const task = c.activeTask();
              if (task) startOrRedirect(task.id);
            }}
            onSeeOtherTasks={() => closeWindow()}
            onDone={() => closeWindow()}
          />
        </Show>

        {}
        <Show when={booted() && !missing() && view().name === 'hub'}>
          <Show
            when={ownResult()}
            fallback={
              <p class="kv-error-text" style={{ 'margin-top': '12px' }}>
                No verification is running. You can close this window.
              </p>
            }
          >
            <ResultView
              task={ownTask()}
              kind={finishedKind()}
              result={ownResult()}
              busy={c.busy()}
              redirecting={redirecting()}
              onRetry={() => {
                const task = ownTask();
                if (task) startOrRedirect(task.id);
              }}
              onSeeOtherTasks={() => closeWindow()}
              onDone={() => closeWindow()}
            />
          </Show>
        </Show>
      </div>

      {}
      <PoweredByPrimus />
    </div>
  );
};
