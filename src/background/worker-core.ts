import { api } from '@/lib/api';
import { checkProofTargetUrl } from '@/shared/proof-targets';
import { logDev } from '@/lib/env';
import {
  clearLastResult,
  clearStoredSession,
  getCachedMe,
  getLastAttestation,
  getLastResult,
  getStoredSession,
  setCachedMe,
  setLastAttestation,
  setLastResult,
  setStoredSession,
  setVerifySnapshot,
  StoredSession,
} from '@/lib/client-storage';
import {
  ApiError,
  type Attestation,
  type AutoVerification,
  type ExtensionMeResponse,
  type ExtensionProof,
  type ExtensionVerifier,
  type ListPlatformBindingsResponse,
  type PrimusTemplateMetadata,
  type UnbindPlatformResponse,
} from '@/shared/contracts';
import type { ProofErrorCode, ProofRunSummary, ProofStage, WorkerState } from '@/shared/messages';
import {
  activeProofProgressItem,
  attnOpenSpanSnapshotItem,
  attnPendingEventsItem,
  attnPendingServeEventsItem,
} from '@/shared/storage';
import {
  getPrimusTemplateTargetUrls,
  isExtensionCreatedVerifierTab,
  runAttestation,
  targetUrlMatches,
} from './primus-adapter';
import { openPinnedPopupWindow, openPopupWindow, openToolbarPopup } from '@/background/popup-window';
import { verifierLandingUrl } from '@/shared/verifier-landing';
import { verifierUrlMatches } from '@/shared/verifier-url';
import { runVerifierPreflight, VerifierPreflightError } from './verifier-preflight';
import { isSupportedVerifyPlatform } from '@/verify/catalog';
import { refreshRemoteConfig } from './attention/remote-config';
import { activateVerifierRuntime, type VerifierRuntime } from './verifier-runtime';

const state: WorkerState = {
  status: 'uninitialized',
  signedIn: false,
  verifiers: [],
  verifications: {},
};
const proofsInFlight = new Set<string>();
const PROOF_LOCK_NAME = 'kaito-extension-proof-flow';
const AUTO_PROOF_ENABLED = false;
const AUTO_PROOF_DEBOUNCE_MS = 5 * 60 * 1000;
const AUTO_PROOF_KEEPALIVE_MS = 12 * 60 * 1000;
const LAST_RESULT_TOAST_KEY_STORAGE = 'kaito.lastResultToastKey';

const LEGACY_TAB_OVERLAY_ENABLED = false;

type AutoProofConfig = {
  verifierId: string;
  targetUrls: string[];
  guideUrl?: string;
  lastStartedAt: number;
};

type ProofFlowOptions = {
  source?: 'manual' | 'auto';
  tabId?: number;
  trigger?: 'page_loading' | 'target_request';

  ownerWindowId?: number;
};

const activeProofVerifierIds = new Set<string>();
const autoProofsByVerifier = new Map<string, AutoProofConfig>();
let autoProofListenerRegistered = false;
let restoreAutoProofsPromise: Promise<void> | undefined;
let proofTabGuardRegistered = false;
let lastResultToastKey = '';

let initialBootstrapPromise: Promise<WorkerState> | undefined;
let initialBootstrapSettled = false;
let activeProofSession:
  | {
      verifierId: string;
      guideUrl?: string;
      targetTabId?: number;
      ownerWindowId?: number;
      interruptedError?: Error;

      pastPointOfNoReturn?: boolean;
    }
  | undefined;

if (AUTO_PROOF_ENABLED) {
  ensureAutoProofListener();
}

function setStatus(status: WorkerState['status'], lastError?: string) {
  state.status = status;
  state.lastError = lastError;
}

function setProofProgress(
  verifierId: string,
  stage: ProofStage,
  message: string,
  extra: Pick<NonNullable<WorkerState['proofProgress']>, 'targetTabId' | 'guideUrl'> = {}
): void {

  if (activeProofSession?.verifierId === verifierId && activeProofSession.interruptedError) {
    return;
  }
  state.proofProgress = {
    verifierId,
    stage,
    message,
    startedAt: state.proofProgress?.verifierId === verifierId ? state.proofProgress.startedAt : Date.now(),
    targetTabId: extra.targetTabId ?? state.proofProgress?.targetTabId,
    guideUrl: extra.guideUrl ?? state.proofProgress?.guideUrl,
  };
  void activeProofProgressItem.setValue(state.proofProgress).catch((error) => {
    logDev('persist active proof progress failed', error);
  });
}

function clearProofProgress(verifierId?: string): void {
  if (!verifierId || state.proofProgress?.verifierId === verifierId) {
    state.proofProgress = undefined;
    void activeProofProgressItem.removeValue().catch((error) => {
      logDev('clear active proof progress failed', error);
    });
  }
}

async function restoreActiveProofProgress(): Promise<void> {
  const stored = await activeProofProgressItem.getValue();
  if (!stored) {
    return;
  }
  if (activeProofVerifierIds.has(stored.verifierId)) {
    state.proofProgress = stored;
    return;
  }
  state.proofProgress = stored;
  expireStaleProofProgress(
    'proof_engine_stalled: Verification background task stopped before proof completed'
  );
}

function beginProofTabGuard(verifierId: string, ownerWindowId?: number): void {
  activeProofSession = { verifierId, ownerWindowId };
  ensureProofTabGuardListener();
}

function updateProofTargetTab(verifierId: string, tabId: number, guideUrl: string, verifierName: string): void {

  if (!activeProofSession || activeProofSession.verifierId !== verifierId || activeProofSession.interruptedError) {
    return;
  }
  activeProofSession.targetTabId = tabId;
  activeProofSession.guideUrl = guideUrl;
  if (state.proofProgress?.verifierId === verifierId) {
    setProofProgress(verifierId, state.proofProgress.stage, state.proofProgress.message, { targetTabId: tabId, guideUrl });
  }
  void injectVerificationOverlay(tabId, verifierName).catch((error) => {
    logDev('inject verification overlay failed', {
      verifierId,
      tabId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

function finishProofTabGuard(
  verifierId: string,
  result?: { kind: 'success' | 'error'; title: string; message: string }
): void {
  if (activeProofSession?.verifierId !== verifierId) {
    return;
  }
  const tabId = activeProofSession.targetTabId;
  const guideUrl = activeProofSession.guideUrl;
  activeProofSession = undefined;
  if (result) {
    showVerificationResultOverlayForTabs(typeof tabId === 'number' ? [tabId] : [], guideUrl, result);
  } else if (typeof tabId === 'number') {
      void removeVerificationOverlay(tabId).catch(() => undefined);
  }
}

function reportProofFailureToBackend(summary: ProofRunSummary, stage?: ProofStage): void {
  const error = summary.error;
  if (!error || !summary.requestId) return;
  const requestId = summary.requestId;
  void authedCall((token) =>
    api.reportProofFailure(token, {
      requestId,
      code: error.code ?? 'unknown_error',
      reason: error.reason,

      message: error.message?.slice(0, 256),
      stage,
    })
  ).catch((error) => {
    logDev('proof failure report failed', error);
  });
}

function expireStaleProofProgress(message?: string): boolean {
  const progress = state.proofProgress;
  if (!progress) {
    return false;
  }

  if (activeProofVerifierIds.has(progress.verifierId)) {
    return false;
  }

  const errorMessage =
    message ||
    'proof_engine_stalled: Verification background task stopped before proof completed';
  logDev('stale proof progress detected', {
    verifierId: progress.verifierId,
    message: errorMessage,
    stage: progress.stage,
    ageMs: Date.now() - progress.startedAt,
  });
  const summary: ProofRunSummary = {
    verifierId: progress.verifierId,
    requestId: state.lastResult?.verifierId === progress.verifierId ? state.lastResult.requestId : '',
    error: {
      message: errorMessage,
      code: 'proof_engine_stalled',
      retryable: true,
    },
  };

  summary.finishedAt = Date.now();
  state.lastResult = summary;
  setStatus('error', errorMessage);
  reportProofFailureToBackend(summary, progress.stage);
  clearProofProgress(progress.verifierId);
  void setLastResult(summary).catch((error) => {
    logDev('persist stale proof failure failed', error);
  });
  if (typeof progress.targetTabId === 'number' || progress.guideUrl) {
    showVerificationResultOverlayForTabs(typeof progress.targetTabId === 'number' ? [progress.targetTabId] : [], progress.guideUrl, {
      kind: 'error',
      title: 'Kaito verification failed',
      message: proofErrorUserMessage(summary.error!),
    });
  }
  return true;
}

function showVerificationResultOverlayForTabs(
  preferredTabIds: number[],
  guideUrl: string | undefined,
  result: { kind: 'success' | 'error'; title: string; message: string }
): void {
  if (!LEGACY_TAB_OVERLAY_ENABLED) return;
  const replay = (tabId: number) => {
    void showVerificationResultOverlay(tabId, result).catch(() => undefined);
    for (const delayMs of [250, 1_000]) {
      setTimeout(() => {
        void showVerificationResultOverlay(tabId, result).catch(() => undefined);
      }, delayMs);
    }
  };

  const seen = new Set<number>();
  for (const tabId of preferredTabIds) {
    if (typeof tabId === 'number' && !seen.has(tabId)) {
      seen.add(tabId);
      replay(tabId);
    }
  }

  if (!guideUrl) {
    return;
  }

  void chrome.tabs?.query({}).then((tabs) => {
    for (const tab of tabs) {
      if (typeof tab.id !== 'number' || !tab.url || seen.has(tab.id)) {
        continue;
      }
      if (verifierUrlMatches(tab.url, guideUrl)) {
        seen.add(tab.id);
        replay(tab.id);
      }
    }
  }).catch(() => undefined);
}

async function notifyStoredProofError(): Promise<void> {
  const result = state.lastResult;
  if (!result?.error) {
    return;
  }

  const key = `${result.verifierId}:${result.requestId}:${result.error.message}`;
  const stored = await chrome.storage.local.get(LAST_RESULT_TOAST_KEY_STORAGE).catch(() => undefined);
  if (key === lastResultToastKey || stored?.[LAST_RESULT_TOAST_KEY_STORAGE] === key) {
    return;
  }

  const verifier = state.verifiers.find((entry) => entry.id === result.verifierId);
  if (!verifier) {
    return;
  }

  lastResultToastKey = key;
  void chrome.storage.local.set({ [LAST_RESULT_TOAST_KEY_STORAGE]: key }).catch(() => undefined);
  showVerificationResultOverlayForTabs([], verifier.guide.url, {
    kind: 'error',
    title: 'Kaito verification failed',
    message: proofErrorUserMessage(result.error),
  });
}

function ensureProofTabGuardListener(): void {
  if (proofTabGuardRegistered) {
    return;
  }
  proofTabGuardRegistered = true;

  chrome.tabs?.onRemoved.addListener((tabId) => {
    if (activeProofSession?.targetTabId === tabId) {
      markProofInterrupted(new Error('verification_interrupted: verifier tab was closed'));
    }
  });

  chrome.tabs?.onUpdated.addListener((tabId, changeInfo) => {
    if (!activeProofSession || activeProofSession.targetTabId !== tabId || !changeInfo.url) {
      return;
    }
    if (activeProofSession.guideUrl && !verifierUrlMatches(changeInfo.url, activeProofSession.guideUrl)) {
      markProofInterrupted(new Error('verification_interrupted: verifier tab navigated away'));
    }
  });

  chrome.windows?.onRemoved.addListener((windowId) => {
    if (!activeProofSession || activeProofSession.ownerWindowId !== windowId) {
      return;
    }
    interruptActiveProof('verification window was closed');
  });
}

function markProofInterrupted(error: Error): void {
  if (!activeProofSession || activeProofSession.interruptedError) {
    return;
  }
  activeProofSession.interruptedError = error;

  clearProofProgress(activeProofSession.verifierId);
}

function throwIfProofInterrupted(verifierId: string): void {
  if (activeProofSession?.verifierId === verifierId && activeProofSession.interruptedError) {
    throw activeProofSession.interruptedError;
  }
}

function interruptActiveProof(reason: string): WorkerState {
  const session = activeProofSession;
  if (session && !session.interruptedError) {
    markProofInterrupted(new Error(`verification_interrupted: ${reason}`));
    if (typeof session.targetTabId === 'number' && isExtensionCreatedVerifierTab(session.targetTabId)) {
      void chrome.tabs?.remove(session.targetTabId).catch(() => undefined);
    }
  }
  return getState();
}

export function cancelActiveProof(): { accepted: boolean; state: WorkerState } {
  const session = activeProofSession;
  if (session && !session.interruptedError && session.pastPointOfNoReturn) {
    return { accepted: false, state: getState() };
  }

  return { accepted: true, state: interruptActiveProof('canceled by user') };
}

async function injectVerificationOverlay(tabId: number, verifierName: string): Promise<void> {
  if (!LEGACY_TAB_OVERLAY_ENABLED) return;
  await chrome.scripting.executeScript({
    target: { tabId },
    args: [verifierName],
    func: (name: string) => {
      const id = 'kaito-verification-progress-overlay';
      document.getElementById(id)?.remove();
      const root = document.createElement('div');
      root.id = id;
      root.setAttribute('role', 'status');
      root.setAttribute('aria-live', 'polite');
      root.style.cssText = [
        'position:fixed',
        'top:16px',
        'right:16px',
        'z-index:2147483647',
        'max-width:320px',
        'padding:10px 12px',
        'border-radius:8px',
        'background:rgba(10,18,26,.92)',
        'color:#fff',
        'font:13px/1.35 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
        'box-shadow:0 10px 30px rgba(0,0,0,.24)',
        'pointer-events:none',
      ].join(';');
      const style = document.createElement('style');
      style.textContent = `
        @keyframes kaito-verification-spin {
          to { transform: rotate(360deg); }
        }
      `;
      const header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:2px';
      const spinner = document.createElement('span');
      spinner.setAttribute('aria-hidden', 'true');
      spinner.style.cssText = [
        'width:14px',
        'height:14px',
        'box-sizing:border-box',
        'border:2px solid rgba(255,255,255,.28)',
        'border-top-color:#fff',
        'border-radius:50%',
        'animation:kaito-verification-spin .8s linear infinite',
        'flex:0 0 auto',
      ].join(';');
      const title = document.createElement('div');
      title.textContent = 'Kaito verification in progress';
      title.style.cssText = 'font-weight:700';
      header.append(spinner, title);
      const body = document.createElement('div');
      body.textContent = `Please avoid clicking, closing, or navigating this ${name} page.`;
      body.style.cssText = 'opacity:.82';
      const loading = document.createElement('div');
      loading.textContent = 'Running...';
      loading.style.cssText = 'opacity:.72;font-size:12px;margin-top:4px';
      root.append(style, header, body, loading);
      document.documentElement.append(root);
    },
  });
}

async function removeVerificationOverlay(tabId: number): Promise<void> {
  if (!LEGACY_TAB_OVERLAY_ENABLED) return;
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      document.getElementById('kaito-verification-progress-overlay')?.remove();
    },
  });
}

async function showVerificationResultOverlay(
  tabId: number,
  result: { kind: 'success' | 'error'; title: string; message: string }
): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    args: [result],
    func: (payload: { kind: 'success' | 'error'; title: string; message: string }) => {
      const id = 'kaito-verification-progress-overlay';
      document.getElementById(id)?.remove();
      const root = document.createElement('div');
      root.id = id;
      root.setAttribute('role', 'status');
      root.style.cssText = [
        'position:fixed',
        'top:16px',
        'right:16px',
        'z-index:2147483647',
        'max-width:340px',
        'padding:10px 12px',
        'border-radius:8px',
        payload.kind === 'success' ? 'background:rgba(8,94,60,.94)' : 'background:rgba(132,32,41,.95)',
        'color:#fff',
        'font:13px/1.35 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
        'box-shadow:0 10px 30px rgba(0,0,0,.26)',
        'pointer-events:none',
      ].join(';');
      const title = document.createElement('div');
      title.textContent = payload.title;
      title.style.cssText = 'font-weight:700;margin-bottom:2px';
      const body = document.createElement('div');
      body.textContent = payload.message;
      body.style.cssText = 'opacity:.88';
      root.append(title, body);
      document.documentElement.append(root);
      window.setTimeout(() => {
        if (document.getElementById(id) === root) {
          root.remove();
        }
      }, 30_000);
    },
  });
}

function normalizeMe(me: (ExtensionMeResponse & {
  privy_id?: string;
  twitter_id?: string;
  avatar_url?: string;
}) | undefined): ExtensionMeResponse | undefined {
  if (!me) return undefined;
  return {
    privyId: me.privyId || me.privy_id,
    email: me.email,
    twitterId: me.twitterId || me.twitter_id,
    username: me.username,
    avatarUrl: me.avatarUrl || me.avatar_url,
    kaitoName: me.kaitoName,

    ...('activityInsightsEnabled' in me ? { activityInsightsEnabled: me.activityInsightsEnabled } : {}),
    ...('termsAccepted' in me ? { termsAccepted: me.termsAccepted } : {}),
  };
}

function applyMe(me: ExtensionMeResponse | undefined) {
  const normalized = normalizeMe(me);
  state.me = normalized;
  state.signedIn = hasIdentity(normalized);
}

export async function updateActivityInsightsEnabled(enabled: boolean): Promise<void> {
  if (state.me) {
    state.me = { ...state.me, activityInsightsEnabled: enabled };
    await setCachedMe(state.me).catch((error) => {
      logDev('persist activityInsightsEnabled cache failed', error);
    });
  }
}

export async function applyTermsAccepted(): Promise<void> {
  if (!state.me) return;
  state.me = { ...state.me, termsAccepted: true, activityInsightsEnabled: true };
  await setCachedMe(state.me).catch((error) => {
    logDev('persist termsAccepted cache failed', error);
  });
}

function hasIdentity(me: ExtensionMeResponse | undefined): boolean {
  return Boolean(me?.privyId || me?.email || me?.twitterId || me?.username);
}

export function getState(): WorkerState {
  return {
    ...state,
    signedIn: state.signedIn || hasIdentity(state.me),
    verifiers: [...state.verifiers],
    verifications: { ...state.verifications },
  };
}

async function getRequiredSession(): Promise<StoredSession> {
  const existing = await getStoredSession();
  if (!existing) {
    throw new Error('sign_in_required');
  }
  return existing;
}

export async function authedCall<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const stored = await getRequiredSession();
  try {
    return await fn(stored.sessionToken);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      logDev('session token rejected, clearing local state', error.reason);
      await clearStoredSession();
      applyMe(undefined);
      state.verifiers = [];
      setStatus('uninitialized', formatError('session_token_invalid', error));
    }
    throw error;
  }
}

function mergeMeWithCache(
  fresh: ExtensionMeResponse,
  cached: ExtensionMeResponse | null | undefined,
): ExtensionMeResponse {
  if (!cached) return fresh;

  const kaitoName = fresh.kaitoName || cached.kaitoName;
  if (!fresh.email && !fresh.twitterId && !fresh.username) {

    return {
      privyId: fresh.privyId || cached.privyId,
      email: cached.email,
      twitterId: cached.twitterId,
      username: cached.username,
      avatarUrl: cached.avatarUrl,
      kaitoName,
      ...('activityInsightsEnabled' in fresh ? { activityInsightsEnabled: fresh.activityInsightsEnabled } : {}),

      ...('termsAccepted' in fresh ? { termsAccepted: fresh.termsAccepted } : {}),
    };
  }
  if (!fresh.avatarUrl && fresh.twitterId && fresh.twitterId === cached.twitterId && cached.avatarUrl) {
    return { ...fresh, avatarUrl: cached.avatarUrl, kaitoName };
  }
  return { ...fresh, kaitoName };
}

export async function refreshMe(): Promise<ExtensionMeResponse> {
  try {
    const fresh = normalizeMe(await authedCall((token) => api.getMe(token)))!;
    const me = mergeMeWithCache(fresh, await getCachedMe());
    applyMe(me);
    await setCachedMe(me);
    if (state.status !== 'attesting' && state.status !== 'submitting') {
      setStatus('idle');
    }
    return me;
  } catch (error) {
    if (state.status !== 'uninitialized') {
      setStatus('error', formatError('me failed', error));
    }
    throw error;
  }
}

function persistVerifySnapshot(): void {
  void setVerifySnapshot({ verifiers: state.verifiers, verifications: state.verifications }).catch((error) => {
    logDev('persist verify snapshot failed', error);
  });
}

export async function refreshVerifiers(): Promise<ExtensionVerifier[]> {
  const verifiers = await authedCall((token) => api.getVerifiers(token));
  state.verifiers = verifiers;
  persistVerifySnapshot();
  return verifiers;
}

export async function refreshProofs(): Promise<Record<string, ExtensionProof>> {
  const response = await authedCall((token) => api.getProofs(token));
  const map: Record<string, ExtensionProof> = {};
  for (const proof of response.proofs) {
    const seen = map[proof.verifierId];
    if (!seen || proof.verifiedAt < seen.verifiedAt) map[proof.verifierId] = proof;
  }
  state.verifications = map;
  persistVerifySnapshot();
  return map;
}

export async function listPlatformBindings(): Promise<ListPlatformBindingsResponse> {
  return authedCall((token) => api.getPlatformBindings(token));
}

export async function unbindPlatform(platform: string): Promise<UnbindPlatformResponse> {
  const result = await authedCall((token) => api.unbindPlatform(token, platform));
  try {
    await refreshProofs();
  } catch (error) {
    logDev('refreshProofs after unbind failed; the release itself succeeded', error);
  }
  return result;
}

export async function bootstrap(): Promise<WorkerState> {
  console.log('[TIMING] bootstrap start', performance.now());
  const stored = await getStoredSession();
  state.lastResult = await getLastResult();
  await restoreActiveProofProgress();
  if (!stored) {
    applyMe(undefined);
    state.verifiers = [];
    setStatus('idle');
    return getState();
  }

  const cached = await getCachedMe();
  if (cached) applyMe(cached);
  console.log('[TIMING] bootstrap before network group', performance.now());

  const [meResult, verifiersResult, proofsResult] = await Promise.allSettled([
    refreshMe(),
    refreshVerifiers(),
    refreshProofs(),
  ]);
  console.log('[TIMING] bootstrap after network group', performance.now());

  const failures: string[] = [];
  if (meResult.status === 'rejected') {
    failures.push(formatError('me failed', meResult.reason));
  }
  if (verifiersResult.status === 'rejected') {
    failures.push(formatError('verifiers failed', verifiersResult.reason));
  }

  if (proofsResult.status === 'rejected') {
    logDev('refresh proofs failed', proofsResult.reason);
  }

  if (failures.length > 0) {
    if (state.status !== 'uninitialized') {
      setStatus('error', failures.join('; '));
    }
  } else {
    setStatus('idle');
  }

  await restoreAutoVerifications().catch((error) => {
    logDev('restore auto verifications failed', error);
  });
  await notifyStoredProofError();

  console.log('[TIMING] bootstrap end', performance.now());
  return getState();
}

export function startBootstrap(): Promise<WorkerState> {
  if (!initialBootstrapPromise) {
    initialBootstrapSettled = false;
    initialBootstrapPromise = bootstrap().finally(() => {
      initialBootstrapSettled = true;
    });
  }
  return initialBootstrapPromise;
}

export async function ensureStartupBootstrap(): Promise<void> {
  if (!initialBootstrapPromise || initialBootstrapSettled) return;
  logDev('state read waited for in-flight startup bootstrap');
  await initialBootstrapPromise.catch(() => undefined);
}

export async function runProofFlow(
  verifierId: string,
  options: ProofFlowOptions = {}
): Promise<ProofRunSummary> {
  return withProofLock(verifierId, () => runProofFlowUnlocked(verifierId, options));
}

async function withProofLock(
  verifierId: string,
  run: () => Promise<ProofRunSummary>
): Promise<ProofRunSummary> {
  const locks = (globalThis.navigator as { locks?: {
    request: <T>(
      name: string,
      options: { ifAvailable: true },
      callback: (lock: unknown) => Promise<T> | T
    ) => Promise<T>;
  } }).locks;

  if (locks?.request) {
    return locks.request(PROOF_LOCK_NAME, { ifAvailable: true }, (lock) => {
      if (!lock) {
        logDev('proof flow already running; dropping duplicate start', { verifierId });
        return duplicateProofSummary(verifierId);
      }
      logDev('proof flow lock acquired', { verifierId });
      return run();
    });
  }

  if (proofsInFlight.size > 0) {
    logDev('proof flow already running; dropping duplicate start', { verifierId });
    return duplicateProofSummary(verifierId);
  }
  proofsInFlight.add(verifierId);
  try {
    return await run();
  } finally {
    proofsInFlight.delete(verifierId);
  }
}

function duplicateProofSummary(verifierId: string): ProofRunSummary {
  return {
    verifierId,
    requestId: '',
    error: { message: 'verification_already_running' },
  };
}

async function runProofFlowUnlocked(
  verifierId: string,
  options: ProofFlowOptions
): Promise<ProofRunSummary> {
  const summary: ProofRunSummary = { verifierId, requestId: '' };
  let verifierRuntime: VerifierRuntime | undefined;
  activeProofVerifierIds.add(verifierId);
  beginProofTabGuard(verifierId, options.ownerWindowId);
  const source = options.source || 'manual';

  try {
    setStatus('attesting');
    setProofProgress(verifierId, 'preparing', 'Preparing verification request');
    let verifier = state.verifiers.find((entry) => entry.id === verifierId);
    if (!verifier) {
      logDev('verifier missing from worker state; refreshing verifiers before proof', {
        verifierId,
        currentVerifiers: state.verifiers.map((entry) => entry.id),
      });
      const refreshed = await refreshVerifiers();
      verifier = refreshed.find((entry) => entry.id === verifierId);
    }
    if (!verifier) {
      throw new Error(`verifier_not_found:${verifierId}`);
    }
    if (!isSupportedVerifyPlatform(verifier.platform)) {
      throw new Error(`verifier_platform_not_supported:${verifier.platform}`);
    }
    await setLastAttestation(null);
    const sign = await authedCall((token) => api.signRequest(token, verifierId));
    throwIfProofInterrupted(verifierId);
    summary.requestId = sign.requestId;
    state.lastResult = { ...summary };
    await setLastResult(state.lastResult);
    const template = buildPrimusTemplate(sign.template, verifier);
    const guideUrl = resolveGuideUrl(verifier, template);
    if (!guideUrl) {

      throw new Error(`proof_target_not_allowed:${verifierId}`);
    }
    setProofProgress(verifierId, state.proofProgress?.stage ?? 'preparing', state.proofProgress?.message ?? 'Preparing verification request', { guideUrl });
    verifierRuntime = await activateVerifierRuntime(guideUrl);
    throwIfProofInterrupted(verifierId);

    if (source !== 'auto') {
      setProofProgress(verifierId, 'reading_data', 'Checking account eligibility', { guideUrl });
      await runVerifierPreflight(verifier, guideUrl, template, {
        onTargetTab: async (tabId) => {
          updateProofTargetTab(verifierId, tabId, guideUrl, verifier.name);
          await verifierRuntime?.prepareTab(tabId);
        },
      });
      throwIfProofInterrupted(verifierId);
    }

    const pageSignedCapture = Boolean(verifier.requiresPageSignedInitialTraffic);
    const attachDuringNavigation =
      pageSignedCapture || (source === 'auto' && options.trigger === 'page_loading');

    const attestation = await runAttestation(
      guideUrl,
      sign.signedRequest,
      template,
      {

        tabId: pageSignedCapture ? undefined : options.tabId,
        silent: source === 'auto',
        allowCreateTab: source !== 'auto' || pageSignedCapture,
        forceCreateTab: pageSignedCapture,
        attachDuringNavigation,
        waitForTargetData: !attachDuringNavigation,
        onProgress: (stage, message) => setProofProgress(verifierId, stage, message),
        onTargetTab: async (tabId) => {
          updateProofTargetTab(verifierId, tabId, guideUrl, verifier.name);
          await verifierRuntime?.prepareTab(tabId);
        },
        isCanceled: () => activeProofSession?.verifierId === verifierId && Boolean(activeProofSession.interruptedError),
      }
    );
    throwIfProofInterrupted(verifierId);
    summary.attestation = attestation;
    await setLastAttestation(attestation);

    setStatus('submitting');
    setProofProgress(verifierId, 'submitting', 'Submitting proof');
    logDev('submitProof attestation keys', attestation && typeof attestation === 'object' ? Object.keys(attestation) : `<not object: ${typeof attestation}>`);

    if (activeProofSession?.verifierId === verifierId) {
      activeProofSession.pastPointOfNoReturn = true;
    }
    const result = await authedCall((token) => api.submitProof(token, sign.requestId, attestation));
    summary.proofId = result.proofId;
    summary.extractedValue = result.extractedValue;
    summary.unit = result.unit;
    summary.verifiedAt = result.verifiedAt;

    state.verifications = {
      ...state.verifications,
      [verifierId]: {
        verifierId,
        proofId: result.proofId,
        extractedValue: result.extractedValue,
        unit: result.unit,
        platform: verifier.platform,
        verifiedAt: result.verifiedAt,
      },
    };

    persistVerifySnapshot();
    finishProofTabGuard(verifierId, {
      kind: 'success',
      title: 'Kaito verification complete',
      message: `${verifier.name} was verified successfully.`,
    });
    if (source === 'manual') {
      await enableAutoProof(verifier.id, template, guideUrl);
    }
    setStatus('idle');
    clearProofProgress(verifierId);
  } catch (error) {

    const interruption = activeProofSession?.verifierId === verifierId ? activeProofSession.interruptedError : undefined;
    summary.error = serializeError(interruption ?? error);

    reportProofFailureToBackend(summary, state.proofProgress?.stage);
    if (state.status !== 'uninitialized') {
      setStatus('error', summary.error.message);
    }
    finishProofTabGuard(verifierId, {
      kind: 'error',
      title: 'Kaito verification failed',
      message: proofErrorUserMessage(summary.error),
    });
    clearProofProgress(verifierId);
  } finally {
    await verifierRuntime?.dispose();
    finishProofTabGuard(verifierId);
    activeProofVerifierIds.delete(verifierId);
    const autoProof = autoProofsByVerifier.get(verifierId);
    if (autoProof && source === 'auto') {
      autoProof.lastStartedAt = Date.now();
    }
  }

  summary.finishedAt = Date.now();
  state.lastResult = summary;
  await setLastResult(summary);
  return summary;
}

async function enableAutoProof(
  verifierId: string,
  template: PrimusTemplateMetadata | undefined,
  guideUrl?: string
): Promise<void> {
  if (!AUTO_PROOF_ENABLED) {
    return;
  }
  armAutoProof(verifierId, template, guideUrl);
  try {
    await authedCall((token) => api.enableAutoVerification(token, verifierId));
  } catch (error) {
    logDev('enable auto verification failed; keeping local watcher armed', {
      verifierId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function armAutoProof(verifierId: string, template: PrimusTemplateMetadata | undefined, guideUrl?: string): void {
  armAutoProofTargetUrls(verifierId, getPrimusTemplateTargetUrls(template), guideUrl, Date.now());
}

function armAutoProofTargetUrls(
  verifierId: string,
  targetUrls: string[],
  guideUrl?: string,
  lastStartedAt = 0
): void {
  if (targetUrls.length === 0) {
    return;
  }

  const existing = autoProofsByVerifier.get(verifierId);
  autoProofsByVerifier.set(verifierId, {
    verifierId,
    targetUrls,
    guideUrl,
    lastStartedAt: existing?.lastStartedAt ?? lastStartedAt,
  });
  ensureAutoProofListener();
  logDev('armed auto proof watcher', { verifierId, targetUrls });
}

async function restoreAutoVerifications(): Promise<void> {
  if (!AUTO_PROOF_ENABLED) {
    return;
  }
  let response;
  try {
    response = await authedCall((token) => api.getAutoVerifications(token));
  } catch (error) {
    logDev('get auto verifications failed', error);
    return;
  }

  for (const autoVerification of response.autoVerifications) {
    restoreAutoVerification(autoVerification);
  }
}

function restoreAutoVerification(autoVerification: AutoVerification): void {
  if (!autoVerification.enabled) {
    return;
  }

  const verifier = state.verifiers.find((entry) => entry.id === autoVerification.verifierId);

  armAutoProofTargetUrls(
    autoVerification.verifierId,
    autoVerification.targetUrlExpressions,
    verifier ? verifierLandingUrl(verifier, verifier.guide.url) : undefined
  );
}

function ensureAutoProofListener(): void {
  if (autoProofListenerRegistered || !chrome.webRequest?.onCompleted) {
    return;
  }
  autoProofListenerRegistered = true;
  chrome.tabs?.onUpdated.addListener(onAutoProofTabUpdated);
  chrome.webRequest.onCompleted.addListener(onAutoProofRequestCompleted, {
    urls: ['<all_urls>'],
  });
}

function onAutoProofTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.OnUpdatedInfo,
  tab: chrome.tabs.Tab
): void {
  if (changeInfo.status !== 'loading' && !changeInfo.url) {
    return;
  }

  void maybeRunAutoProofForPageLoad(tabId, changeInfo.url || tab.url || tab.pendingUrl, tab.active);
}

function onAutoProofRequestCompleted(details: chrome.webRequest.OnCompletedDetails): void {
  if (details.tabId < 0 || details.statusCode < 200 || details.statusCode >= 300) {
    return;
  }

  void maybeRunAutoProof(details);
}

async function maybeRunAutoProofForPageLoad(
  tabId: number,
  pageUrl: string | undefined,
  isActive: boolean | undefined
): Promise<void> {
  if (!pageUrl || !isActive) {
    return;
  }

  if (autoProofsByVerifier.size === 0) {
    await restoreAutoProofsOnce();
  }

  const config = [...autoProofsByVerifier.values()].find((entry) =>
    pageUrlMatchesAutoProofConfig(pageUrl, entry)
  );
  if (!config) {
    return;
  }

  await startAutoProof(config, tabId, { pageUrl, trigger: 'page_loading' });
}

async function maybeRunAutoProof(details: chrome.webRequest.OnCompletedDetails): Promise<void> {
  if (autoProofsByVerifier.size === 0) {
    await restoreAutoProofsOnce();
  }

  const config = [...autoProofsByVerifier.values()].find((entry) =>
    entry.targetUrls.some((targetUrl) => targetUrlMatches(details.url, targetUrl))
  );
  if (!config) {
    return;
  }

  const tab = await chrome.tabs.get(details.tabId).catch(() => undefined);
  if (!tab?.active) {
    return;
  }

  await startAutoProof(config, details.tabId, { url: details.url, trigger: 'target_request' });
}

async function startAutoProof(
  config: AutoProofConfig,
  tabId: number,
  metadata: { trigger: 'page_loading' | 'target_request'; pageUrl?: string; url?: string }
): Promise<void> {
  if (activeProofVerifierIds.has(config.verifierId)) {
    return;
  }

  const now = Date.now();
  if (now - config.lastStartedAt < AUTO_PROOF_DEBOUNCE_MS) {
    return;
  }

  config.lastStartedAt = now;
  logDev('auto proof trigger observed; starting verification', {
    verifierId: config.verifierId,
    tabId,
    ...metadata,
  });
  await keepAutoProofWorkerAlive(tabId);
  void runProofFlow(config.verifierId, { source: 'auto', tabId, trigger: metadata.trigger });
}

async function restoreAutoProofsOnce(): Promise<void> {
  if (!restoreAutoProofsPromise) {
    restoreAutoProofsPromise = restoreAutoVerifications().finally(() => {
      restoreAutoProofsPromise = undefined;
    });
  }
  await restoreAutoProofsPromise;
}

function pageUrlMatchesAutoProofConfig(pageUrl: string, config: AutoProofConfig): boolean {
  if (config.guideUrl && verifierUrlMatches(pageUrl, config.guideUrl)) {
    return true;
  }

  return config.targetUrls.some((targetUrl) => pageUrlMatchesTargetOrigin(pageUrl, targetUrl));
}

function pageUrlMatchesTargetOrigin(pageUrl: string, targetExpression: string): boolean {
  try {
    const page = new URL(pageUrl);
    const exactTarget = exactUrlFromTargetExpression(targetExpression);
    if (exactTarget) {
      return page.origin === new URL(exactTarget).origin;
    }

    const hostMatch = /^https?:\/\/([^/]+)/.exec(targetExpression);
    if (!hostMatch) {
      return false;
    }
    const host = hostMatch[1].replace(/\\\./g, '.');
    return page.host === host;
  } catch {
    return false;
  }
}

function exactUrlFromTargetExpression(value: string): string | undefined {
  let expression = value.trim();
  expression = expression.replace(/\(\?:\\\?\.\*\)\?\$$/, '');
  expression = expression.replace(/\$$/, '');
  expression = expression.replace(/\\\./g, '.');
  expression = expression.replace(/\\\//g, '/');

  if (!/^https?:\/\//.test(expression)) {
    return undefined;
  }
  if (/[()[\]{}|+*?^$]/.test(expression)) {
    return undefined;
  }
  return expression;
}

async function keepAutoProofWorkerAlive(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    args: [AUTO_PROOF_KEEPALIVE_MS],
    func: (timeoutMs: number) => {
      const key = '__kaitoAutoProofKeepAlive';
      const global = globalThis as typeof globalThis & {
        [key]?: {
          port: chrome.runtime.Port;
          timer: number;
        };
      };
      const existing = global[key];
      if (existing) {
        clearTimeout(existing.timer);
        existing.port.disconnect();
      }

      const port = chrome.runtime.connect({ name: 'kaitoAutoProofKeepAlive' });
      const timer = window.setTimeout(() => port.disconnect(), timeoutMs);
      global[key] = { port, timer };
      port.onDisconnect.addListener(() => {
        clearTimeout(timer);
        if (global[key]?.port === port) {
          delete global[key];
        }
      });
    },
  }).catch((error) => {
    logDev('auto proof keepalive injection failed; continuing', {
      tabId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

function buildPrimusTemplate(
  template: PrimusTemplateMetadata | undefined,
  verifier: ExtensionVerifier
): PrimusTemplateMetadata | undefined {
  if (!template) {
    return undefined;
  }

  const defaults = getPrimusTemplateDefaults(verifier);
  return {
    ...template,
    dataSource: normalizeDataSource(template.dataSource, verifier.platform),
    name: template.name || defaults.name,
    description: template.description || defaults.description,
    category: template.category || defaults.category,
  };
}

function normalizeDataSource(value: string | undefined, fallback: string): string {
  const resolved = value?.trim() || fallback.trim();
  return resolved.toLowerCase();
}

function getPrimusTemplateDefaults(verifier: ExtensionVerifier): {
  name: string;
  description: string;
  category: string;
} {
  return {
    name: verifier.name,
    description: verifier.guide.message,
    category: verifier.platform.toUpperCase(),
  };
}

function resolveGuideUrl(verifier: ExtensionVerifier, template: PrimusTemplateMetadata | undefined): string | null {
  const allowed = resolveAllowedGuideUrl(verifier, template);
  return allowed === null ? null : verifierLandingUrl(verifier, allowed);
}

function resolveAllowedGuideUrl(
  verifier: ExtensionVerifier,
  template: PrimusTemplateMetadata | undefined
): string | null {
  if (template?.dataPageTemplate) {
    try {
      const parsed = JSON.parse(template.dataPageTemplate) as { baseUrl?: unknown };
      if (typeof parsed.baseUrl === 'string' && parsed.baseUrl.length > 0) {
        return checkProofTargetUrl(parsed.baseUrl);
      }
    } catch {

    }
  }

  return checkProofTargetUrl(verifier.guide.url);
}

export async function signInWithPrivySession(
  accessToken: string,
  idToken: string,
  overrides?: { kaitoName?: string },
): Promise<ExtensionMeResponse> {
  const response = await api.createSession(accessToken, idToken);
  const me = normalizeMe(response.me)!;

  if (overrides?.kaitoName) {
    me.kaitoName = overrides.kaitoName;
  }

  logDev('sign-in: /sessions me.termsAccepted =', 'termsAccepted' in me ? me.termsAccepted : '(absent)');
  await setStoredSession({
    sessionToken: response.sessionToken,
    signedInAt: Date.now(),
  });

  void refreshRemoteConfig({ force: true });
  applyMe(me);

  try {
    const [verifiersResult, proofsResult] = await Promise.allSettled([
      refreshVerifiers(),
      refreshProofs(),
    ]);

    if (proofsResult.status === 'rejected') {
      logDev('post-login refresh proofs failed', proofsResult.reason);
    }
    if (verifiersResult.status === 'rejected') {
      throw verifiersResult.reason;
    }
  } finally {
    await setCachedMe(me);
  }
  setStatus('idle');
  return me;
}

const PENDING_SIGN_IN_RETURN_TAB_KEY = 'kaitoPendingSignInReturnTabId';
const SIGN_IN_WINDOW_ID_KEY = 'kaitoSignInWindowId';

export async function setPendingSignInReturnTab(tabId: number | undefined): Promise<void> {
  if (typeof tabId === 'number') {
    await chrome.storage.session?.set({ [PENDING_SIGN_IN_RETURN_TAB_KEY]: tabId }).catch(() => undefined);
  } else {
    await chrome.storage.session?.remove(PENDING_SIGN_IN_RETURN_TAB_KEY).catch(() => undefined);
  }
}

export async function openSignInWindow(url: string): Promise<void> {
  const stored = await chrome.storage.session?.get(SIGN_IN_WINDOW_ID_KEY).catch(() => undefined);
  const existingId = typeof stored?.[SIGN_IN_WINDOW_ID_KEY] === 'number'
    ? stored[SIGN_IN_WINDOW_ID_KEY] as number
    : undefined;
  if (existingId !== undefined) {
    const focused = await chrome.windows.update(existingId, { focused: true, state: 'normal' }).catch(() => undefined);
    if (focused) return;
  }
  const loadingUrl = chrome.runtime.getURL(`sign-in-loading.html?to=${encodeURIComponent(url)}`);
  const created = await openPinnedPopupWindow(loadingUrl);
  if (typeof created?.id === 'number') {
    await chrome.storage.session?.set({ [SIGN_IN_WINDOW_ID_KEY]: created.id }).catch(() => undefined);
  }
}

async function isLoginTabOursToClose(
  loginTabId: number,
  signInWindowId: number | undefined,
): Promise<boolean> {
  if (typeof signInWindowId !== 'number') return true;
  const loginTab = await chrome.tabs.get(loginTabId).catch(() => undefined);
  if (loginTab === undefined) return false;
  if (loginTab.windowId === signInWindowId) return true;

  logDev('sign-in: login tab', loginTabId, 'is not in our sign-in window', signInWindowId, '— leaving it open');
  return false;
}

export async function returnToOriginTabAfterSignIn(loginTabId: number | undefined): Promise<void> {
  const stored = await chrome.storage.session
    ?.get([PENDING_SIGN_IN_RETURN_TAB_KEY, SIGN_IN_WINDOW_ID_KEY])
    .catch(() => undefined);
  const returnTabId = typeof stored?.[PENDING_SIGN_IN_RETURN_TAB_KEY] === 'number'
    ? stored[PENDING_SIGN_IN_RETURN_TAB_KEY] as number
    : undefined;
  const signInWindowId = typeof stored?.[SIGN_IN_WINDOW_ID_KEY] === 'number'
    ? stored[SIGN_IN_WINDOW_ID_KEY] as number
    : undefined;

  if (typeof returnTabId !== 'number' && typeof signInWindowId !== 'number') {
    logDev('sign-in: page-initiated handshake, nothing of ours to restore — leaving tabs and surfaces alone');
    return;
  }

  if (typeof loginTabId === 'number' && await isLoginTabOursToClose(loginTabId, signInWindowId)) {
    await chrome.tabs.remove(loginTabId).catch(() => undefined);
  }

  await chrome.storage.session
    ?.remove([PENDING_SIGN_IN_RETURN_TAB_KEY, SIGN_IN_WINDOW_ID_KEY])
    .catch(() => undefined);

  if (typeof returnTabId !== 'number') {
    if (await openToolbarPopup()) {
      logDev('sign-in: reopened the toolbar popup');
    } else {
      logDev('sign-in: chrome.action.openPopup unavailable/refused — opening a popup window instead');
      await openPopupWindow();
    }
    return;
  }
  const tab = await chrome.tabs.get(returnTabId).catch(() => undefined);
  if (!tab) return;
  await chrome.tabs.update(returnTabId, { active: true }).catch(() => undefined);
  if (tab.windowId !== undefined) {
    await chrome.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
  }
}

async function discardUnsentActivity(): Promise<void> {
  await Promise.all([
    attnPendingEventsItem.setValue([]),
    attnPendingServeEventsItem.setValue([]),
    attnOpenSpanSnapshotItem.removeValue(),
  ]).catch((error) => {

    logDev('discarding unsent activity failed; session still cleared', error);
  });
}

export async function signOut(): Promise<void> {
  const stored = await getStoredSession();
  if (stored) {
    await api.revokeSession(stored.sessionToken).catch((error) => {
      logDev('revoke session failed; clearing local session anyway', error);
    });
  }
  await discardUnsentActivity();
  await clearStoredSession();
  state.me = undefined;
  state.signedIn = false;
  state.verifiers = [];
  state.verifications = {};
  autoProofsByVerifier.clear();
  setStatus('idle');
}

export async function resetSession(): Promise<WorkerState> {

  await discardUnsentActivity();
  await clearStoredSession();
  state.me = undefined;
  state.signedIn = false;
  state.verifiers = [];
  state.verifications = {};
  state.lastResult = undefined;
  autoProofsByVerifier.clear();
  setStatus('uninitialized');
  await clearLastResult();
  await bootstrap();
  return getState();
}

export async function getLastAttestationExport(): Promise<Attestation | undefined> {
  return getLastAttestation();
}

function formatError(prefix: string, error: unknown): string {
  if (error instanceof ApiError) {
    return `${prefix}: ${error.status} ${error.reason || error.message}`;
  }
  return `${prefix}: ${(error as Error)?.message || String(error)}`;
}

function serializeError(error: unknown): NonNullable<ProofRunSummary['error']> {
  if (error instanceof VerifierPreflightError) {
    return {
      message: error.message,

      reason: error.message,
      code: error.code,
      retryable: isRetryableProofError(error.code),
    };
  }
  if (error instanceof ApiError) {
    const code = classifyProofError(error.message, error.reason, error.status);
    return {
      message: error.message,
      status: error.status,
      reason: error.reason,
      code,
      retryable: isRetryableProofError(code),
    };
  }
  const message = (error as Error)?.message || String(error);
  const code = classifyProofError(message);
  return {
    message,
    code,
    retryable: isRetryableProofError(code),
  };
}

function proofErrorUserMessage(error: NonNullable<ProofRunSummary['error']>): string {
  switch (error.code) {
    case 'wallet_not_connected':
      return 'Connect your wallet on this platform, then retry verification.';
    case 'third_party_login_required':
      return 'Sign in to this platform, then retry verification.';
    case 'unsupported_account_type':

      return error.message?.includes('x_analytics_requires_premium')
        ? 'X Premium is required to verify account analytics. This account does not have access to its analytics data.'
        : 'This account type is not supported for this verification.';
    case 'missing_required_data':
      return 'Required account data is missing. Check the account state, then retry.';
    case 'target_page_not_ready':
      return 'Open the required platform page, then retry verification.';
    case 'proof_engine_stalled':
      return 'Proof generation stalled. Retry after the page is stable.';
    case 'network_error':
      return 'The proof service reported a network issue. Please retry.';
    case 'proof_quota_exhausted':
      return 'Primus proof quota exhausted for this appId. Retrying will not help — contact Primus to raise the limit.';
    case 'timeout':
      return 'Verification timed out. Please retry.';
    case 'page_closed':
    case 'page_interrupted':
      return 'The platform page changed or closed before verification finished.';
    default:
      return error.reason || error.message || 'Verification failed. Please retry.';
  }
}

function classifyProofError(message: string, reason?: string, status?: number): ProofErrorCode {
  const text = `${reason || ''} ${message}`.toLowerCase();

  if (text.includes('-1002003') || text.includes('quota exhausted') || text.includes('quote has been exhausted')) {
    return 'proof_quota_exhausted';
  }
  if (text.includes('sign_in_required')) return 'sign_in_required';
  if (text.includes('wallet_not_connected')) return 'wallet_not_connected';
  if (status === 401 || text.includes('session_token_invalid') || text.includes('session') && text.includes('revoked')) {
    return 'session_invalid';
  }
  if (text.includes('verification_already_running')) return 'verification_already_running';
  if (text.includes('duplicate_taskid')) return 'duplicate_proof';

  if (text.includes('platform_account_already_claimed')) return 'platform_account_already_claimed';
  if (text.includes('platform_user_id_missing')) return 'platform_account_id_missing';
  if (text.includes('unsupported_account_type')) return 'unsupported_account_type';
  if (text.includes('missing_required_data')) return 'missing_required_data';
  if (text.includes('target_api_changed')) return 'target_api_changed';
  if (text.includes('target_page_not_ready')) return 'target_page_not_ready';
  if (text.includes('insufficient_activity')) return 'insufficient_activity';
  if (text.includes('proof_capture_failed')) return 'proof_capture_failed';
  if (text.includes('proof_engine_stalled')) return 'proof_engine_stalled';
  if (text.includes('verification_interrupted')) return 'page_interrupted';
  if (text.includes('tab was closed') || text.includes('no tab with id') || text.includes('verifier tab was closed')) {
    return 'page_closed';
  }
  if (text.includes('target_data_not_ready') || text.includes('target data missing')) {
    if (text.includes('401') || text.includes('403') || text.includes('login')) {
      return 'third_party_login_required';
    }
    if (text.includes('timed out')) {
      return 'timeout';
    }
    return 'target_data_missing';
  }
  if (text.includes('timeout') || text.includes('timed out')) return 'timeout';
  if (
    text.includes('signature_failed') ||
    text.includes('template_mismatch') ||
    text.includes('recipient_mismatch') ||
    text.includes('expired_attestation') ||
    text.includes('ownership_mismatch')
  ) {
    return 'security_check_failed';
  }
  if (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    text.includes('upstream_') ||
    text.includes('00011') ||
    text.includes('unstable connection')
  ) return 'network_error';
  return 'unknown_error';
}

function isRetryableProofError(code: ProofErrorCode): boolean {
  return [
    'third_party_login_required',
    'wallet_not_connected',
    'page_closed',
    'page_interrupted',
    'timeout',
    'target_data_missing',
    'proof_engine_stalled',
    'network_error',
    'unknown_error',
  ].includes(code);
}
