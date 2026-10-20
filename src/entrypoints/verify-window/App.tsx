import { Show, createSignal, onMount, onCleanup, type Component } from 'solid-js';
import {
  createVerifyController,
  resolvePlaceholderTaskId,
  resultKindForError,
} from '@/verify/controller';
import { sendVerifyMessage } from '@/verify/messaging';
import { ConsentView, PoweredByPrimus, ProgressView, ResultView } from '@/verify/ui/views';
import { ensureProofHostPermission, permissionHostLabel } from '@/verify/host-permission';
import type { ResultKind } from '@/verify/types';
import { activeProofProgressItem, lastResultItem, sessionItem } from '@/shared/storage';

import { verifySurfaceKey, type VerifySurfaceRequest } from '@/shared/verify-surface';

export const App: Component = () => {
  let ownWindowId: number | undefined;
  const c = createVerifyController({ ownerWindowId: () => ownWindowId });
  onCleanup(c.dispose);
  const [verifierId, setVerifierId] = createSignal('');
  const params = new URLSearchParams(window.location.search);
  const isPopup = params.get('surface') === 'popup';
  const view = c.view;
  const [missing, setMissing] = createSignal(false);
  const [redirecting, setRedirecting] = createSignal(false);

  const [booted, setBooted] = createSignal(false);
  let rootEl!: HTMLDivElement;

  const [surfaceError, setSurfaceError] = createSignal('');
  const closeWindow = (): void => {
    void sendVerifyMessage({ action: 'returnFromVerifyWindow', windowId: ownWindowId })
      .then(async () => {
        if (isPopup) {
          window.close();
          return;
        }
        const sidePanel = chrome.sidePanel as typeof chrome.sidePanel & {
          close?: (options: { windowId: number }) => Promise<void>;
        };
        if (ownWindowId !== undefined && sidePanel.close) {
          await sidePanel.close({ windowId: ownWindowId });
        }
      })
      .catch(() => setSurfaceError('Could not return to your page. Please try again.'));
  };

  const selectRequest = (request?: VerifySurfaceRequest, restoring = false): void => {
    const id = c.state()?.proofProgress?.verifierId ?? request?.verifierId ?? '';
    const resolved = resolvePlaceholderTaskId(id, c.tasks());
    setVerifierId(resolved);
    setMissing(Boolean(id) && !c.taskById(resolved));
    setPermissionNotice(undefined);
    setRedirecting(false);
    if (c.state()?.proofProgress) {
      c.showActiveOrHub();
      return;
    }
    c.goHub();
    const result = c.state()?.lastResult;
    if (
      restoring &&
      result?.verifierId === resolved &&
      result.finishedAt &&
      result.finishedAt >= (request?.requestedAt ?? 0)
    )
      return;
    if (resolved && c.taskById(resolved)) c.openConsent(resolved);
  };

  onMount(() => {
    let disposed = false;
    onCleanup(() => {
      disposed = true;
    });
    onCleanup(
      sessionItem.watch(() => {
        setRedirecting(false);
        void c.refresh();
      }),
    );
    onCleanup(lastResultItem.watch(() => void c.refresh()));
    onCleanup(activeProofProgressItem.watch(() => void c.refresh()));

    const onStorage = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ): void => {
      if (area !== 'session' || ownWindowId === undefined || !booted()) return;
      const change = changes[verifySurfaceKey(ownWindowId)];
      if (change) selectRequest(change.newValue as VerifySurfaceRequest | undefined);
    };
    chrome.storage.onChanged.addListener(onStorage);
    onCleanup(() => chrome.storage.onChanged.removeListener(onStorage));

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

    void (async () => {
      const ownerWindowId = Number(params.get('ownerWindowId'));
      ownWindowId =
        isPopup && Number.isInteger(ownerWindowId) && ownerWindowId > 0
          ? ownerWindowId
          : (await chrome.windows.getCurrent())?.id;
      await c.bootstrap();
      if (disposed || ownWindowId === undefined) return;
      const key = verifySurfaceKey(ownWindowId);
      const stored = await chrome.storage.session.get(key);
      if (disposed) return;
      selectRequest(stored[key] as VerifySurfaceRequest | undefined, true);
      setBooted(true);
    })().catch(() => setSurfaceError('Could not load verification. Please reopen verification.'));
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
    return result && typeof result.finishedAt === 'number' && result.verifierId === verifierId()
      ? result
      : undefined;
  };
  const ownTask = () => c.taskById(verifierId());
  const finishedKind = (): ResultKind => {
    const error = ownResult()?.error;
    return error ? resultKindForError(error.code) : 'verified';
  };

  return (
    <div class="kv-root kv-panel kv-window-shell" ref={rootEl}>
      <div class="kv-body">
        <Show when={surfaceError() || c.bootError()}>
          <p class="kv-error-text" role="alert">
            {surfaceError() || c.bootError()}
          </p>
        </Show>
        <Show when={!booted() && !surfaceError() && !c.bootError()}>
          <p>Loading verification…</p>
        </Show>
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

        <Show when={booted() && !missing() && view().name === 'hub'}>
          <Show
            when={ownResult()}
            fallback={
              <p class="kv-error-text" style={{ 'margin-top': '12px' }}>
                Select Verify in the Verification Hub to start. You can close this side panel at any
                time.
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

      <Show when={ownTask()?.meta.kind !== 'server_read'}>
        <PoweredByPrimus />
      </Show>
    </div>
  );
};
