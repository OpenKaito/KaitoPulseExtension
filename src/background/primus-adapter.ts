import { logDev } from '@/lib/env';
import type { Attestation, PrimusTemplateMetadata } from '@/shared/contracts';
import { verifierOriginMatches, verifierTabKey, verifierUrlMatches } from '@/shared/verifier-url';
import { GRAPHQL_PREFETCH_REQUEST_MESSAGE } from '@/verify/x-graphql-prefetch-message';
import { hasMainWorldPrefetch } from '@/background/verifier-runtime';
import { describeTabForLog } from '@/background/page-state-tracker';
import { startCaptureTrace, stopCaptureTrace } from '@/background/capture-trace-recorder';
import { watchPrimusCaptureComplete } from '@/background/capture-signal';
import { PROOF_RUNTIME_TEARDOWN_EVENT } from '@/shared/proof-arming';
import { optionalPatternsForUrl } from '@/shared/proof-targets';

const ATTEST_TIMEOUT_MS = 10 * 60 * 1000;
const PRIMUS_RESPONSE_TIMEOUT_MS = 6 * 60 * 1000;
const RUN_ATTESTATION_TOTAL_TIMEOUT_MS = PRIMUS_RESPONSE_TIMEOUT_MS + 30_000;
const ATTESTATION_KEEPALIVE_MS = 12 * 60 * 1000;
const BRIDGE_CHECK_TIMEOUT_MS = 1500;
const BRIDGE_READY_WAIT_MS = 4_000;

const BRIDGE_READY_POLL_MS = 250;
const PRIMUS_SDK_VERSION = '0.3.14';
const PRIMUS_CLIENT_TYPE = '@primuslabs/zktls-js-sdk';
const RUN_ATTESTATION_RETRIES = 3;
const EXECUTE_ATTESTATION_RETRIES = 4;
const POST_NAVIGATION_SETTLE_MS = 1500;
const TAB_STABLE_POLL_MS = 250;
const TARGET_DATA_READY_TIMEOUT_MS = 5 * 60 * 1000;
const TARGET_DATA_READY_POLL_MS = 3_000;
const PRIMUS_ALGORITHM_PROGRESS_POLL_MS = 3_000;
const PRIMUS_OFFLINE_PROGRESS_AFTER_MS = 60_000;
const PRIMUS_OFFLINE_STALL_TIMEOUT_MS = 4 * 60 * 1000;
const RUNTIME_GUARD_SCRIPT = 'kaito-runtime-guard.js';
const PRIMUS_BRIDGE_SCRIPT = 'padoZKAttestationJSSDK.bundle.js';
const PRIMUS_MARKER_SCRIPT = 'primus.js';
const PRIMUS_INIT_RESPONSE_TIMEOUT_MS = 20_000;
const BRIDGE_GENERATION_SESSION_KEY = 'kaitoPrimusBridgeGeneration';
const BRIDGE_GENERATION_PAGE_GLOBAL = '__kaitoPrimusBridgeGeneration';
const BRIDGE_GENERATION_ISOLATED_GLOBAL = '__kaitoPrimusBridgeInstalledGeneration';
const PRIMUS_ACTIVE_STATE_KEYS = [
  'padoZKAttestationJSSDKBeginAttest',
  'padoZKAttestationJSSDKWalletAddress',
  'padoZKAttestationJSSDKAttestationPresetParams',
  'padoZKAttestationJSSDKXFollowerCount',
  'activeRequestAttestation',
  'beginAttest',
  'getAttestationResultRes',
];
const PRIMUS_DAPP_TAB_ID_KEY = 'padoZKAttestationJSSDKDappTabId';
const PRIMUS_DISALLOW_TAB_CREATE_KEY = 'kaitoPrimusDisallowTabCreate';

const tabsWithFreshBridge = new Set<number>();

let bridgeGenerationPromise: Promise<string> | undefined;

function bridgeGeneration(): Promise<string> {
  bridgeGenerationPromise ??= (async () => {
    const stored = await chrome.storage.session.get(BRIDGE_GENERATION_SESSION_KEY);
    const existing = stored?.[BRIDGE_GENERATION_SESSION_KEY];
    if (typeof existing === 'string' && existing) return existing;
    const fresh = crypto.randomUUID();
    await chrome.storage.session.set({ [BRIDGE_GENERATION_SESSION_KEY]: fresh });
    return fresh;
  })();
  return bridgeGenerationPromise;
}

const extensionCreatedTabs = new Set<number>();
const verifierTabsByKey = new Map<string, number>();
const verifierTabCreations = new Map<string, Promise<number>>();

type SignedRequestPayload = {
  attRequest: {
    timeout?: number;
    [key: string]: unknown;
  };
  appSignature?: string;
  kaitoRawAttRequest?: string;
  [key: string]: unknown;
};

type PrimusStartPayload = SignedRequestPayload & {
  kaitoTemplate?: PrimusTemplateMetadata;
};

type DataSourceRequestTemplate = {
  requestTemplate?: {
    targetUrlExpression?: unknown;
    method?: unknown;
  };
  responseTemplate?: Array<{
    resolver?: {
      expression?: unknown;
    };
  }>;
};

type TargetDataProbe = {
  url: string;
  paths: string[];
};

export type PrimusTemplateTarget = {
  url?: string;
  urlExpression: string;
};

export type RunAttestationOptions = {
  windowId?: number;
  tabId?: number;
  silent?: boolean;
  allowCreateTab?: boolean;
  forceCreateTab?: boolean;
  attachDuringNavigation?: boolean;
  waitForTargetData?: boolean;
  onProgress?: (
    stage: 'opening_page' | 'reading_data' | 'generating_proof',
    message: string,
  ) => void;
  onTargetTab?: (tabId: number) => void | Promise<void>;

  isCanceled?: () => boolean;
};

type ExecuteResult<T> = chrome.scripting.InjectionResult<T>;
type AttestationBridgeResult =
  | { ok: true; attestation: Attestation; keys: string[] }
  | { ok: false; error: string };
type AttestationBridgeWireResult = string;
type PrimusAlgorithmStepDebug = {
  statusDescription?: string;
  elapsed?: string | number;
};
type PrimusAlgorithmDebug = {
  at?: number;
  details?: {
    initialization?: PrimusAlgorithmStepDebug;
    offline?: PrimusAlgorithmStepDebug;
    online?: PrimusAlgorithmStepDebug;
  };
};

export async function runAttestation(
  guideUrl: string,
  signedRequest: string,
  template?: PrimusTemplateMetadata,
  options: RunAttestationOptions = {},
): Promise<Attestation> {
  const payload = parseSignedRequest(signedRequest, template);
  return runAttestationAttempts(guideUrl, payload, template, options);
}

async function runAttestationAttempts(
  guideUrl: string,
  payload: PrimusStartPayload,
  template: PrimusTemplateMetadata | undefined,
  options: RunAttestationOptions,
): Promise<Attestation> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RUN_ATTESTATION_RETRIES; attempt += 1) {
    if (options.isCanceled?.()) {
      throw lastError instanceof Error
        ? lastError
        : new Error('verification_interrupted: canceled by user');
    }
    try {
      await clearPrimusAttestationState();
      options.onProgress?.('opening_page', 'Opening the platform page');
      let tabId = await ensureVerifierTab(guideUrl, options);
      await options.onTargetTab?.(tabId);
      traceTemplateCapture(tabId, template);
      if (shouldPrepareTargetDataBeforeAttestation(options)) {
        options.onProgress?.('reading_data', 'Waiting for account data');
        const preparedTabId = await preferVerifierTabWithTargetData(
          guideUrl,
          tabId,
          template,
          options,
        );
        if (preparedTabId !== tabId) traceTemplateCapture(preparedTabId, template);
        tabId = preparedTabId;
        await options.onTargetTab?.(tabId);
        options.onProgress?.('reading_data', 'Reading account data');
        await waitForTargetDataReady(tabId, template, options.isCanceled);
      }
      await ensurePrimusBridge(
        tabId,
        options.attachDuringNavigation ? { allowReinject: true } : {},
      );
      await keepAttestationWorkerAlive(tabId);
      logDev('starting primus attestation', {
        tabId,
        guideUrl,
        attempt,
        silent: Boolean(options.silent),
      });
      options.onProgress?.('generating_proof', 'Generating zk proof');
      const stopInterceptionWatch = watchPrimusInterceptionStart(tabId, template);
      const stopCaptureWatch = watchPrimusCaptureComplete(tabId);
      try {
        return await withAttestationTimeout(executeAttestationWithTabCreatePolicy(tabId, payload), {
          onProgress: options.onProgress,
          isCanceled: options.isCanceled,
        });
      } finally {
        stopInterceptionWatch();
        stopCaptureWatch();
        stopCaptureTrace();
      }
    } catch (error) {
      stopCaptureTrace();
      lastError = error;
      if (
        options.isCanceled?.() ||
        (!isTransientFrameError(error) && !isRetryableAttestationError(error)) ||
        attempt === RUN_ATTESTATION_RETRIES
      ) {
        throw error;
      }

      logDev('attestation failed with retryable error; retrying full flow', {
        guideUrl,
        attempt: attempt + 1,
        error: error instanceof Error ? error.message : String(error),
      });
      await delay(POST_NAVIGATION_SETTLE_MS);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError || 'attestation_failed'));
}

function traceTemplateCapture(tabId: number, template?: PrimusTemplateMetadata): void {
  startCaptureTrace(
    tabId,
    getPrimusTemplateTargetUrls(template),
    targetUrlMatches,
    PRIMUS_PAGE_DECODE_DEBUG_KEY,
  );
}

async function keepAttestationWorkerAlive(tabId: number): Promise<void> {
  await chrome.scripting
    .executeScript({
      target: { tabId },
      args: [ATTESTATION_KEEPALIVE_MS],
      func: (timeoutMs: number) => {
        const key = '__kaitoAttestationKeepAlive';
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

        const port = chrome.runtime.connect({ name: 'kaitoAttestationKeepAlive' });
        const timer = window.setTimeout(() => port.disconnect(), timeoutMs);
        global[key] = { port, timer };
        port.onDisconnect.addListener(() => {
          clearTimeout(timer);
          if (global[key]?.port === port) {
            delete global[key];
          }
        });
      },
    })
    .catch((error) => {
      logDev('attestation keepalive injection failed; continuing', {
        tabId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

function throwIfCanceled(isCanceled?: () => boolean): void {
  if (isCanceled?.()) {
    throw new Error('verification_interrupted: canceled mid-flight');
  }
}

async function withAttestationTimeout<T>(
  promise: Promise<T>,
  options: Pick<RunAttestationOptions, 'onProgress' | 'isCanceled'> = {},
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let watchdogTimer: ReturnType<typeof setInterval> | undefined;
  let watchdogReject: ((error: Error) => void) | undefined;
  let offlineRunningSince: number | undefined;
  let lastProgressMessage = '';
  let polling = false;
  const startedAt = Date.now();
  const watchdog = new Promise<T>((_, reject) => {
    watchdogReject = reject;
    watchdogTimer = setInterval(() => {
      if (options.isCanceled?.()) {
        watchdogReject?.(new Error('verification_interrupted: canceled mid-flight'));
        return;
      }
      if (polling) {
        return;
      }
      polling = true;
      void readPrimusAlgorithmDebug()
        .then((debug) => {
          const offline = debug?.details?.offline;
          const online = debug?.details?.online;
          if (!offline) {
            return;
          }
          const now = Date.now();
          const offlineStatus = String(offline.statusDescription || '').toUpperCase();
          const onlineStatus = String(online?.statusDescription || '').toUpperCase();
          if (offlineStatus !== 'RUNNING') {
            offlineRunningSince = undefined;
            return;
          }

          offlineRunningSince ??= now;
          const elapsedMs = Math.max(now - offlineRunningSince, now - startedAt);
          const elapsedSeconds = elapsedSecondsFromStep(offline, elapsedMs);
          if (elapsedMs >= PRIMUS_OFFLINE_PROGRESS_AFTER_MS) {
            const message =
              onlineStatus === 'DONE'
                ? `Captured account data, waiting for Primus offline proof (${elapsedSeconds}s)`
                : `Waiting for Primus proof engine (${elapsedSeconds}s)`;
            if (message !== lastProgressMessage) {
              lastProgressMessage = message;
              options.onProgress?.('generating_proof', message);
            }
          }

          if (elapsedMs >= PRIMUS_OFFLINE_STALL_TIMEOUT_MS) {
            watchdogReject?.(
              new Error(
                `proof_engine_stalled: Primus offline proof generation did not finish after ${elapsedSeconds}s`,
              ),
            );
          }
        })
        .catch((error) => {
          logDev('read primus algorithm debug failed', error);
        })
        .finally(() => {
          polling = false;
        });
    }, PRIMUS_ALGORITHM_PROGRESS_POLL_MS);
  });
  try {
    return await Promise.race([
      promise,
      watchdog,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('primus_attestation_total_timeout')),
          RUN_ATTESTATION_TOTAL_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (error) {
    await clearPrimusAttestationState();
    throw error;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    if (watchdogTimer) {
      clearInterval(watchdogTimer);
    }
  }
}

async function readPrimusAlgorithmDebug(): Promise<PrimusAlgorithmDebug | undefined> {
  const result = await chrome.storage.local.get('kaitoPreAlgorithmDebug').catch(() => undefined);
  const value = result?.kaitoPreAlgorithmDebug;
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  return value as PrimusAlgorithmDebug;
}

function elapsedSecondsFromStep(step: PrimusAlgorithmStepDebug, fallbackMs: number): number {
  const elapsed = typeof step.elapsed === 'number' ? step.elapsed : Number(step.elapsed);
  if (Number.isFinite(elapsed) && elapsed >= 0) {
    return Math.round(elapsed);
  }
  return Math.round(fallbackMs / 1000);
}

export async function clearPrimusAttestationState(): Promise<void> {
  await chrome.storage.local
    .remove([...PRIMUS_ACTIVE_STATE_KEYS, PRIMUS_DISALLOW_TAB_CREATE_KEY])
    .catch(() => undefined);
}

async function executeAttestationWithTabCreatePolicy(
  tabId: number,
  payload: PrimusStartPayload,
): Promise<Attestation> {
  await chrome.storage.local.set({
    [PRIMUS_DAPP_TAB_ID_KEY]: tabId,
    [PRIMUS_DISALLOW_TAB_CREATE_KEY]: true,
  });
  try {
    return await executeAttestation(tabId, payload);
  } finally {
    await chrome.storage.local.remove(PRIMUS_DISALLOW_TAB_CREATE_KEY).catch(() => undefined);
  }
}

export async function readJsonFromVerifierPage<T>(
  guideUrl: string,
  requestPath: string,
  options: RunAttestationOptions = {},
): Promise<{ ok: boolean; status: number; value: T | null }> {
  if (requestPath !== '__kaito_preflight_x_analytics__') {
    throw new Error(`unsupported_verifier_preflight:${requestPath}`);
  }
  const tabId = await ensureVerifierTab(guideUrl, options);
  await options.onTargetTab?.(tabId);
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    args: [requestPath],
    func: async (path: string) => {
      if (path === '__kaito_preflight_x_analytics__') {
        if (!location.hostname.endsWith('x.com')) {
          return {
            ok: true,
            status: 200,
            value: { reason: 'wrong_host', host: location.hostname },
          };
        }
        const ct0 = document.cookie
          .split('; ')
          .find((entry) => entry.startsWith('ct0='))
          ?.slice(4);
        if (!ct0) {
          return { ok: true, status: 200, value: { reason: 'not_signed_in' } };
        }
        const twid = document.cookie
          .split('; ')
          .find((entry) => entry.startsWith('twid='))
          ?.slice(5);
        const viewerMatch = twid ? /^u(?:=|%3D)(\d+)$/i.exec(twid) : null;
        const viewerId = viewerMatch ? viewerMatch[1] : null;

        const BEARER =
          'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
        const DAY = 86_400_000;
        const midnight = new Date();
        midnight.setUTCHours(0, 0, 0, 0);
        const to = midnight.getTime() + DAY;
        const from = to - 7 * DAY;
        const iso = (ms: number) => new Date(ms).toISOString();
        const variables = {
          current_from: from,
          current_from_iso: iso(from),
          current_to: to,
          current_to_iso: iso(to),
          prev_from: from - 7 * DAY,
          prev_from_iso: iso(from - 7 * DAY),
          prev_to: from,
          prev_to_iso: iso(from),
          backfill_from: to - 2 * DAY,
          backfill_to: to,
          show_verified_followers: true,
        };
        const response = await fetch(
          'https://x.com/i/api/graphql/_P1caq0YB4SVuEtFLPDMfQ/accountOverviewDailyQuery?variables=' +
            encodeURIComponent(JSON.stringify(variables)),
          {
            credentials: 'include',
            cache: 'no-store',
            headers: {
              authorization: BEARER,
              'x-csrf-token': ct0,
              'x-twitter-auth-type': 'OAuth2Session',
              'x-twitter-active-user': 'yes',
            },
          },
        );
        const text = await response.text();
        let parsed: any = null;
        try {
          parsed = JSON.parse(text);
        } catch {}
        const errors: string[] = Array.isArray(parsed?.errors)
          ? parsed.errors.map((entry: { message?: unknown }) => String(entry?.message ?? ''))
          : [];
        return {
          ok: true,
          status: 200,
          value: {
            viewerId,
            overview: { ok: response.ok, status: response.status, errors },
            hasSeries: Array.isArray(
              parsed?.data?.viewer_v2?.user_results?.result?.current_time_series,
            ),
          },
        };
      }

      return { ok: false, status: 0, value: { reason: 'unsupported_preflight_path', path } };
    },
  });

  const payload = unwrapInjectionResult(result, 'verifier_page_fetch_failed');
  return payload as { ok: boolean; status: number; value: T | null };
}

export function getPrimusTemplateTargetUrls(template?: PrimusTemplateMetadata): string[] {
  return getPrimusTemplateTargets(template).map((target) => target.urlExpression);
}

export function getPrimusTemplateTargets(
  template?: PrimusTemplateMetadata,
): PrimusTemplateTarget[] {
  return getTargetEntries(template).map((entry) => ({
    url: exactUrlFromTargetExpression(entry.expression),
    urlExpression: entry.expression,
  }));
}

function parseSignedRequest(value: string, template?: PrimusTemplateMetadata): PrimusStartPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('signed_request_invalid_json');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('signed_request_invalid_payload');
  }

  const payload = parsed as SignedRequestPayload;
  if (!payload.attRequest || typeof payload.attRequest !== 'object') {
    throw new Error('signed_request_missing_att_request');
  }

  const kaitoRawAttRequest = extractAttRequestJson(value);
  return template
    ? { ...payload, kaitoRawAttRequest, kaitoTemplate: template }
    : { ...payload, kaitoRawAttRequest };
}

function extractAttRequestJson(value: string): string {
  const match = /"attRequest"\s*:/.exec(value);
  if (!match) {
    throw new Error('signed_request_missing_att_request');
  }

  let index = match.index + match[0].length;
  while (/\s/.test(value[index] || '')) {
    index += 1;
  }

  if (value[index] !== '{') {
    throw new Error('signed_request_att_request_not_object');
  }

  const start = index;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (; index < value.length; index += 1) {
    const char = value[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      depth += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return value.slice(start, index + 1);
      }
    }
  }

  throw new Error('signed_request_att_request_unclosed');
}

async function ensureVerifierTab(
  guideUrl: string,
  options: RunAttestationOptions = {},
): Promise<number> {
  const tabKey = `${verifierTabKey(guideUrl)}:${options.windowId ?? 'any'}`;
  if (options.tabId !== undefined) {
    return ensureSpecifiedVerifierTab(guideUrl, tabKey, options.tabId, options);
  }

  if (!options.forceCreateTab) {
    const creating = verifierTabCreations.get(tabKey);
    if (creating) {
      return creating;
    }
  }

  const creation = ensureVerifierTabOnce(guideUrl, tabKey, options).finally(() => {
    verifierTabCreations.delete(tabKey);
  });
  verifierTabCreations.set(tabKey, creation);
  return creation;
}

async function ensureSpecifiedVerifierTab(
  guideUrl: string,
  tabKey: string,
  tabId: number,
  options: RunAttestationOptions = {},
): Promise<number> {
  const tab = await chrome.tabs.get(tabId).catch(() => undefined);
  if (!tab) {
    throw new Error('auto_verifier_tab_missing');
  }
  if (!verifierUrlMatches(tab.url || tab.pendingUrl, guideUrl)) {
    throw new Error('auto_verifier_tab_mismatch');
  }

  verifierTabsByKey.set(tabKey, tabId);
  await options.onTargetTab?.(tabId);
  if (options.attachDuringNavigation) {
    await ensureFreshBridgeScriptsDuringNavigation(tabId);
    return tabId;
  }

  await waitForTabReady(tabId);
  await waitForTabToSettle(tabId);
  await ensureFreshBridgeScripts(tabId);
  return tabId;
}

async function activateTab(tab: chrome.tabs.Tab): Promise<boolean> {
  if (tab.id === undefined) return false;
  await chrome.tabs.update(tab.id, { active: true }).catch(() => undefined);
  if (tab.windowId !== undefined) {
    await chrome.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
  }
  const current = await chrome.tabs.get(tab.id).catch(() => undefined);
  return current?.active === true;
}

async function ensureVerifierTabOnce(
  guideUrl: string,
  tabKey: string,
  options: RunAttestationOptions,
): Promise<number> {
  const existing = options.forceCreateTab
    ? undefined
    : await findVerifierTab(guideUrl, tabKey, options.windowId);
  const reusable =
    existing?.id !== undefined && (options.silent || (await activateTab(existing)))
      ? existing
      : undefined;
  if (reusable?.id !== undefined) {
    verifierTabsByKey.set(tabKey, reusable.id);
    await options.onTargetTab?.(reusable.id);
    const existingId = reusable.id;
    await waitForTabReady(existingId);
    await waitForTabToSettle(existingId);
    await ensureFreshBridgeScripts(existingId);
    return existingId;
  }

  if (options.allowCreateTab === false) {
    throw new Error('auto_verifier_tab_missing');
  }

  const replaced = options.forceCreateTab ? verifierTabsByKey.get(tabKey) : undefined;
  const created = await chrome.tabs.create({
    url: guideUrl,
    active: !options.silent,
    windowId: options.windowId,
  });
  if (typeof created.id !== 'number') {
    throw new Error('verifier_tab_create_failed');
  }
  verifierTabsByKey.set(tabKey, created.id);
  extensionCreatedTabs.add(created.id);
  await options.onTargetTab?.(created.id);
  if (replaced !== undefined && replaced !== created.id && extensionCreatedTabs.has(replaced)) {
    extensionCreatedTabs.delete(replaced);
    void chrome.tabs.remove(replaced).catch(() => undefined);
  }
  if (options.attachDuringNavigation) {
    await ensureFreshBridgeScriptsDuringNavigation(created.id);
    return created.id;
  }
  await waitForTabReady(created.id);
  await waitForTabToSettle(created.id);
  await ensureFreshBridgeScripts(created.id);
  return created.id;
}

async function preferVerifierTabWithTargetData(
  guideUrl: string,
  currentTabId: number,
  template?: PrimusTemplateMetadata,
  options: RunAttestationOptions = {},
): Promise<number> {
  const targets = getPrimusTemplateTargetUrls(template);
  if (targets.length === 0) {
    return currentTabId;
  }

  const tabs = await chrome.tabs
    .query(options.windowId === undefined ? {} : { windowId: options.windowId })
    .catch(() => []);
  const matches = tabs.filter(
    (tab) => tab.id !== undefined && verifierUrlMatches(tab.url || tab.pendingUrl, guideUrl),
  );
  const ordered = [
    ...matches.filter((tab) => tab.id === currentTabId),
    ...matches.filter((tab) => tab.active && tab.id !== currentTabId),
    ...matches.filter((tab) => !tab.active && tab.id !== currentTabId),
  ];

  for (const tab of ordered) {
    if (tab.id === undefined) {
      continue;
    }
    const urls = await collectTargetFetchUrls(tab.id, template);
    if (urls.length >= targets.length) {
      verifierTabsByKey.set(`${verifierTabKey(guideUrl)}:${options.windowId ?? 'any'}`, tab.id);
      if (!options.silent) {
        await chrome.tabs.update(tab.id, { active: true }).catch(() => undefined);
        if (tab.windowId !== undefined) {
          await chrome.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
        }
      }
      await ensureFreshBridgeScripts(tab.id).catch(() => undefined);
      logDev('selected verifier tab with target data', { tabId: tab.id, urls });
      return tab.id;
    }
  }

  return currentTabId;
}

export function isExtensionCreatedVerifierTab(tabId: number): boolean {
  return extensionCreatedTabs.has(tabId);
}

chrome.tabs?.onRemoved.addListener((tabId) => {
  tabsWithFreshBridge.delete(tabId);
  extensionCreatedTabs.delete(tabId);
  for (const [key, cachedTabId] of verifierTabsByKey) {
    if (cachedTabId === tabId) {
      verifierTabsByKey.delete(key);
    }
  }
});

chrome.tabs?.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' || changeInfo.url) {
    tabsWithFreshBridge.delete(tabId);
  }
});

async function findVerifierTab(
  guideUrl: string,
  tabKey: string,
  windowId?: number,
): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query(windowId === undefined ? {} : { windowId });
  const matches = tabs.filter((tab) => verifierUrlMatches(tab.url || tab.pendingUrl, guideUrl));
  const activeMatch = matches.find((tab) => tab.active);
  if (activeMatch) {
    return activeMatch;
  }

  const cachedTabId = verifierTabsByKey.get(tabKey);
  if (cachedTabId !== undefined) {
    const candidate = await chrome.tabs.get(cachedTabId).catch(() => undefined);
    const cached =
      windowId === undefined || candidate?.windowId === windowId ? candidate : undefined;
    if (cached && verifierUrlMatches(cached.url || cached.pendingUrl, guideUrl)) {
      return cached;
    }

    if (
      cached &&
      extensionCreatedTabs.has(cachedTabId) &&
      verifierOriginMatches(cached.url || cached.pendingUrl, guideUrl)
    ) {
      logDev('reusing extension-created verifier tab whose SPA route moved', {
        tabId: cachedTabId,
        url: cached.url || cached.pendingUrl,
        guideUrl,
      });
      if (optionalPatternsForUrl(guideUrl).length === 0) return cached;
      const back = await chrome.tabs.update(cachedTabId, { url: guideUrl }).catch(() => undefined);
      if (back) return back;
    }
    verifierTabsByKey.delete(tabKey);
  }

  return matches[0];
}

const X_DOCUMENT_READY_POLL_MS = 2_000;
const X_INTERACTIVE_GRACE_MS = 10_000;

async function xDocumentReady(tabId: number): Promise<boolean> {
  const tab = await chrome.tabs.get(tabId).catch(() => undefined);
  if (!tab || tab.pendingUrl || !isXUrl(tab.url)) return false;
  const [result] = await chrome.scripting
    .executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => ({
        state: document.readyState,
        href: location.href,
        age: Date.now() - performance.timeOrigin,
      }),
    })
    .catch(() => []);
  const page = result?.result as { state?: string; href?: string; age?: number } | undefined;
  if (!page || page.href !== tab.url) return false;
  return (
    page.state === 'complete' ||
    (page.state === 'interactive' && (page.age ?? 0) >= X_INTERACTIVE_GRACE_MS)
  );
}

function isXUrl(url: string | undefined): boolean {
  try {
    const host = new URL(url || '').hostname;
    return host === 'x.com' || host.endsWith('.x.com');
  } catch {
    return false;
  }
}

async function waitForTabReady(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  if (tab.status === 'complete' && !tab.pendingUrl) {
    return;
  }

  const waitStartedAt = Date.now();
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let poll: ReturnType<typeof setInterval> | undefined;
    const finish = (outcome: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (poll !== undefined) clearInterval(poll);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      outcome();
    };
    const timer = setTimeout(() => {
      void describeTabForLog(tabId, undefined, waitStartedAt)
        .catch(() => 'page=unknown')
        .then((page) => finish(() => reject(new Error(`verifier_tab_load_timeout ${page}`))));
    }, 30_000);

    const onUpdated = (updatedTabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') {
        return;
      }
      void chrome.tabs
        .get(tabId)
        .then((current) => {
          if (current.status === 'complete' && !current.pendingUrl) finish(resolve);
        })
        .catch(() => undefined);
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
    void chrome.tabs
      .get(tabId)
      .then((current) => {
        if (current.status === 'complete' && !current.pendingUrl) finish(resolve);
      })
      .catch(() => undefined);
    poll = setInterval(() => {
      void xDocumentReady(tabId).then((ready) => {
        if (ready) finish(resolve);
      });
    }, X_DOCUMENT_READY_POLL_MS);
  });
}

async function waitForTabToSettle(tabId: number): Promise<void> {
  let previousUrl = '';
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    await waitForTabReady(tabId);
    const before = await chrome.tabs.get(tabId);
    previousUrl = before.url || previousUrl;
    await delay(POST_NAVIGATION_SETTLE_MS);
    const after = await chrome.tabs.get(tabId);
    const ready =
      !after.pendingUrl && (after.status === 'complete' || (await xDocumentReady(tabId)));
    if (ready && after.url === previousUrl) {
      return;
    }
    await delay(TAB_STABLE_POLL_MS);
  }

  logDev('tab did not fully settle before attestation; continuing', { tabId, url: previousUrl });
}

function getTemplateDataSource(template?: PrimusTemplateMetadata): string {
  const withDataSourceId = template as
    | (PrimusTemplateMetadata & { dataSourceId?: unknown })
    | undefined;
  return String(template?.dataSource || withDataSourceId?.dataSourceId || '').toLowerCase();
}

function shouldPrepareTargetDataBeforeAttestation(options: RunAttestationOptions): boolean {
  if (options.waitForTargetData === false) {
    return false;
  }
  return Boolean(options.silent);
}

async function ensurePrimusBridge(
  tabId: number,
  options: { allowReinject?: boolean; waitMs?: number } = {},
): Promise<void> {
  const waitMs = options.waitMs ?? BRIDGE_READY_WAIT_MS;
  if (options.allowReinject) {
    tabsWithFreshBridge.delete(tabId);
    await injectFreshBridgeScripts(tabId);
    if (await pollPrimusBridgeReady(tabId, waitMs)) {
      return;
    }
  }

  await ensureFreshBridgeScripts(tabId);
  if (await pollPrimusBridgeReady(tabId, waitMs)) {
    return;
  }

  if (options.allowReinject) {
    logDev('primus bridge not ready; forcing re-injection into settled tab', { tabId });
    tabsWithFreshBridge.delete(tabId);
    await injectFreshBridgeScripts(tabId);
    if (await pollPrimusBridgeReady(tabId, waitMs)) {
      return;
    }
  }

  throw new Error('primus_bridge_unavailable');
}

async function pollPrimusBridgeReady(tabId: number, waitMs: number): Promise<boolean> {
  const deadline = Date.now() + waitMs;
  const generation = await bridgeGeneration();
  while (Date.now() < deadline) {
    if (await probePrimusBridge(tabId, generation)) {
      return true;
    }
    await delay(BRIDGE_READY_POLL_MS);
  }
  return false;
}

async function waitForTargetDataReady(
  tabId: number,
  template?: PrimusTemplateMetadata,
  isCanceled?: () => boolean,
): Promise<void> {
  const probes = getTargetDataProbes(template);
  const targetUrls = getPrimusTemplateTargetUrls(template);

  forgetObservedTargetUrls(tabId);

  const stopObserving = observeTargetUrls(
    tabId,
    probes.length > 0 ? probes : targetUrls.map((url) => ({ url, paths: [] })),
  );
  try {
    await requestGraphqlPrefetch(tabId, template);
    await pollTargetDataReady(tabId, template, probes, targetUrls, isCanceled);
  } finally {
    stopObserving();
  }
}

async function pollTargetDataReady(
  tabId: number,
  template: PrimusTemplateMetadata | undefined,
  probes: TargetDataProbe[],
  targetUrls: string[],
  isCanceled?: () => boolean,
): Promise<void> {
  if (targetUrls.length > 0) {
    const urls = await collectTargetFetchUrls(tabId, template);
    if (urls.length >= targetUrls.length) {
      logDev('target verifier requests already present', { tabId, urls });
      return;
    }
  }

  if (probes.length === 0) {
    await waitForTargetResourceEntries(tabId, targetUrls, isCanceled);
    return;
  }

  const deadline = Date.now() + TARGET_DATA_READY_TIMEOUT_MS;
  let lastError = '';
  while (Date.now() < deadline) {
    throwIfCanceled(isCanceled);
    try {
      const result = await probeTargetData(tabId, probes);
      if (result.ready) {
        logDev('target verifier data is ready', { tabId, urls: probes.map((probe) => probe.url) });
        return;
      }
      lastError = result.reason || lastError;
    } catch (error) {
      if (isTransientFrameError(error)) {
        await waitForTabToSettle(tabId).catch(() => undefined);
      }
      lastError = error instanceof Error ? error.message : String(error);
    }

    logDev('waiting for target verifier data before attestation', {
      tabId,
      reason: lastError,
      urls: probes.map((probe) => probe.url),
    });
    const remainingMs = Math.max(0, deadline - Date.now());
    const sawTargetRequest = await waitForTargetRequestEvent(
      tabId,
      probes,
      Math.min(TARGET_DATA_READY_POLL_MS, remainingMs),
    );
    if (sawTargetRequest) {
      logDev('target verifier request observed', { tabId, urls: probes.map((probe) => probe.url) });
      return;
    }
  }

  throw new Error(
    `target_data_not_ready: ${lastError || 'timed out waiting for verifier page login data'}`,
  );
}

async function waitForTargetResourceEntries(
  tabId: number,
  targetExpressions: string[],
  isCanceled?: () => boolean,
): Promise<void> {
  if (targetExpressions.length === 0) {
    return;
  }

  const deadline = Date.now() + TARGET_DATA_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    throwIfCanceled(isCanceled);

    const tab = await chrome.tabs.get(tabId).catch(() => undefined);
    if (!tab) {
      throw new Error('target_data_not_ready: verifier tab was closed');
    }

    try {
      const urls = await collectTargetFetchUrls(tabId, {
        dataSourceTemplate: JSON.stringify(
          targetExpressions.map((expression) => ({
            requestTemplate: { targetUrlExpression: expression, method: 'GET' },
            responseTemplate: [],
          })),
        ),
      } as PrimusTemplateMetadata);

      if (urls.length >= 1) {
        if (urls.length < targetExpressions.length) {
          logDev('proceeding with partial verifier target requests', {
            tabId,
            found: urls.length,
            declared: targetExpressions.length,
          });
        }
        return;
      }
      logDev('waiting for verifier page target requests', {
        tabId,
        found: urls.length,
        expected: targetExpressions.length,
      });
    } catch (error) {
      if (isTransientFrameError(error)) {
        await waitForTabToSettle(tabId).catch(() => undefined);
      }
      logDev('waiting for verifier page target requests failed', {
        tabId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await delay(TARGET_DATA_READY_POLL_MS);
  }

  throw new Error('target_data_not_ready: timed out waiting for verifier page target requests');
}

const observedTargetUrls = new Map<string, string>();

function observedTargetUrlKey(tabId: number, expression: string): string {
  return `${tabId}|${expression}`;
}

function recordObservedTargetUrl(tabId: number, expression: string, url: string): void {
  observedTargetUrls.set(observedTargetUrlKey(tabId, expression), url);
}

function forgetObservedTargetUrls(tabId: number): void {
  for (const key of observedTargetUrls.keys()) {
    if (key.startsWith(`${tabId}|`)) {
      observedTargetUrls.delete(key);
    }
  }
}

const GRAPHQL_PREFETCH_DATA_SOURCE = 'x';

function graphqlPrefetchOperations(template?: PrimusTemplateMetadata): string[] {
  const names = new Set<string>();
  for (const entry of getTargetEntries(template)) {
    const match = /\/graphql\/[^/]*\/([A-Za-z0-9_]+)/.exec(entry.expression);
    if (match) names.add(match[1]);
  }
  return [...names];
}

const PRIMUS_PAGE_DECODE_DEBUG_KEY = 'kaitoPageDecodeInitDebug';

async function requestGraphqlPrefetch(
  tabId: number,
  template?: PrimusTemplateMetadata,
): Promise<void> {
  if (getTemplateDataSource(template) !== GRAPHQL_PREFETCH_DATA_SOURCE) {
    return;
  }
  const operations = graphqlPrefetchOperations(template);
  if (operations.length === 0) {
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      args: [GRAPHQL_PREFETCH_REQUEST_MESSAGE, operations],
      func: (source: string, ops: string[]) => {
        for (const operation of ops) {
          window.postMessage({ source, operation }, window.location.origin);
        }
      },
    });
    logDev('asked the x.com page for a GraphQL prefetch', { tabId, operations });
  } catch (error) {
    logDev('asking the x.com page for a GraphQL prefetch failed', {
      tabId,
      operations,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function watchPrimusInterceptionStart(
  tabId: number,
  template?: PrimusTemplateMetadata,
): () => void {
  const dataSource = getTemplateDataSource(template);
  const refire = dataSource === GRAPHQL_PREFETCH_DATA_SOURCE ? requestGraphqlPrefetch : undefined;
  if (!refire || !chrome.storage?.onChanged) {
    return () => undefined;
  }

  const onChanged = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== 'local') {
      return;
    }
    const debug = changes[PRIMUS_PAGE_DECODE_DEBUG_KEY]?.newValue as
      | { stage?: unknown; tabId?: unknown }
      | undefined;

    if (debug?.stage !== 'data_source_tab_ready') {
      return;
    }
    const pageTabId = typeof debug.tabId === 'number' ? debug.tabId : tabId;
    logDev('primus interception started; re-firing target requests', {
      tabId,
      pageTabId,
      dataSource,
    });
    void refire(pageTabId, template);
  };

  chrome.storage.onChanged.addListener(onChanged);
  return () => chrome.storage.onChanged.removeListener(onChanged);
}

function observeTargetUrls(tabId: number, probes: TargetDataProbe[]): () => void {
  const urlPatterns = getWebRequestUrlPatterns(probes);
  if (!chrome.webRequest?.onCompleted || urlPatterns.length === 0) {
    return () => undefined;
  }

  const onCompleted = (details: chrome.webRequest.OnCompletedDetails) => {
    if (details.tabId !== tabId || details.statusCode < 200 || details.statusCode >= 300) {
      return;
    }
    for (const probe of probes) {
      if (targetUrlMatches(details.url, probe.url)) {
        recordObservedTargetUrl(tabId, probe.url, details.url);
      }
    }
  };

  chrome.webRequest.onCompleted.addListener(onCompleted, { tabId, urls: urlPatterns });
  return () => chrome.webRequest.onCompleted.removeListener(onCompleted);
}

async function collectTargetFetchUrls(
  tabId: number,
  template?: PrimusTemplateMetadata,
): Promise<string[]> {
  const targets = getPrimusTemplateTargetUrls(template);
  if (targets.length === 0) {
    return [];
  }

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      args: [targets],
      func: (targetExpressions: string[]) => {
        const exactUrlFromExpression = (value: string): string | undefined => {
          let expression = value.trim();
          expression = expression.replace(/\(\?:\\\?\.\*\)\?\$$/, '');
          expression = expression.replace(/\$$/, '');
          if (!/^https?:\/\//.test(expression)) {
            return undefined;
          }
          if (/\\[dwsbDWSB]/.test(expression)) {
            return undefined;
          }
          if (/(?<!\\)[()[\]{}|+*?^$]/.test(expression)) {
            return undefined;
          }
          return expression.replace(/\\(.)/g, '$1');
        };

        const matches = (actualUrl: string, expectedUrl: string): boolean => {
          const exactUrl = exactUrlFromExpression(expectedUrl);
          if (exactUrl) {
            return actualUrl === exactUrl || actualUrl.startsWith(`${exactUrl}?`);
          }
          try {
            return new RegExp(`^${expectedUrl}`).test(actualUrl);
          } catch {
            return actualUrl === expectedUrl || actualUrl.startsWith(`${expectedUrl}?`);
          }
        };

        const resourceUrls = performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .filter((url) => /^https?:\/\//.test(url));
        const resolved = new Set<string>();
        for (const target of targetExpressions) {
          const exactUrl = exactUrlFromExpression(target);
          if (exactUrl) {
            resolved.add(exactUrl);
            continue;
          }
          const resourceUrl = [...resourceUrls].reverse().find((url) => matches(url, target));
          if (resourceUrl) {
            resolved.add(resourceUrl);
          }
        }
        return [...resolved];
      },
    });
    const urls = unwrapInjectionResult<string[]>(result, 'target_fetch_url_collect_failed').filter(
      (url) => typeof url === 'string' && /^https?:\/\//.test(url),
    );

    const resolved = [...urls];
    for (const target of targets) {
      if (resolved.some((url) => targetUrlMatches(url, target))) {
        continue;
      }
      const observed = observedTargetUrls.get(observedTargetUrlKey(tabId, target));
      if (observed) {
        logDev('resolved target fetch url from webRequest instead of the timing buffer', {
          tabId,
          target,
          url: observed,
        });
        resolved.push(observed);
      }
    }

    logDev('collected target fetch urls for Primus reuse', { tabId, urls: resolved });
    return resolved;
  } catch (error) {
    logDev('collect target fetch urls failed; falling back to Primus tab flow', {
      tabId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function getTargetEntries(template?: PrimusTemplateMetadata): Array<{
  expression: string;
  responseTemplate: NonNullable<DataSourceRequestTemplate['responseTemplate']>;
}> {
  if (!template?.dataSourceTemplate) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(template.dataSourceTemplate);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }

  const entries: Array<{
    expression: string;
    responseTemplate: NonNullable<DataSourceRequestTemplate['responseTemplate']>;
  }> = [];
  for (const entry of parsed as DataSourceRequestTemplate[]) {
    const method = String(entry?.requestTemplate?.method || 'GET').toUpperCase();
    if (method !== 'GET') {
      continue;
    }

    const expression = entry?.requestTemplate?.targetUrlExpression;
    if (typeof expression !== 'string' || expression.length === 0) {
      continue;
    }

    entries.push({
      expression,
      responseTemplate: entry.responseTemplate || [],
    });
  }

  return entries;
}

function getTargetDataProbes(template?: PrimusTemplateMetadata): TargetDataProbe[] {
  return getTargetEntries(template).map((entry) => ({
    url: entry.expression,
    paths: getSimpleJsonPaths(entry.responseTemplate),
  }));
}

function exactUrlFromTargetExpression(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

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

function getSimpleJsonPaths(
  responseTemplates: NonNullable<DataSourceRequestTemplate['responseTemplate']>,
): string[] {
  const paths: string[] = [];
  for (const response of responseTemplates) {
    const expression = response?.resolver?.expression;
    if (typeof expression === 'string' && /^\$((\.[A-Za-z0-9_$-]+)+)$/.test(expression)) {
      paths.push(expression);
    }
  }
  return paths;
}

async function probeTargetData(
  tabId: number,
  probes: TargetDataProbe[],
): Promise<{ ready: boolean; reason?: string }> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    args: [probes],
    func: async (targetProbes: TargetDataProbe[]) => {
      const readPath = (value: unknown, path: string): unknown => {
        if (!path.startsWith('$.')) {
          return undefined;
        }
        return path
          .slice(2)
          .split('.')
          .reduce<unknown>((current, key) => {
            if (!current || typeof current !== 'object') {
              return undefined;
            }
            return (current as Record<string, unknown>)[key];
          }, value);
      };

      for (const probe of targetProbes) {
        const exactUrlFromExpression = (value: string): string | undefined => {
          let expression = value.trim();
          expression = expression.replace(/\(\?:\\\?\.\*\)\?\$$/, '');
          expression = expression.replace(/\$$/, '');
          if (!/^https?:\/\//.test(expression)) {
            return undefined;
          }
          if (/\\[dwsbDWSB]/.test(expression)) {
            return undefined;
          }
          if (/(?<!\\)[()[\]{}|+*?^$]/.test(expression)) {
            return undefined;
          }
          return expression.replace(/\\(.)/g, '$1');
        };
        const targetUrlMatches = (actualUrl: string, expectedUrl: string): boolean => {
          const exactUrl = exactUrlFromExpression(expectedUrl);
          if (exactUrl) {
            return actualUrl === exactUrl || actualUrl.startsWith(`${exactUrl}?`);
          }
          try {
            return new RegExp(`^${expectedUrl}`).test(actualUrl);
          } catch {
            return actualUrl === expectedUrl || actualUrl.startsWith(`${expectedUrl}?`);
          }
        };
        const resourceUrls = performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .filter((url) => /^https?:\/\//.test(url));
        const pageRequestUrl = [...resourceUrls]
          .reverse()
          .find((url) => targetUrlMatches(url, probe.url));
        const fetchUrl = pageRequestUrl || exactUrlFromExpression(probe.url);
        const sawPageRequest = Boolean(pageRequestUrl);

        if (!fetchUrl) {
          return { ready: false, reason: `${probe.url} not requested by page yet` };
        }

        let response: Response;
        try {
          response = await fetch(fetchUrl, {
            credentials: 'include',
            cache: 'no-store',
          });
        } catch (error) {
          if (sawPageRequest) {
            continue;
          }
          return {
            ready: false,
            reason: `${probe.url} not requested by page yet (${error instanceof Error ? error.message : String(error)})`,
          };
        }

        if (!response.ok) {
          if (sawPageRequest) {
            continue;
          }
          return { ready: false, reason: `${probe.url} returned ${response.status}` };
        }

        if (probe.paths.length === 0) {
          continue;
        }

        let body: unknown;
        try {
          body = await response.json();
        } catch {
          return { ready: false, reason: `${probe.url} did not return JSON` };
        }

        const missing = probe.paths.filter((path) => readPath(body, path) === undefined);
        if (missing.length > 0) {
          return { ready: false, reason: `${probe.url} missing ${missing.slice(0, 3).join(', ')}` };
        }
      }

      return { ready: true };
    },
  });

  return unwrapInjectionResult(result, 'target_data_probe_failed');
}

function waitForTargetRequestEvent(
  tabId: number,
  probes: TargetDataProbe[],
  timeoutMs: number,
): Promise<boolean> {
  if (!chrome.webRequest?.onCompleted || timeoutMs <= 0) {
    return delay(timeoutMs).then(() => false);
  }

  const urlPatterns = getWebRequestUrlPatterns(probes);
  if (urlPatterns.length === 0) {
    return delay(timeoutMs).then(() => false);
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const cleanup = (value: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      chrome.webRequest.onCompleted.removeListener(onCompleted);
      resolve(value);
    };

    const onCompleted = (details: chrome.webRequest.OnCompletedDetails) => {
      if (details.tabId !== tabId || details.statusCode < 200 || details.statusCode >= 300) {
        return;
      }

      if (probes.some((probe) => targetUrlMatches(details.url, probe.url))) {
        cleanup(true);
      }
    };

    const timer = setTimeout(() => cleanup(false), timeoutMs);
    chrome.webRequest.onCompleted.addListener(onCompleted, {
      tabId,
      urls: urlPatterns,
    });
  });
}

function getWebRequestUrlPatterns(probes: TargetDataProbe[]): string[] {
  const patterns = new Set<string>();
  for (const probe of probes) {
    const pattern = webRequestPatternFromTargetExpression(probe.url);
    if (pattern) {
      patterns.add(pattern);
    }
  }
  return [...patterns];
}

function webRequestPatternFromTargetExpression(expression: string): string | undefined {
  const exactUrl = exactUrlFromTargetExpression(expression);
  if (exactUrl) {
    try {
      const url = new URL(exactUrl);
      return `${url.origin}/*`;
    } catch {
      return undefined;
    }
  }

  const match = /^https?:\/\/([^/]+)/.exec(expression);
  if (!match) {
    return undefined;
  }
  const host = match[1].replace(/\\\./g, '.');
  if (!host || /[()[\]{}|+*?^$]/.test(host)) {
    return undefined;
  }
  return `https://${host}/*`;
}

export function targetUrlMatches(actualUrl: string, expectedUrl: string): boolean {
  const exactUrl = exactUrlFromTargetExpression(expectedUrl);
  if (exactUrl) {
    return actualUrl === exactUrl || actualUrl.startsWith(`${exactUrl}?`);
  }

  try {
    return new RegExp(`^${expectedUrl}`).test(actualUrl);
  } catch {
    return actualUrl === expectedUrl || actualUrl.startsWith(`${expectedUrl}?`);
  }
}

async function ensureFreshBridgeScripts(tabId: number): Promise<void> {
  if (tabsWithFreshBridge.has(tabId)) {
    return;
  }

  const generation = await bridgeGeneration();
  if (await probePrimusBridge(tabId, generation).catch(() => false)) {
    tabsWithFreshBridge.add(tabId);
    return;
  }

  await injectFreshBridgeScripts(tabId);
}

async function injectFreshBridgeScripts(tabId: number): Promise<void> {
  const generation = await bridgeGeneration();
  const [installed] = await chrome.scripting.executeScript({
    target: { tabId },
    args: [BRIDGE_GENERATION_ISOLATED_GLOBAL, generation],
    func: (key: string, value: string) => {
      const scope = globalThis as unknown as Record<string, unknown>;
      if (scope[key] === value) return true;
      scope[key] = value;
      return false;
    },
  });
  if (!installed?.result) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [RUNTIME_GUARD_SCRIPT, PRIMUS_BRIDGE_SCRIPT],
    });
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    files: [PRIMUS_MARKER_SCRIPT],
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    args: [BRIDGE_GENERATION_PAGE_GLOBAL, generation],
    func: (key: string, value: string) => {
      (globalThis as unknown as Record<string, unknown>)[key] = value;
    },
  });
  tabsWithFreshBridge.add(tabId);
}

function invalidateBridge(tabId: number): void {
  tabsWithFreshBridge.delete(tabId);
}

async function ensureFreshBridgeScriptsDuringNavigation(tabId: number): Promise<void> {
  const deadline = Date.now() + 15_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      await ensureFreshBridgeScripts(tabId);
      return;
    } catch (error) {
      lastError = error;
      if (!isTransientFrameError(error)) {
        throw error;
      }
      await delay(BRIDGE_READY_POLL_MS);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('primus_bridge_injection_timeout');
}

async function probePrimusBridge(tabId: number, generation: string): Promise<boolean> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      args: [BRIDGE_CHECK_TIMEOUT_MS, BRIDGE_GENERATION_PAGE_GLOBAL, generation],
      func: async (timeoutMs: number, generationKey: string, expectedGeneration: string) => {
        if (
          (globalThis as unknown as Record<string, unknown>)[generationKey] !== expectedGeneration
        ) {
          return false;
        }
        return new Promise<boolean>((resolve) => {
          let settled = false;

          const cleanup = (value: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            window.removeEventListener('message', onMessage);
            resolve(value);
          };

          const onMessage = (event: MessageEvent) => {
            const data = event.data;
            if (data?.target === 'padoZKAttestationJSSDK' && data.name === 'checkIsInstalledRes') {
              cleanup(Boolean(data.params));
            }
          };

          const timer = window.setTimeout(() => cleanup(false), timeoutMs);
          window.addEventListener('message', onMessage);
          window.postMessage(
            {
              target: 'kaitoPadoExtension',
              origin: 'kaitoExtension',
              name: 'checkIsInstalled',
              params: {},
            },
            '*',
          );
        });
      },
    });

    return Boolean(result?.result);
  } catch (error) {
    if (!isTransientFrameError(error)) {
      throw error;
    }
    logDev('primus bridge probe skipped during navigation', {
      tabId,
      error: error instanceof Error ? error.message : String(error),
    });
    await waitForTabToSettle(tabId).catch(() => undefined);
    return false;
  }
}

async function executeAttestation(
  tabId: number,
  payload: PrimusStartPayload,
  allowBridgeRecovery = true,
): Promise<Attestation> {
  let result: ExecuteResult<AttestationBridgeWireResult> | undefined;
  const writeExecuteDebug = async (event: string, extra: Record<string, unknown> = {}) => {
    try {
      await chrome.storage.local.set({
        kaitoPrimusExecuteDebug: {
          at: Date.now(),
          tabId,
          event,
          ...extra,
        },
      });
    } catch {}
  };
  let sitePrefetchOwnsRequests = false;
  try {
    const tab = await chrome.tabs.get(tabId);
    const host = tab?.url ? new URL(tab.url).hostname : '';
    sitePrefetchOwnsRequests = host ? hasMainWorldPrefetch(host) : false;
  } catch {}
  for (let attempt = 0; attempt <= EXECUTE_ATTESTATION_RETRIES; attempt += 1) {
    try {
      await writeExecuteDebug('before_execute_script', { attempt });
      [result] = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        args: [
          payload,
          ATTEST_TIMEOUT_MS,
          PRIMUS_RESPONSE_TIMEOUT_MS,
          PRIMUS_SDK_VERSION,
          PRIMUS_CLIENT_TYPE,
          PRIMUS_INIT_RESPONSE_TIMEOUT_MS,
          PROOF_RUNTIME_TEARDOWN_EVENT,
          sitePrefetchOwnsRequests,
        ],
        func: async (
          attestationPayload: SignedRequestPayload,
          timeoutMs: number,
          responseTimeoutMs: number,
          sdkVersion: string,
          clientType: string,
          initResponseTimeoutMs: number,
          teardownEvent: string,
          sitePrefetchOwnsRequests: boolean,
        ) => {
          console.log('[kaito-attest] booting in MAIN world', {
            href: location.href,
            sdkVersion,
            clientType,
            windowPrimusVisible: typeof (window as { primus?: unknown }).primus !== 'undefined',
          });
          const encodeResult = (value: AttestationBridgeResult): string =>
            JSON.stringify(value, (_key, jsonValue) =>
              typeof jsonValue === 'bigint' ? jsonValue.toString() : jsonValue,
            );
          const appendTrace = (eventName: string, extra: Record<string, unknown> = {}) => {
            try {
              console.log('[kaito-attest-trace]', eventName, extra);
            } catch {}
          };

          return new Promise<AttestationBridgeWireResult>((resolve) => {
            let settled = false;
            let startRequested = false;
            let pollingTimer: number | undefined;
            let timeoutTimer: number | undefined;
            let responseTimeoutTimer: number | undefined;
            let triggerTimer: number | undefined;
            const pollingTimeoutMs =
              typeof attestationPayload?.attRequest?.timeout === 'number'
                ? Math.min(attestationPayload.attRequest.timeout, responseTimeoutMs)
                : timeoutMs;

            const cleanup = () => {
              if (settled) return;
              settled = true;
              if (pollingTimer !== undefined) {
                clearInterval(pollingTimer);
              }
              if (timeoutTimer !== undefined) {
                clearTimeout(timeoutTimer);
              }
              if (responseTimeoutTimer !== undefined) {
                clearTimeout(responseTimeoutTimer);
              }
              if (triggerTimer !== undefined) clearTimeout(triggerTimer);
              window.removeEventListener('message', onMessage);
              document.removeEventListener(teardownEvent, onTeardown);
            };

            const ALGORITHM_NOT_READY_RETRY_MS = 3_000;
            const ALGORITHM_NOT_READY_MAX_RETRIES = 10;
            let algorithmNotReadyRetries = 0;
            let algorithmRetryTimer: number | undefined;

            const fail = (error: string) => {
              if (algorithmRetryTimer !== undefined) clearTimeout(algorithmRetryTimer);
              cleanup();
              resolve(
                encodeResult({
                  ok: false,
                  error:
                    algorithmNotReadyRetries > 0
                      ? `${error} (algorithm_not_ready_retries=${algorithmNotReadyRetries})`
                      : error,
                }),
              );
            };
            const onTeardown = () => fail('verification_interrupted: proof runtime closed');

            const postStartAttestation = () => {
              appendTrace('adapter_post_startAttestation', {
                hasAttRequest: Boolean(attestationPayload?.attRequest),
                hasKaitoTemplate: Boolean(attestationPayload?.kaitoTemplate),
                retry: algorithmNotReadyRetries,
              });
              window.postMessage(
                {
                  target: 'kaitoPadoExtension',
                  origin: 'padoZKAttestationJSSDK',
                  name: 'startAttestation',
                  params: {
                    ...attestationPayload,
                    sdkVersion,
                    clientType,
                  },
                },
                '*',
              );
            };

            const isAlgorithmNotReady = (errorData: unknown): boolean => {
              try {
                return JSON.stringify(errorData ?? '')
                  .toLowerCase()
                  .includes('has not been initialized');
              } catch {
                return false;
              }
            };

            const retryWhenAlgorithmNotReady = (errorData: unknown): boolean => {
              if (!isAlgorithmNotReady(errorData)) return false;
              if (algorithmRetryTimer !== undefined) return true;
              if (algorithmNotReadyRetries >= ALGORITHM_NOT_READY_MAX_RETRIES) {
                fail('primus_algorithm_not_initialized');
                return true;
              }
              algorithmNotReadyRetries += 1;
              appendTrace('adapter_algorithm_not_ready_retry', {
                attempt: algorithmNotReadyRetries,
              });
              algorithmRetryTimer = window.setTimeout(() => {
                algorithmRetryTimer = undefined;
                if (settled) return;
                postStartAttestation();
              }, ALGORITHM_NOT_READY_RETRY_MS);
              return true;
            };

            const formatError = (fallback: string, errorData: unknown): string => {
              try {
                const attRequest = (attestationPayload as { attRequest?: Record<string, unknown> })
                  .attRequest;
                void chrome.storage.local.set({
                  kaitoPrimusFullErrorDebug: {
                    fallback,
                    errorData,
                    attRequest: attRequest
                      ? {
                          appId: attRequest.appId,
                          attTemplateID: attRequest.attTemplateID,
                          userAddress: attRequest.userAddress,
                          requestid: attRequest.requestid,
                          keys: Object.keys(attRequest),
                        }
                      : undefined,
                    hasAppSignature: Boolean(
                      (attestationPayload as { appSignature?: string }).appSignature,
                    ),
                    hasRawAttRequest: Boolean(
                      (attestationPayload as { kaitoRawAttRequest?: string }).kaitoRawAttRequest,
                    ),
                    rawAttRequestLength: (attestationPayload as { kaitoRawAttRequest?: string })
                      .kaitoRawAttRequest?.length,
                    at: Date.now(),
                  },
                });
              } catch {}
              if (!errorData || typeof errorData !== 'object') {
                return fallback;
              }
              const value = errorData as Record<string, unknown>;
              const code = typeof value.code === 'string' ? value.code : '';
              const detail =
                (typeof value.data === 'string' && value.data) ||
                (typeof value.desc === 'string' && value.desc) ||
                (typeof value.message === 'string' && value.message) ||
                '';
              const debug = JSON.stringify(errorData, (_key, jsonValue) =>
                typeof jsonValue === 'bigint' ? jsonValue.toString() : jsonValue,
              );
              return [code, detail, debug].filter(Boolean).join(': ') || fallback;
            };

            const isTransientAlgorithmError = (errorData: unknown): boolean => {
              if (!errorData || typeof errorData !== 'object') {
                return false;
              }
              const blob = JSON.stringify(errorData).toLowerCase();
              return (
                blob.includes('can not re-run online') || blob.includes('has not been initialized')
              );
            };

            const exactUrlFromExpression = (value: unknown): string | undefined => {
              if (typeof value !== 'string' || value.length === 0) {
                return undefined;
              }
              let expression = value.trim();
              expression = expression.replace(/\(\?:\\\?\.\*\)\?\$$/, '');
              expression = expression.replace(/\$$/, '');
              if (!/^https?:\/\//.test(expression)) {
                return undefined;
              }
              if (/\\[dwsbDWSB]/.test(expression)) {
                return undefined;
              }
              if (/(?<!\\)[()[\]{}|+*?^$]/.test(expression)) {
                return undefined;
              }
              return expression.replace(/\\(.)/g, '$1');
            };

            const targetUrlMatches = (actualUrl: string, expectedExpression: string): boolean => {
              const exactUrl = exactUrlFromExpression(expectedExpression);
              if (exactUrl) {
                return actualUrl === exactUrl || actualUrl.startsWith(`${exactUrl}?`);
              }
              try {
                return new RegExp(`^${expectedExpression}`).test(actualUrl);
              } catch {
                return (
                  actualUrl === expectedExpression || actualUrl.startsWith(`${expectedExpression}?`)
                );
              }
            };

            const triggerTemplateRequests = () => {
              triggerTimer = window.setTimeout(() => {
                if (settled) return;
                void (async () => {
                  let parsed: unknown;
                  try {
                    const template = (attestationPayload as PrimusStartPayload).kaitoTemplate;
                    parsed = template?.dataSourceTemplate
                      ? JSON.parse(template.dataSourceTemplate)
                      : [];
                  } catch {
                    parsed = [];
                  }
                  if (!Array.isArray(parsed)) {
                    return;
                  }

                  const resourceUrls = performance
                    .getEntriesByType('resource')
                    .map((entry) => entry.name)
                    .filter((url) => /^https?:\/\//.test(url));

                  const cleanRealm = (() => {
                    try {
                      const frame = document.createElement('iframe');
                      frame.style.display = 'none';
                      document.documentElement.appendChild(frame);
                      const cleanFetch = frame.contentWindow?.fetch?.bind(frame.contentWindow);
                      return { fetch: cleanFetch, cleanup: () => frame.remove() };
                    } catch {
                      return { fetch: undefined, cleanup: () => undefined };
                    }
                  })();

                  const synthesizeUrl = async (
                    expression: string,
                    candidateValues: string[],
                  ): Promise<string | undefined> => {
                    const token = expression.match(/\[[^\]]+\]\{\d+(?:,\d+)?\}/);
                    if (!token || token.index === undefined) {
                      return undefined;
                    }
                    const unescapeLiteral = (fragment: string) =>
                      fragment
                        .replace(/\(\?:\\\?\.\*\)\?\$?$/, '')
                        .replace(/\$$/, '')
                        .replace(/\\(.)/g, '$1');
                    const prefix = unescapeLiteral(expression.slice(0, token.index));
                    const suffix = unescapeLiteral(expression.slice(token.index + token[0].length));

                    if (/\[[^\]]+\]\{\d+/.test(expression.slice(token.index + token[0].length))) {
                      return undefined;
                    }
                    let valueRe: RegExp;
                    try {
                      valueRe = new RegExp(`^${token[0]}$`);
                    } catch {
                      return undefined;
                    }
                    const values = candidateValues.filter((candidate) => valueRe.test(candidate));
                    if (values.length === 0) {
                      return undefined;
                    }

                    if (!cleanRealm.fetch) {
                      return `${prefix}${values[0]}${suffix}`;
                    }
                    for (const value of values) {
                      const url = `${prefix}${value}${suffix}`;
                      try {
                        const response = await cleanRealm.fetch(url, {
                          credentials: 'include',
                          cache: 'no-store',
                        });
                        if (response.ok) {
                          return url;
                        }
                      } catch {}
                    }
                    return undefined;
                  };

                  const getTemplates = parsed.flatMap((entry) => {
                    const method = String(entry?.requestTemplate?.method || 'GET').toUpperCase();
                    if (method !== 'GET') {
                      return [];
                    }
                    const expression = entry?.requestTemplate?.targetUrlExpression;
                    if (typeof expression !== 'string' || expression.length === 0) {
                      return [];
                    }
                    return [expression];
                  });

                  const resolved = new Map<string, string>();
                  const pageFetched = new Set<string>();
                  const unresolved: string[] = [];
                  for (const expression of getTemplates) {
                    const matchedUrl = [...resourceUrls]
                      .reverse()
                      .find((url) => targetUrlMatches(url, expression));
                    if (matchedUrl) {
                      resolved.set(expression, matchedUrl);
                      pageFetched.add(matchedUrl);
                      continue;
                    }
                    const exactUrl = exactUrlFromExpression(expression);
                    if (exactUrl) {
                      resolved.set(expression, exactUrl);
                    } else {
                      unresolved.push(expression);
                    }
                  }

                  if (unresolved.length > 0) {
                    const bodyValues: string[] = [];
                    const fetchImpl = cleanRealm.fetch ?? window.fetch.bind(window);
                    const harvestVariant = (target: string) =>
                      `${target}${target.includes('?') ? '&' : '?'}kaito_hv=1`;
                    for (const url of new Set(resolved.values())) {
                      try {
                        const res = await fetchImpl(harvestVariant(url), {
                          credentials: 'include',
                          cache: 'no-store',
                        });
                        if (!res.ok) continue;
                        const stack: unknown[] = [await res.json()];
                        while (stack.length > 0 && bodyValues.length < 500) {
                          const cur = stack.pop();
                          if (typeof cur === 'string') {
                            if (cur.length >= 8 && cur.length <= 200) bodyValues.push(cur);
                          } else if (Array.isArray(cur)) {
                            stack.push(...cur);
                          } else if (cur && typeof cur === 'object') {
                            stack.push(...Object.values(cur as Record<string, unknown>));
                          }
                        }
                      } catch {}
                    }
                    const candidateValues = [
                      ...document.cookie.split(/;\s*/).flatMap((part) => part.split('=')),
                      ...[...resolved.values()].flatMap((url) => url.split(/[/?#&=]/)),
                      ...resourceUrls.flatMap((url) => url.split(/[/?#&=]/)),
                      ...bodyValues,
                    ]
                      .map((segment) => segment.trim())
                      .filter(Boolean)
                      .filter((segment, index, all) => all.indexOf(segment) === index);
                    for (const expression of unresolved) {
                      const synthesized = await synthesizeUrl(expression, candidateValues);
                      if (synthesized) {
                        resolved.set(expression, synthesized);
                        console.log('[kaito-attest] synthesized target request URL', synthesized);
                      } else {
                        console.log('[kaito-attest] target request URL unresolved', expression);
                      }
                    }
                  }
                  const urls = [...resolved.values()].filter(
                    (url, index, all) => all.indexOf(url) === index,
                  );

                  const probeCredentials = async (
                    url: string,
                  ): Promise<RequestCredentials | null> => {
                    if (!cleanRealm.fetch) {
                      return 'include';
                    }
                    let everyAttemptThrew = true;
                    for (const credentials of ['include', 'omit'] as const) {
                      try {
                        const response = await cleanRealm.fetch(url, {
                          credentials,
                          cache: 'no-store',
                        });
                        everyAttemptThrew = false;
                        if (response.ok) {
                          return credentials;
                        }
                      } catch {}
                    }
                    return everyAttemptThrew ? 'include' : null;
                  };

                  if (sitePrefetchOwnsRequests) {
                    return;
                  }

                  for (const url of urls) {
                    if (settled) break;
                    if (pageFetched.has(url)) {
                      console.log('[kaito-attest] skip trigger (page already fetched it)', url);
                      continue;
                    }
                    const credentials = await probeCredentials(url);
                    if (settled) break;
                    if (!credentials) {
                      console.log(
                        '[kaito-attest] skip trigger (bare request not 2xx; rely on page traffic)',
                        url,
                      );
                      continue;
                    }
                    try {
                      await fetch(url, { credentials, cache: 'no-store' });
                      console.log(
                        '[kaito-attest] triggered target request for Primus capture',
                        url,
                        credentials,
                      );
                    } catch (error) {
                      console.log('[kaito-attest] target request trigger failed', url, error);
                    }
                  }

                  cleanRealm.cleanup();
                })();
              }, 1_500);
            };

            const onMessage = (event: MessageEvent) => {
              if (settled) return;
              const data = event.data;
              if (data?.target !== 'padoZKAttestationJSSDK') {
                return;
              }

              if (data.name === 'initAttestationRes') {
                appendTrace('adapter_receive_initAttestationRes', {
                  result: data.params?.result === true,
                  errorCode: data.params?.errorData?.code || null,
                });
                if (!data.params?.result) {
                  fail(formatError('primus_init_failed', data.params?.errorData));
                  return;
                }
                if (startRequested) {
                  return;
                }
                startRequested = true;
                if (responseTimeoutTimer !== undefined) {
                  clearTimeout(responseTimeoutTimer);
                }
                responseTimeoutTimer = window.setTimeout(() => {
                  fail('primus_attestation_no_response');
                }, responseTimeoutMs);

                postStartAttestation();
                triggerTemplateRequests();
                return;
              }

              if (data.name === 'getAttestationRes') {
                if (!data.params?.result) {
                  if (retryWhenAlgorithmNotReady(data.params?.errorData)) {
                    return;
                  }
                  if (isTransientAlgorithmError(data.params?.errorData)) {
                    console.log(
                      '[kaito-attest] ignoring transient getAttestationRes error (concurrent run)',
                    );
                    return;
                  }
                  fail(formatError('primus_attestation_failed', data.params?.errorData));
                  return;
                }

                if (pollingTimer !== undefined || timeoutTimer !== undefined) {
                  return;
                }

                timeoutTimer = window.setTimeout(() => {
                  cleanup();
                  window.postMessage(
                    {
                      target: 'kaitoPadoExtension',
                      origin: 'padoZKAttestationJSSDK',
                      name: 'getAttestationResultTimeout',
                      params: {},
                    },
                    '*',
                  );
                  resolve(encodeResult({ ok: false, error: 'attestation_timeout' }));
                }, pollingTimeoutMs);

                pollingTimer = window.setInterval(() => {
                  window.postMessage(
                    {
                      target: 'kaitoPadoExtension',
                      origin: 'padoZKAttestationJSSDK',
                      name: 'getAttestationResult',
                      params: {},
                    },
                    '*',
                  );
                }, 1_000);
                return;
              }

              if (data.name === 'startAttestationRes') {
                console.log('[kaito-attest] startAttestationRes received', data.params);
                if (!data.params?.result) {
                  if (retryWhenAlgorithmNotReady(data.params?.errorData)) {
                    return;
                  }
                  if (isTransientAlgorithmError(data.params?.errorData)) {
                    console.log(
                      '[kaito-attest] ignoring transient startAttestationRes error (concurrent run)',
                    );
                    return;
                  }
                  fail(formatError('primus_start_failed', data.params?.errorData));
                  return;
                }

                cleanup();
                const attestation = data.params?.data;
                if (!attestation || typeof attestation !== 'object') {
                  resolve(encodeResult({ ok: false, error: 'attestation_missing_result' }));
                  return;
                }
                const keys = Object.keys(attestation);
                console.log('[kaito-attest] returning attestation keys:', keys);
                resolve(encodeResult({ ok: true, attestation: attestation as Attestation, keys }));
              }
            };

            window.addEventListener('message', onMessage);
            document.addEventListener(teardownEvent, onTeardown);
            responseTimeoutTimer = window.setTimeout(() => {
              fail(startRequested ? 'primus_attestation_no_response' : 'primus_init_no_response');
            }, initResponseTimeoutMs);
            console.log('[kaito-attest] posting initAttestation');
            appendTrace('adapter_post_initAttestation');
            window.postMessage(
              {
                target: 'kaitoPadoExtension',
                origin: 'padoZKAttestationJSSDK',
                name: 'initAttestation',
                params: {
                  sdkVersion,
                  clientType,
                },
              },
              '*',
            );
          });
        },
      });
      await writeExecuteDebug('after_execute_script', {
        attempt,
        hasResultObject: Boolean(result),
        hasResultValue: result?.result !== undefined && result?.result !== null,
        resultType: typeof result?.result,
      });
      break;
    } catch (error) {
      await writeExecuteDebug('execute_script_error', {
        attempt,
        transient: isTransientFrameError(error),
        message: error instanceof Error ? error.message : String(error),
      });
      if (!isTransientFrameError(error) || attempt === EXECUTE_ATTESTATION_RETRIES) {
        throw error;
      }
      const tab = await chrome.tabs.get(tabId).catch(() => undefined);
      if (!tab) {
        throw error;
      }
      logDev('attestation frame changed; retrying after navigation settles', {
        tabId,
        attempt: attempt + 1,
        url: tab?.url,
        error: error instanceof Error ? error.message : String(error),
      });
      try {
        await waitForTabReady(tabId);
        await waitForTabToSettle(tabId);
      } catch (settleError) {
        if (isTransientFrameError(settleError)) {
          throw error;
        }
        throw settleError;
      }
      await ensurePrimusBridge(tabId).catch((bridgeError) => {
        if (!isTransientFrameError(bridgeError)) {
          throw bridgeError;
        }
      });
    }
  }

  const bridgeResult = parseBridgeResult(
    unwrapInjectionResult<AttestationBridgeWireResult>(result, 'attestation_execute_failed'),
  );
  await writeExecuteDebug('parsed_bridge_result', {
    ok: bridgeResult.ok,
    error: bridgeResult.ok ? null : bridgeResult.error,
    keys: bridgeResult.ok ? bridgeResult.keys : undefined,
  });
  if (!bridgeResult.ok) {
    if (bridgeResult.error === 'primus_init_no_response' && allowBridgeRecovery) {
      logDev('bridge did not answer init; re-injecting and retrying once', { tabId });
      invalidateBridge(tabId);
      await injectFreshBridgeScripts(tabId);
      return executeAttestation(tabId, payload, false);
    }
    throw new Error(bridgeResult.error);
  }
  logDev('bridge attestation keys', bridgeResult.keys);
  return bridgeResult.attestation;
}

function isTransientFrameError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Frame with ID 0 was removed') ||
    message.includes('A frame with ID 0 was removed') ||
    message.includes('Cannot access contents of url') ||
    message.includes('Extension context invalidated') ||
    message.includes('The tab was closed') ||
    message.includes('No tab with id')
  );
}

const RETRYABLE_ATTESTATION_ERRORS: readonly RegExp[] = [
  /30004[\s\S]*ParseJsonError/,
  /\b10003\b[\s\S]*PrimusServerNetworkError/,
  /\b50003\b[\s\S]*PlainThreadException/,
  /\b00014\b/,
  /\b30001\b[\s\S]*status code error:\s*(429|5\d\d)\b/,
];

function isRetryableAttestationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE_ATTESTATION_ERRORS.some((pattern) => pattern.test(message));
}

function unwrapInjectionResult<T>(result: ExecuteResult<T> | undefined, fallback: string): T {
  if (!result) {
    throw new Error(fallback);
  }
  if (result.result === undefined || result.result === null) {
    throw new Error(fallback);
  }
  return result.result;
}

function parseBridgeResult(value: string): AttestationBridgeResult {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('attestation_execute_empty_result');
  }

  try {
    const parsed = JSON.parse(value) as AttestationBridgeResult;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.ok !== 'boolean') {
      throw new Error('invalid_shape');
    }
    return parsed;
  } catch (error) {
    throw new Error(
      `attestation_execute_invalid_result: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
