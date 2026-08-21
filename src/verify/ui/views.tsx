
import { For, Show, createEffect, createSignal, onCleanup, onMount, type Component } from 'solid-js';
import type { ProofErrorCode, ProofProgress, ProofRunSummary } from '@/shared/messages';
import { CATEGORY_TABS, dataTypeLabels, tasksInCategory } from '../catalog';
import type { ResultKind, VerifyCategory, VerifyTask } from '../types';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/shared/legal-links';
import { errorDescription, errorHeadline, isRetryPointless } from '../controller';
import {
  AssetIcon,
  CheckIcon,
  ClockCircleIcon,
  DiscordIcon,
  FailCircleIcon,
  KaitoMark,
  KaitoWordmark,
  LockIcon,
  PlatformTile,
  PrimusMark,
  ProofIcon,
  SuccessCircleIcon,
  XLogoIcon,
} from './icons';
import { VERIFY_STEP_IDS, VerifyStepList, type VerifyStep, type VerifyStepId, type VerifyStepState } from './steps';

import signinStar1 from '../assets/signin-star-1.svg?inline';
import signinStar2 from '../assets/signin-star-2.svg?inline';

const OPENING_SIGN_IN_LABEL = 'Opening sign in…';

const VERIFIED_LABEL = '✓ Verified';

export const SignInGate: Component<{ onSignIn: () => void }> = (props) => (
  <div class="kv-signin">
    <div class="kv-signin-stars" aria-hidden="true">
      {}
      <img class="kv-signin-star kv-signin-star-1" src={signinStar1} alt="" />
      <img class="kv-signin-star kv-signin-star-2" src={signinStar2} alt="" />
    </div>
    <div class="kv-signin-logo">
      <KaitoWordmark height={28} />
    </div>
    <div class="kv-signin-bottom">
      <div class="kv-signin-copy">
        <h2 class="kv-signin-title">
          Join The
          <br />
          Yapper Community
        </h2>
        <p class="kv-signin-sub">Discover top content creators from across the industry</p>
      </div>
      <div class="kv-signin-cta-wrap">
        <button type="button" class="kv-signin-cta" onClick={() => props.onSignIn()}>
          Sign in
        </button>
      </div>
    </div>
  </div>
);

export const SigningInView: Component<{ taskName?: string; onCancel?: () => void }> = (props) => (
  <div class="kv-signing-in" role="status" aria-live="polite">
    <span class="kv-spinner" aria-hidden="true" />
    <h3>Waiting for sign-in</h3>
    <p>
      {props.taskName
        ? `We’ll continue ${props.taskName} verification automatically when you return.`
        : 'Return here after sign-in to continue.'}
    </p>
    <Show when={props.onCancel}>
      <button type="button" class="kv-cta-outline kv-signing-in-cancel" onClick={() => props.onCancel?.()}>
        Cancel
      </button>
    </Show>
  </div>
);

const STALE_AFTER_DAYS = 30;

function verifiedAgo(daysSince: number): string {
  const when = daysSince <= 0 ? 'today' : daysSince === 1 ? 'yesterday' : `${daysSince} days ago`;
  return daysSince >= STALE_AFTER_DAYS ? `Verified ${when} · refresh` : `Verified ${when}`;
}

const CardAction: Component<{ task: VerifyTask; verifying: boolean; locked: boolean; onOpen: () => void }> = (props) => {
  const state = () => props.task.status.state;
  return (
    <div class="kv-vcard-cta-wrap">
      <Show
        when={!props.verifying}
        fallback={
          <button type="button" class="kv-vcard-cta" disabled>
            <span class="kv-spinner" aria-hidden="true" /> Verifying…
          </button>
        }
      >
        <Show when={state() === 'available'}>
          <button type="button" class="kv-vcard-cta" disabled={props.locked} onClick={() => props.onOpen()}>
            Participate
          </button>
        </Show>
        <Show when={state() === 'verified'}>
          <button type="button" class="kv-vcard-cta verified" disabled={props.locked} onClick={() => props.onOpen()}>
            {VERIFIED_LABEL}
          </button>
        </Show>
      </Show>
    </div>
  );
};

export const HubList: Component<{
  tasks: VerifyTask[];
  onOpenTask: (taskId: string) => void;

  verifyingId?: string;
}> = (props) => {
  const [category, setCategory] = createSignal<VerifyCategory | 'all'>('all');
  const visible = () => tasksInCategory(props.tasks, category());
  const countFor = (id: VerifyCategory | 'all') => tasksInCategory(props.tasks, id).length;

  return (

    <div class="kv-hublist">
      <div class="kv-tabs" role="tablist">
        <For each={CATEGORY_TABS}>
          {(tab) => (
            <button
              type="button"
              role="tab"
              class="kv-tab"
              classList={{ active: category() === tab.id }}
              aria-selected={category() === tab.id}
              onClick={() => setCategory(tab.id)}
            >
              {tab.label} <span class="kv-tab-count">{countFor(tab.id)}</span>
            </button>
          )}
        </For>
      </div>
      <div class="kv-vcard-list">
        <For each={visible()}>
          {(task) => (

            <div class="kv-vcard" style={{ '--kv-glow': task.meta.tile.bg }}>
              <div class="kv-vcard-head">
                <div class="kv-vcard-id">
                  <PlatformTile meta={task.meta} />
                  <span class="kv-vcard-name">{task.meta.displayName}</span>
                </div>
                <span class="kv-vcard-chip">{task.meta.groupLabel}</span>
              </div>
              <div class="kv-vcard-body">
                <p class="kv-vcard-title">{task.meta.cardTitle}</p>
                <p class="kv-vcard-sub">{task.meta.cardSubtitle}</p>
              </div>
              <CardAction
                task={task}
                verifying={Boolean(props.verifyingId) && task.verifier?.id === props.verifyingId}
                locked={Boolean(props.verifyingId)}
                onOpen={() => props.onOpenTask(task.id)}
              />
              <Show when={task.status.state === 'verified'}>
                <span class="kv-vcard-note">{verifiedAgo((task.status as { daysSince: number }).daysSince)}</span>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

export const Hub: Component<{
  tasks: VerifyTask[];
  busy: boolean;
  onOpenTask: (taskId: string) => void;
}> = (props) => (
  <div>
    <h2 class="kv-hub-title">Verification Hub</h2>
    <HubList tasks={props.tasks} onOpenTask={props.onOpenTask} />
  </div>
);

const ManageCard: Component<{
  task: VerifyTask;
  verifiedOn: string;

  armed: boolean;
  onArm: () => void;
  onDisarm: () => void;

  busy: boolean;

  locked: boolean;
  onUnbind?: (task: VerifyTask) => void;
}> = (props) => {
  return (
    <div class="kv-manage-card" style={{ '--kv-glow': props.task.meta.tile.bg }}>
      <div class="kv-manage-head">
        <div class="kv-vcard-id">
          <PlatformTile meta={props.task.meta} />
          <div class="kv-manage-identity">
            <span class="kv-vcard-name">{props.task.meta.displayName}</span>
            <span class="kv-manage-validity">{props.verifiedOn}</span>
          </div>
        </div>
        <span class="kv-manage-verified">{VERIFIED_LABEL}</span>
      </div>
      <div class="kv-manage-divider" />
      {}
      <Show when={!props.armed}>
        <div class="kv-manage-actions">
          <button type="button" class="kv-manage-remove" disabled={props.locked} onClick={() => props.onArm()}>
            Remove Verification
          </button>
        </div>
      </Show>

      {}
      <Show when={props.armed}>
        <div class="kv-manage-confirm">
          <p class="kv-manage-unbind-warn">
            Unlinking removes every {props.task.meta.displayName} verification on your Kaito account and frees the
            account for someone else to verify. You can only get it back by verifying again.
          </p>
          <div class="kv-manage-actions">
            <button type="button" class="kv-manage-keep" disabled={props.busy} onClick={() => props.onDisarm()}>
              Keep it
            </button>
            <button
              type="button"
              class="kv-manage-remove"
              disabled={props.busy || props.locked}
              onClick={() => props.onUnbind?.(props.task)}
            >
              {props.busy ? 'Removing…' : 'Remove Verification'}
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
};

export const DockList: Component<{
  tasks: VerifyTask[];
  onOpenTask: (taskId: string) => void;
  allLabel?: string;

  signedIn?: boolean;

  onRequireLogin?: () => void;

  verifyingId?: string;

  onUnbind?: (task: VerifyTask) => void;

  unbindingTaskId?: string;
  unbindNotice?: string;

  unbindNoticeIsError?: boolean;
}> = (props) => {
  const [seg, setSeg] = createSignal<'all' | 'mine'>('all');
  const [loginPending, setLoginPending] = createSignal(false);

  const [armedId, setArmedId] = createSignal<string | undefined>();

  let wasUnbinding = false;
  createEffect(() => {
    const active = Boolean(props.unbindingTaskId);
    if (wasUnbinding && !active) setArmedId(undefined);
    wasUnbinding = active;
  });
  const mine = () => props.tasks.filter((t) => t.status.state === 'verified');
  const visible = () => (seg() === 'all' ? props.tasks : mine());

  onMount(() => {
    const onFocus = (): void => {
      setLoginPending(false);
    };
    window.addEventListener('focus', onFocus);
    onCleanup(() => window.removeEventListener('focus', onFocus));
  });

  const selectMine = (): void => {
    if (props.signedIn === false) {
      setLoginPending(true);
      props.onRequireLogin?.();
    } else {
      setLoginPending(false);
      setArmedId(undefined);
      setSeg('mine');
    }
  };

  const verifiedOn = (task: VerifyTask): string => {
    if (task.status.state !== 'verified') return '';
    return `Verified ${new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }).format(new Date(task.status.proof.verifiedAt))}`;
  };

  return (

    <div class="kv-dock">
      <div class="kv-seg" role="tablist">
        <button
          type="button"
          role="tab"
          classList={{ active: seg() === 'all' }}
          aria-selected={seg() === 'all'}
          onClick={() => {
            setArmedId(undefined);
            setSeg('all');
          }}
        >
          {props.allLabel ?? 'All'}
        </button>
        <button
          type="button"
          role="tab"
          classList={{ active: seg() === 'mine' }}
          aria-selected={seg() === 'mine'}
          disabled={loginPending() && props.signedIn === false}
          onClick={selectMine}
        >
          {loginPending() && props.signedIn === false ? OPENING_SIGN_IN_LABEL : 'My Verifications'}
        </button>
      </div>
      <Show when={seg() === 'all'}>
        <div class="kv-cards-caption">
          Pick a task &amp; start earning <span class="count">{visible().length}</span>
        </div>
        <HubList tasks={visible()} onOpenTask={props.onOpenTask} verifyingId={props.verifyingId} />
      </Show>
      <Show when={seg() === 'mine'}>
        <Show when={props.unbindNotice}>
          <p class="kv-manage-notice" classList={{ error: props.unbindNoticeIsError }}>
            {props.unbindNotice}
          </p>
        </Show>
        <div class="kv-manage-list">
          <For each={mine()} fallback={<p class="kv-manage-empty">No verifications yet.</p>}>
            {(task) => (
              <ManageCard
                task={task}
                verifiedOn={verifiedOn(task)}
                armed={armedId() === task.id}
                onArm={() => setArmedId(task.id)}
                onDisarm={() => setArmedId(undefined)}
                busy={Boolean(props.unbindingTaskId) && props.unbindingTaskId === task.id}
                locked={Boolean(props.unbindingTaskId) && props.unbindingTaskId !== task.id}
                onUnbind={props.onUnbind}
              />
            )}
          </For>
        </div>
      </Show>

    </div>
  );
};

const X_PROFILE_URL = 'https://x.com/KaitoAI';
const DISCORD_URL = 'https://discord.gg/kaitoai';

export const HubFooter: Component<{
  signedIn: boolean;

  ready: boolean;
  busy: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}> = (props) => (
  <footer class="kv-footer">
    <div class="kv-footer-links">
      <a href={X_PROFILE_URL} target="_blank" rel="noreferrer noopener" title="Kaito on X" style={{ color: 'inherit' }}>
        <XLogoIcon />
      </a>
      <a href={DISCORD_URL} target="_blank" rel="noreferrer noopener" title="Kaito Discord" style={{ color: 'inherit' }}>
        <DiscordIcon />
      </a>
    </div>
    <Show when={props.ready}>
      <Show
        when={!props.signedIn}
        fallback={
          <button type="button" class="kv-login-btn" disabled={props.busy} onClick={() => props.onSignOut()}>
            Sign out
          </button>
        }
      >
        <button type="button" class="kv-login-btn" onClick={() => props.onSignIn()}>
          <XLogoIcon size={12} /> Login
        </button>
      </Show>
    </Show>
  </footer>
);

const PRIMUS_URL = 'https://primuslabs.xyz';

export const PoweredByPrimus: Component = () => (
  <a class="kv-attribution" href={PRIMUS_URL} target="_blank" rel="noopener noreferrer">
    <PrimusMark size={14} />
    <span>Powered by Primus ↗</span>
  </a>
);

export const ConsentView: Component<{
  task: VerifyTask;
  busy: boolean;
  redirecting?: boolean;

  notice?: string;
  onCancel: () => void;
  onContinue: () => void;
}> = (props) => {
  const meta = () => props.task.meta;
  const dataFields = () => dataTypeLabels(meta().detail.verifies);

  return (
    <div class="kv-consent">
      <div class="kv-consent-scroll">
        <PlatformTile meta={meta()} />
        <div class="kv-consent-head">
          <h3 class="kv-consent-title">Verify your {meta().displayName} account</h3>
          <p class="kv-consent-sub">Verify your {meta().displayName} account to complete this campaign.</p>
        </div>

        {}
        <div class="kv-consent-card">
          <div class="kv-consent-group">
            <div class="kv-consent-group-title">Data we'll verify</div>
            <For each={dataFields()}>
              {(field) => (
                <div class="kv-consent-item">
                  <CheckIcon size={16} />
                  <span>{field}</span>
                </div>
              )}
            </For>
          </div>
        </div>

        <div class="kv-consent-group">
          <div class="kv-consent-group-title">Privacy</div>
          <div class="kv-consent-item"><LockIcon size={16} /><span>Your password is never accessed</span></div>
          <div class="kv-consent-item"><AssetIcon size={16} /><span>Your assets are never moved</span></div>
          {}
          <div class="kv-consent-item">
            <ProofIcon size={16} />
            <span>Only the proof and the fields listed above are shared — not your account contents</span>
          </div>
        </div>

        <div class="kv-consent-how">
          <div class="kv-consent-group-title">How verification works</div>
          <For each={['Read required account data', 'Generate a zkTLS proof', 'Return the proof to Kaito']}>
            {(step, i) => (
              <div class="kv-step">
                <span class="kv-step-num">{i() + 1}</span>
                <span>{step}</span>
              </div>
            )}
          </For>
        </div>
      </div>

      <div class="kv-consent-footer">
        <Show when={props.notice}>
          <p class="kv-consent-notice" role="alert">{props.notice}</p>
        </Show>
        {}
        <p class="kv-consent-legal">
          By continuing, you agree to Kaito's{' '}
          <a class="link" href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer noopener">
            Privacy Policy
          </a>{' '}
          and{' '}
          <a class="link" href={TERMS_OF_SERVICE_URL} target="_blank" rel="noreferrer noopener">
            Terms of Service
          </a>
        </p>
        <div class="kv-consent-actions">
          <button type="button" class="kv-consent-cancel" onClick={() => props.onCancel()}>
            Cancel
          </button>
          <button
            type="button"
            class="kv-consent-continue"
            disabled={props.busy || props.redirecting}
            onClick={() => props.onContinue()}
          >
            {props.redirecting ? OPENING_SIGN_IN_LABEL : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const CampaignDetail: Component<{
  task: VerifyTask;
  busy: boolean;
  onBack: () => void;
  onVerify: () => void;
}> = (props) => {
  const meta = () => props.task.meta;
  const detail = () => meta().detail;
  const canVerify = () => Boolean(props.task.verifier) && !props.busy;
  const ctaLabel = () =>
    meta().kind === 'wallet'
      ? `Connect wallet to verify`
      : `Verify with ${meta().displayName}`;

  return (
    <div>
      <button type="button" class="kv-back" onClick={() => props.onBack()}>
        ← Back
      </button>

      <div class="kv-detail-head">
        <PlatformTile meta={meta()} />
        <div>
          <div class="kv-detail-platform">{meta().displayName}</div>
          <h3 class="kv-detail-title">{meta().cardTitle}</h3>
        </div>
      </div>
      <p class="kv-detail-desc">{props.task.verifier?.guide.message || meta().cardSubtitle}</p>

      <div class="kv-req-card">
        <div class="kv-req-label">Requirement</div>
        <div class="kv-req-value">{detail().requirement}</div>
      </div>

      <div class="kv-meta-card">
        <div class="kv-meta-row">
          <span class="k">Verifies</span>
          {}
          <span class="v">{dataTypeLabels(detail().verifies).join(' · ')}</span>
        </div>
        <div class="kv-meta-row">
          <span class="k">Time</span>
          <span class="v">{detail().time}</span>
        </div>
        <div class="kv-meta-row">
          <span class="k">Validity</span>
          <span class="v">{detail().validity}</span>
        </div>
      </div>

      <div class="kv-earn-card">
        <div class="kv-earn-label">You will earn</div>
        <For each={detail().earn}>{(line) => <div class="kv-earn-item">{line}</div>}</For>
      </div>

      <h4 class="kv-steps-title">Step-by-step</h4>
      <For each={detail().steps}>
        {(step, i) => (
          <div class="kv-step">
            <span class="kv-step-num">{i() + 1}</span>
            <span>{step}</span>
          </div>
        )}
      </For>

      <div class="kv-cta-wrap">
        <button type="button" class="kv-cta" disabled={!canVerify()} onClick={() => props.onVerify()}>
          {ctaLabel()}
        </button>
        <p class="kv-cta-note">
          {props.task.verifier ? detail().footnote : 'This verification is not live yet — the backend verifier is being rolled out.'}
        </p>
      </div>
    </div>
  );
};

const STEP_FOR_STAGE: Record<ProofProgress['stage'], VerifyStepId> = {
  preparing: 'connect',
  opening_page: 'connect',
  reading_data: 'read',
  generating_proof: 'generate',
  submitting: 'generate',
};

const PROGRESS_HEAD_TEXT: Record<VerifyStepId, { title: string; sub: string }> = {
  connect: { title: 'Connecting...', sub: 'This runs automatically — no action needed' },
  read: { title: 'Reading your account data...', sub: 'Keep this page open' },
  generate: { title: 'Generating your proof...', sub: 'Almost done. Usually 30–60s' },
};

function progressStepSub(id: VerifyStepId, state: VerifyStepState, platform: string): string | undefined {
  if (id === 'connect' && state !== 'pending') return `A ${platform} window has opened`;
  if (id === 'generate' && state === 'active')
    return 'Generated locally — your data never leaves this device. Keep this window open.';
  return undefined;
}

const CANCEL_REFUSED_HEAD = {
  title: 'Finishing up...',
  sub: 'Your proof is already with Kaito — this can no longer be canceled',
};

export const ProgressView: Component<{
  task: VerifyTask | undefined;
  progress: ProofProgress | undefined;
  onCancel?: () => void;

  cancelRefused?: boolean;
}> = (props) => {
  const stage = () => props.progress?.stage ?? 'preparing';
  const activeStep = () => STEP_FOR_STAGE[stage()];
  const platform = () => props.task?.meta.displayName ?? 'the platform';
  const head = () => (props.cancelRefused ? CANCEL_REFUSED_HEAD : PROGRESS_HEAD_TEXT[activeStep()]);

  const steps = (): VerifyStep[] => {
    const current = VERIFY_STEP_IDS.indexOf(activeStep());
    return VERIFY_STEP_IDS.map((id, order) => {
      const state: VerifyStepState = order < current ? 'done' : order === current ? 'active' : 'pending';
      return { id, state, sub: progressStepSub(id, state, platform()) };
    });
  };

  return (
    <div class="kv-flow">
      <div class="kv-flow-main">
        <div class="kv-flow-head">
          {}
          <Show
            when={activeStep() === 'connect'}
            fallback={<Show when={props.task}>{(task) => <PlatformTile meta={task().meta} />}</Show>}
          >
            <div class="kv-proof-connect-anim">
              <Show when={props.task}>{(task) => <PlatformTile meta={task().meta} />}</Show>
              <span class="kv-proof-connect-spinner" aria-hidden="true" />
              <span class="kv-proof-kaito-tile"><KaitoMark size={22} /></span>
            </div>
          </Show>
          <div class="kv-flow-copy">
            <h3 class="kv-flow-title">{head().title}</h3>
            <p class="kv-flow-sub">{head().sub}</p>
          </div>
        </div>

        <VerifyStepList steps={steps()} platform={platform()} variant="progress" />
      </div>

      {}
      <Show when={props.onCancel}>
        <div class="kv-flow-footer">
          <div class="kv-flow-actions">
            <button
              type="button"
              class="kv-flow-btn secondary"
              disabled={stage() === 'submitting' || Boolean(props.cancelRefused)}
              onClick={() => props.onCancel?.()}
            >
              Cancel
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
};

type ResultTone = 'ok' | 'warn' | 'fail';

const RESULT_TITLE: Record<ResultKind, string> = {
  verified: 'Verification complete',
  timeout: 'Verification timed out',
  canceled: 'Verification canceled',
  login: 'Verification failed',
  failed: 'Verification failed',
};

const RESULT_TONE: Record<ResultKind, ResultTone> = {
  verified: 'ok',
  timeout: 'warn',
  login: 'warn',
  canceled: 'fail',
  failed: 'fail',
};

const STEP_FOR_ERROR: Partial<Record<ProofErrorCode, VerifyStepId>> = {
  third_party_login_required: 'read',
  target_page_not_ready: 'read',
  target_data_missing: 'read',
  wallet_not_connected: 'read',
  unsupported_account_type: 'read',
  missing_required_data: 'read',
  insufficient_activity: 'read',
  target_api_changed: 'read',
  page_closed: 'read',
  page_interrupted: 'read',
};

export const ResultView: Component<{
  task: VerifyTask | undefined;
  kind: ResultKind;
  result: ProofRunSummary | undefined;
  busy: boolean;
  redirecting?: boolean;
  onRetry: () => void;
  onSeeOtherTasks: () => void;
  onDone?: () => void;
}> = (props) => {

  const name = () => props.task?.meta.displayName ?? 'account';
  const platform = () => props.task?.meta.displayName ?? 'the platform';
  const error = () => props.result?.error;
  const tone = () => RESULT_TONE[props.kind];
  const verified = () => props.kind === 'verified';

  const failedStep = (): VerifyStepId => {
    if (props.kind !== 'failed') return 'read';
    const code = error()?.code;
    return (code && STEP_FOR_ERROR[code]) ?? 'generate';
  };

  const failureMessage = (): string => {
    switch (props.kind) {
      case 'login':
        return `We couldn't read your data. Make sure you're logged in to ${platform()} in the opened window.`;
      case 'timeout':
        return 'This took too long and was stopped. No data was read — you can try again.';
      case 'canceled':
        return `The ${platform()} window closed before your data could be read.`;
      default: {
        const description = errorDescription(error()?.code, name(), error()?.reason || error()?.message);
        const headline = errorHeadline(error()?.code);

        return description === errorDescription(undefined, name()) && headline !== errorHeadline(undefined)
          ? `${headline}. ${description}`
          : description;
      }
    }
  };

  const openedSub = () => `A ${platform()} window has opened`;

  const steps = (): VerifyStep[] => {
    const stoppedAt = verified() ? VERIFY_STEP_IDS.length : VERIFY_STEP_IDS.indexOf(failedStep());
    return VERIFY_STEP_IDS.map((id, order): VerifyStep => {
      if (order < stoppedAt) return { id, state: 'done', sub: id === 'connect' ? openedSub() : undefined };
      if (order === stoppedAt) return { id, state: tone() === 'warn' ? 'warn' : 'error', sub: failureMessage() };
      return { id, state: 'pending' };
    });
  };

  const canRetry = () => !verified() && !isRetryPointless(error()?.code);

  const footerNote = (): string | undefined =>
    verified()
      ? 'Your verified status now shows under My Credentials.'
      : canRetry()
        ? 'No data was shared. You can safely try again.'
        : undefined;

  return (
    <div class="kv-flow">
      <div class="kv-flow-main">
        <div class="kv-flow-head">
          <span class={`kv-flow-mark ${tone()}`}>
            <Show
              when={!verified()}
              fallback={<SuccessCircleIcon size={48} />}
            >
              <Show when={props.kind === 'timeout'} fallback={<FailCircleIcon size={32} />}>
                <ClockCircleIcon size={48} />
              </Show>
            </Show>
          </span>
          <div class="kv-flow-copy">
            <h3 class="kv-flow-title" classList={{ muted: props.kind === 'timeout' }}>
              {RESULT_TITLE[props.kind]}
            </h3>
            {}
            <Show when={props.task}>
              {(task) => (
                <div class="kv-result-pill">
                  <PlatformTile meta={task().meta} />
                  <span class="name">{task().meta.displayName}</span>
                  <span class="state" classList={{ ok: verified() }}>
                    {verified() ? 'Verified' : 'Not verified'}
                  </span>
                </div>
              )}
            </Show>
          </div>
        </div>

        <VerifyStepList steps={steps()} platform={platform()} variant="result" />
      </div>

      <div class="kv-flow-footer">
        <Show when={footerNote()}>
          <p class="kv-flow-note">{footerNote()}</p>
        </Show>
        <div class="kv-flow-actions">
          <button type="button" class="kv-flow-btn secondary" onClick={() => props.onSeeOtherTasks()}>
            {verified() ? 'Verify more' : 'Cancel'}
          </button>
          <Show when={verified()}>
            <button type="button" class="kv-flow-btn primary" onClick={() => (props.onDone ?? props.onSeeOtherTasks)()}>
              Done
            </button>
          </Show>
          <Show when={canRetry()}>
            <button
              type="button"
              class="kv-flow-btn primary"
              disabled={props.busy || props.redirecting}
              onClick={() => props.onRetry()}
            >
              {props.redirecting ? OPENING_SIGN_IN_LABEL : 'Try Again'}
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
};
