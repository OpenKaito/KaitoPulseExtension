
import { Show, Switch, Match, createSignal, onCleanup, onMount, type Component } from 'solid-js';
import { hostPrefersDark } from '@/signal/host-theme';
import type { VerifyController } from '../controller';
import { DockList, ResultView, SignInGate, SigningInView } from '../ui/views';
import { CloseIcon, GearIcon, GridIcon, KaitoWordmark } from '../ui/icons';
import { SettingsView } from './settings-view';
import type { VerifyTask } from '../types';

export const XPanel: Component<{
  controller: VerifyController;
  variant: 'float' | 'embed';
  onClose: () => void;

  dragHandleRef?: (el: HTMLElement) => void;

  onStartVerify?: (taskId: string) => void;

  onCancelSignIn?: () => void;
}> = (props) => {
  const c = props.controller;
  const view = c.view;
  const isFloat = () => props.variant === 'float';
  const resultKind = () => {
    const current = view();
    return current.name === 'result' ? current.kind : 'failed';
  };

  const onCard = (id: string): void => {
    props.onStartVerify?.(id);
  };

  const SigningInArm: Component = () => (
    <SigningInView
      taskName={c.activeTask()?.meta.displayName}
      onCancel={() => props.onCancelSignIn?.()}
    />
  );

  const ResultArm: Component = () => (
    <ResultView
      task={c.activeTask()}
      kind={resultKind()}
      result={undefined}
      busy={c.busy()}
      onRetry={() => {
        const task = c.activeTask();
        if (task) props.onStartVerify?.(task.id);
      }}
      onSeeOtherTasks={() => c.goHub()}

      onDone={() => c.goHub()}
    />
  );

  const [unbindNotice, setUnbindNotice] = createSignal<{ text: string; tone: 'ok' | 'error' } | undefined>();

  const [unbindingId, setUnbindingId] = createSignal<string | undefined>();
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(noticeTimer));

  const unbind = async (task: VerifyTask): Promise<void> => {
    clearTimeout(noticeTimer);
    setUnbindNotice(undefined);
    setUnbindingId(task.id);
    try {
      const result = await c.unbindPlatform(task.meta.platform);
      setUnbindNotice({
        tone: 'ok',
        text: result.unbound
          ? `${task.meta.displayName} account unlinked. ${result.revokedProofs} verification${result.revokedProofs === 1 ? '' : 's'} removed.`
          : `No linked ${task.meta.displayName} account to unlink.`,
      });
    } catch (error) {

      setUnbindNotice({
        tone: 'error',
        text: `Could not unlink: ${(error as Error)?.message || 'please try again'}`,
      });
    } finally {
      setUnbindingId(undefined);
    }
    noticeTimer = setTimeout(() => setUnbindNotice(undefined), 5000);
  };

  let rootEl!: HTMLDivElement;
  onMount(() => {
    const doc = rootEl.ownerDocument;
    const applyTheme = (): void => {
      rootEl.classList.toggle('kv-root--dark', hostPrefersDark(doc));
    };
    applyTheme();

    const observer = new MutationObserver(applyTheme);
    observer.observe(doc.body, { attributes: true, attributeFilter: ['style', 'class'] });
    onCleanup(() => observer.disconnect());
  });

  return (
    <div class="kv-root kv-panel xpanel-shell" ref={rootEl}>
      <header class="kv-header">
        <div class="kv-header-logo">
          <KaitoWordmark height={15} />
        </div>
        <div class="kv-header-actions">
          <Show when={isFloat()}>
            <button type="button" class="kv-icon-btn" title="Settings" onClick={() => c.openSettings()}>
              <GearIcon />
            </button>
            {}
            <span
              class="kv-icon-btn kv-drag-handle"
              title="Drag to move"
              aria-hidden="true"
              ref={(el) => props.dragHandleRef?.(el)}
            >
              <GridIcon />
            </span>
          </Show>
          <button type="button" class="kv-icon-btn" title="Close" onClick={() => props.onClose()}>
            <CloseIcon />
          </button>
        </div>
      </header>

      {}
      <Show when={props.variant === 'embed'}>
        <div class="kv-body">
          <Switch fallback={
            <DockList
              tasks={c.tasks()}
              signedIn={c.signedIn()}
              verifyingId={c.state()?.proofProgress?.verifierId}
              onRequireLogin={() => c.openSignIn()}
              onOpenTask={onCard}
              onUnbind={(task) => void unbind(task)}
              unbindingTaskId={unbindingId()}
              unbindNotice={unbindNotice()?.text}
              unbindNoticeIsError={unbindNotice()?.tone === 'error'}
            />
          }>
            <Match when={view().name === 'signing-in'}><SigningInArm /></Match>
            <Match when={view().name === 'result'}><ResultArm /></Match>
          </Switch>
        </div>
      </Show>

      {}
      <Show when={isFloat() && (c.ready() || c.bootError())}>
        <Show
          when={c.signedIn()}
          fallback={
            <div class="kv-body" style={{ padding: '0' }}>
              <Switch fallback={<SignInGate onSignIn={() => c.openSignIn()} />}>
                <Match when={view().name === 'signing-in'}><SigningInArm /></Match>
                <Match when={view().name === 'result'}><ResultArm /></Match>
              </Switch>
            </div>
          }
        >
          <div class="kv-body">
            <Switch fallback={
              <>
                <DockList
                  tasks={c.tasks()}
                  verifyingId={c.state()?.proofProgress?.verifierId}
                  onOpenTask={onCard}
                  onUnbind={(task) => void unbind(task)}
                  unbindingTaskId={unbindingId()}
                  unbindNotice={unbindNotice()?.text}
                  unbindNoticeIsError={unbindNotice()?.tone === 'error'}
                />
                <Show when={c.bootError()}>
                  <p class="kv-error-text" style={{ 'margin-top': '12px' }}>{c.bootError()}</p>
                </Show>
              </>
            }>
              <Match when={view().name === 'settings'}>
                <SettingsView onBack={() => c.goHub()} />
              </Match>
              {}
              <Match when={view().name === 'signing-in'}><SigningInArm /></Match>
              <Match when={view().name === 'result'}><ResultArm /></Match>
            </Switch>
          </div>
        </Show>
      </Show>
    </div>
  );
};
