
import { createMemo, createSignal } from 'solid-js';
import type { ProofErrorCode, WorkerState } from '@/shared/messages';
import type {
  ExtensionMeResponse,
  ExtensionProof,
  ExtensionVerifier,
  PlatformBinding,
} from '@/shared/contracts';
import { ENV } from '@/lib/env';
import { meCacheItem, sessionItem, verifySnapshotItem } from '@/shared/storage';
import { buildTasks, statusFor, statusEquals } from './catalog';
import type { ResultKind, VerifyTask } from './types';
import { sendVerifyMessage } from './messaging';

export type VerifyView =
  | { name: 'hub' }
  | { name: 'detail'; taskId: string }
  | { name: 'consent'; taskId: string }
  | { name: 'progress'; taskId: string }
  | { name: 'result'; taskId: string; kind: ResultKind }
  | { name: 'signing-in'; taskId?: string }
  | { name: 'settings' };

export function resultKindForError(code: ProofErrorCode | undefined): ResultKind {
  switch (code) {
    case 'timeout':
      return 'timeout';
    case 'page_closed':
    case 'page_interrupted':
      return 'canceled';

    case 'third_party_login_required':
    case 'target_page_not_ready':
      return 'login';
    default:
      return 'failed';
  }
}

export function errorHeadline(code: ProofErrorCode | undefined): string {
  switch (code) {
    case 'sign_in_required':
      return 'Sign in required';
    case 'session_invalid':
      return 'Session expired';
    case 'third_party_login_required':
      return 'Platform login required';
    case 'timeout':
      return 'Verification Timed Out';
    case 'page_closed':
    case 'page_interrupted':
      return 'Verification canceled';
    case 'duplicate_proof':
      return 'Duplicate proof';
    case 'platform_account_already_claimed':
      return 'Account already linked';
    case 'platform_account_id_missing':
      return 'Account could not be identified';
    case 'security_check_failed':
      return 'Security check failed';
    case 'network_error':
      return 'Network error';

    case 'wallet_not_connected':
      return 'Connect wallet required';
    case 'unsupported_account_type':
      return 'Account type not supported';
    case 'missing_required_data':
      return 'Required account data missing';
    case 'insufficient_activity':
      return 'Insufficient account activity';
    case 'target_api_changed':
      return 'Platform data changed';
    case 'target_page_not_ready':
      return 'Open the required platform page';
    case 'proof_capture_failed':
      return 'Proof capture failed';
    case 'proof_engine_stalled':
      return 'Proof generation stalled';
    default:
      return 'Verification Failed';
  }
}

export function errorDescription(
  code: ProofErrorCode | undefined,
  platformName: string,

  reason?: string,
): string {
  switch (code) {
    case 'platform_account_already_claimed':
      return `This ${platformName} account is already linked to another Kaito account. Unlink it there first, or verify with a different ${platformName} account.`;
    case 'platform_account_id_missing':
      return `We couldn't read an account identifier from ${platformName}, so this verification can't be linked to your Kaito account. This is on our side — please report it.`;
    case 'unsupported_account_type':

      return reason?.includes('x_analytics_requires_premium')
        ? `X Premium is required to verify account analytics — X only exposes this data to Premium accounts. Subscribe on X, then retry.`
        : `Unable to verify your ${platformName} account. Please make sure you're logged in and try again.`;
    default:
      return `Unable to verify your ${platformName} account. Please make sure you're logged in and try again.`;
  }
}

export function isRetryPointless(code: ProofErrorCode | undefined): boolean {
  return code === 'platform_account_already_claimed' || code === 'platform_account_id_missing';
}

const PLATFORM_PLACEHOLDER_PREFIX = 'platform:';

export function resolvePlaceholderTaskId(id: string, tasks: VerifyTask[]): string {
  if (!id.startsWith(PLATFORM_PLACEHOLDER_PREFIX)) return id;
  const platform = id.slice(PLATFORM_PLACEHOLDER_PREFIX.length);
  const live = tasks.find((t) => t.meta.platform === platform && t.verifier);
  return live?.id ?? id;
}

export function buildConnectUrl(): string {
  try {
    const url = new URL(ENV.connectOrigin);
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('extensionId', chrome.runtime.id);
    return url.toString();
  } catch {
    return `${ENV.connectOrigin}/login`;
  }
}

export function buildVerificationHubUrl(): string {
  try {
    const url = new URL(ENV.connectOrigin);
    url.pathname = '/verification-hub';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return ENV.connectOrigin;
  }
}

export function buildLinkTwitterUrl(): string {
  try {
    const url = new URL(ENV.connectOrigin);
    url.pathname = '/link';
    url.search = '';
    url.searchParams.set('method', 'twitter');
    url.searchParams.set('extensionId', chrome.runtime.id);
    return url.toString();
  } catch {
    return ENV.connectOrigin;
  }
}

export function accountLabel(me: ExtensionMeResponse | undefined): string {
  return me?.email || me?.username || me?.twitterId || me?.privyId || '';
}

export interface VerifyController {
  state: () => WorkerState | undefined;
  view: () => VerifyView;
  busy: () => boolean;
  bootError: () => string;

  ready: () => boolean;
  signedIn: () => boolean;
  tasks: () => VerifyTask[];
  taskById: (id: string) => VerifyTask | undefined;
  activeTask: () => VerifyTask | undefined;
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  openTask: (taskId: string) => void;
  openConsent: (taskId: string) => void;
  openSettings: () => void;
  goHub: () => void;

  showActiveOrHub: () => void;
  back: () => void;
  startVerification: (taskId: string) => Promise<void>;
  cancelVerification: () => Promise<void>;

  cancelRefused: () => boolean;

  openSignIn: () => void;

  requestSignIn: () => Promise<void>;
  showSigningIn: (taskId?: string) => void;
  showAuthReplayFailure: (taskId: string) => void;
  signOut: () => Promise<void>;

  listPlatformBindings: () => Promise<PlatformBinding[]>;

  unbindPlatform: (platform: string) => Promise<UnbindPlatformResult>;

  dispose: () => void;
}

export type UnbindPlatformResult = {

  unbound: boolean;
  releasedAccounts: number;
  revokedProofs: number;
};

export type CreateVerifyControllerOptions = {

  ownerWindowId?: () => number | undefined;
};

export function createVerifyController(options: CreateVerifyControllerOptions = {}): VerifyController {
  const [state, setState] = createSignal<WorkerState | undefined>(undefined);
  const [view, setView] = createSignal<VerifyView>({ name: 'hub' });
  const [busy, setBusy] = createSignal(false);
  const [bootError, setBootError] = createSignal('');

  let canceling = false;

  let canceledVerifierId: string | undefined;
  const [cancelRefused, setCancelRefused] = createSignal(false);

  const TICK_MS = 60_000;
  const [now, setNow] = createSignal(Date.now());
  const tickTimer = setInterval(() => setNow(Date.now()), TICK_MS);

  let lastVerifiers: ExtensionVerifier[] | undefined;
  let lastVerifications: Record<string, ExtensionProof> | undefined;
  let lastTasks: VerifyTask[] = [];

  const tasks = createMemo<VerifyTask[]>(() => {
    const s = state();
    const verifiers = s?.verifiers ?? [];
    const verifications = s?.verifications ?? {};
    const t = now();

    if (verifiers !== lastVerifiers || verifications !== lastVerifications) {
      lastVerifiers = verifiers;
      lastVerifications = verifications;
      lastTasks = buildTasks(verifiers, verifications, t);
      return lastTasks;
    }

    lastTasks = lastTasks.map((task) => {
      const nextStatus = statusFor(verifications[task.id], t);
      return statusEquals(task.status, nextStatus) ? task : { ...task, status: nextStatus };
    });
    return lastTasks;
  });

  const taskById = (id: string): VerifyTask | undefined => tasks().find((t) => t.id === id);

  const activeTask = createMemo<VerifyTask | undefined>(() => {
    const current = view();
    return 'taskId' in current && current.taskId ? taskById(current.taskId) : undefined;
  });

  const ready = createMemo<boolean>(() => state() !== undefined);
  const signedIn = createMemo<boolean>(() => Boolean(state()?.signedIn || accountLabel(state()?.me)));

  async function bootstrap(): Promise<void> {
    setBusy(true);
    try {

      if (!state()) {
        const [session, cachedMe, snapshot] = await Promise.all([
          sessionItem.getValue(),
          meCacheItem.getValue(),
          verifySnapshotItem.getValue(),
        ]);
        if (session && cachedMe) {
          setState({
            status: 'uninitialized',
            signedIn: true,
            me: cachedMe,
            verifiers: snapshot?.verifiers ?? [],
            verifications: snapshot?.verifications ?? {},
          });
        }
      }
      const response = await sendVerifyMessage({ action: 'init' });
      if (response?.state) setState(response.state);

      const progress = response?.state?.proofProgress;
      if (progress) setView({ name: 'progress', taskId: progress.verifierId });
    } catch (error) {
      setBootError((error as Error)?.message || String(error));
    } finally {
      setBusy(false);
    }
  }

  async function refresh(): Promise<void> {
    try {
      const response = await sendVerifyMessage({ action: 'getState' });
      if (response?.state) {
        setState(response.state);

        const progress = response.state.proofProgress;
        const suppressedByCancel = canceling && progress?.verifierId === canceledVerifierId;
        if (progress && !suppressedByCancel) {
          setView({ name: 'progress', taskId: progress.verifierId });
        } else if (!progress) {

          if (!busy()) {
            canceling = false;
            canceledVerifierId = undefined;
            if (view().name === 'progress') setView({ name: 'hub' });
          }
        }
      }
    } catch {

    }
  }

  async function startVerification(taskId: string): Promise<void> {
    const running = state()?.proofProgress;
    if (running) {
      setView({ name: 'progress', taskId: running.verifierId });
      return;
    }
    if (!signedIn()) {
      openSignIn();
      return;
    }
    const task = taskById(taskId);
    if (!task?.verifier || busy()) return;
    setBusy(true);
    canceling = false;
    canceledVerifierId = undefined;
    setCancelRefused(false);
    setView({ name: 'progress', taskId });

    const pollTimer = setInterval(() => void refresh(), 1000);
    try {
      const response = await sendVerifyMessage({
        action: 'startProof',
        verifierId: task.verifier.id,
        ownerWindowId: options.ownerWindowId?.(),
      });
      if (response?.state) setState(response.state);

      if (canceling) return;
      const error = response?.result?.error;
      setView({ name: 'result', taskId, kind: error ? resultKindForError(error.code) : 'verified' });
    } catch (error) {
      if (canceling) return;
      setBootError((error as Error)?.message || String(error));
      setView({ name: 'result', taskId, kind: 'failed' });
    } finally {
      clearInterval(pollTimer);
      setBusy(false);
    }
  }

  async function cancelVerification(): Promise<void> {
    canceling = true;
    const current = view();
    const taskId = 'taskId' in current && current.taskId ? current.taskId : undefined;

    canceledVerifierId = state()?.proofProgress?.verifierId ?? taskId;
    setView(taskId ? { name: 'result', taskId, kind: 'canceled' } : { name: 'hub' });
    try {
      const response = await sendVerifyMessage({ action: 'cancelProof' });
      if (response?.state) setState(response.state);
      if (response?.accepted === false) {

        canceling = false;
        canceledVerifierId = undefined;
        setCancelRefused(true);
        if (taskId) setView({ name: 'progress', taskId });
      }
    } catch {

    }
  }

  async function requestSignIn(): Promise<void> {
    const url = buildConnectUrl();
    const response = await sendVerifyMessage({ action: 'openSignIn', url });
    if (response?.ok !== true) throw new Error(response?.error || 'open_sign_in_failed');
  }

  function openSignIn(): void {
    void requestSignIn().catch(() => undefined);
  }

  async function unbindPlatform(platform: string): Promise<UnbindPlatformResult> {
    setBusy(true);
    try {
      const response = await sendVerifyMessage({
        action: 'unbindPlatform',
        platform,
      });
      if (response?.error) throw new Error(response.error);
      if (response?.state) setState(response.state);
      return {
        unbound: response?.unbound === true,
        releasedAccounts: response?.releasedAccounts ?? 0,
        revokedProofs: response?.revokedProofs ?? 0,
      };
    } finally {
      setBusy(false);
    }
  }

  async function listPlatformBindings(): Promise<PlatformBinding[]> {
    const response = await sendVerifyMessage({
      action: 'listPlatformBindings',
    });
    if (response?.error) throw new Error(response.error);
    return response?.bindings ?? [];
  }

  async function signOut(): Promise<void> {
    if (busy()) return;
    setBusy(true);
    try {
      const response = await sendVerifyMessage({ action: 'signOut' });
      if (response?.state) setState(response.state);
      setView({ name: 'hub' });
    } catch (error) {

      setBootError((error as Error)?.message || String(error));
    } finally {
      setBusy(false);
    }
  }

  return {
    state,
    view,
    busy,
    bootError,
    ready,
    signedIn,
    tasks,
    taskById,
    activeTask,
    bootstrap,
    refresh,
    openTask: (taskId) => setView({ name: 'detail', taskId }),
    openConsent: (taskId) => setView({ name: 'consent', taskId }),
    openSettings: () => setView({ name: 'settings' }),
    goHub: () => setView({ name: 'hub' }),
    showActiveOrHub: () => {
      const progress = state()?.proofProgress;
      setView(progress ? { name: 'progress', taskId: progress.verifierId } : { name: 'hub' });
    },
    back: () => {
      const v = view();

      if (v.name === 'result' || v.name === 'consent') setView({ name: 'detail', taskId: v.taskId });
      else if (v.name !== 'progress') setView({ name: 'hub' });
    },
    startVerification,
    cancelVerification,
    cancelRefused,
    openSignIn,
    requestSignIn,
    showSigningIn: (taskId) => setView({ name: 'signing-in', taskId }),
    showAuthReplayFailure: (taskId) => setView({ name: 'result', taskId, kind: 'failed' }),
    signOut,
    listPlatformBindings,
    unbindPlatform,
    dispose: () => clearInterval(tickTimer),
  };
}
