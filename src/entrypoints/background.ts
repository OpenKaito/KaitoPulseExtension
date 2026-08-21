import { logDev } from '@/lib/env';
import type { ProofPanelStateResponse, RuntimeErrorResponse, RuntimeRequest } from '@/shared/messages';
import { registerSignInMessageHandler } from '@/background/external-sign-in-handler';
import { clearDebugRequests, getDebugRequestSnapshot } from '@/background/debug-log';
import { clearBehaviorEvents, getBehaviorEventSnapshot, recordBehaviorEvents } from '@/background/behavior-log';
import { recordAttentionEvents } from '@/background/attention/buffer';
import { sweepRetiredStorage } from '@/background/retired-storage';
import { handleFetchImage, handleFetchRawImage } from '@/background/signal-handlers';
import {
  handleFetchBadges,
  handleFetchHoverCard,
  handleGetSocialCard,
  handleGetSocialCardActivity,
  handleGetSocialSummary,
} from '@/background/social-card-handlers';
import { handleFetchTokenChart } from '@/background/token-chart-handlers';
import { handleResolveTickers } from '@/background/ticker-resolve-handlers';
import { handlePutAdFlag, handleQueryAdFlags, handleRemoveAdFlag } from '@/background/ad-flag-handlers';
import {
  handleFollowFromRecommendation,
  handleGetFollowRecommendations,
  registerFollowActionReporter,
  registerRecommendationFollowConfirmedHandler,
} from '@/background/recommend-follow-handlers';
import { handleGetAuraSummary } from '@/background/aura-handlers';
import { handleGetTradingSummary } from '@/background/trading-handlers';
import { handleSetActivityInsightsPreference } from '@/background/activity-insights-handlers';
import {
  handleGetTradingTotalsPublic,
  handleSetTradingTotalsPublic,
} from '@/background/trading-visibility-handlers';
import { handleAcceptTerms } from '@/background/terms-handlers';
import { clearPrimusAttestationState } from '@/background/primus-adapter';
import { openVerifyWindow, returnToOriginTabAfterVerify } from '@/background/popup-window';
import {
  handleForceRefreshSelectorOverrides,
  handleGetSelectorOverrides,
  startSelectorConfigAlarm,
} from '@/background/selector-config';
import {
  bootstrap, cancelActiveProof, ensureStartupBootstrap, getLastAttestationExport, getState,
  listPlatformBindings, openSignInWindow, resetSession, runProofFlow, setPendingSignInReturnTab,
  signOut, startBootstrap, unbindPlatform,
} from '@/background/worker-core';
import { startRemoteConfigPolling } from '@/background/attention/remote-config';
import { startAttentionUploader } from '@/background/attention/uploader';
import { handleAuthIntentRequest } from '@/background/auth-intent';
import { injectConnectTabsAfterInstall } from '@/background/inject-connect-tabs';
import { initializeVerifierRuntime } from '@/background/verifier-runtime';

const IGNORED_MSG = /Could not establish connection|Receiving end does not exist|The message port closed/i;
const isIgnoredMsg = (error: unknown): boolean =>
  IGNORED_MSG.test((error as { message?: string } | null)?.message || String(error));

function installSwRuntimeGuard(): void {
  globalThis.addEventListener?.('unhandledrejection', (event) => {
    if (isIgnoredMsg(event.reason)) {
      event.preventDefault();
      console.debug('[kaito-ext] ignored optional message target miss:', (event.reason as { message?: string })?.message || String(event.reason));
    }
  });

  const consumeLastError = (): void => {
    const message = chrome.runtime.lastError?.message || '';
    if (message && IGNORED_MSG.test(message)) {
      console.debug('[kaito-ext] ignored optional message target miss:', message);
    }
  };
  const wrapCallback = (callback: unknown) => (...args: unknown[]) => {
    consumeLastError();
    return typeof callback === 'function' ? (callback as (...a: unknown[]) => unknown)(...args) : undefined;
  };
  const wrapPromise = (result: unknown): unknown => {
    if (!result || typeof (result as { catch?: unknown }).catch !== 'function') return result;
    return (result as Promise<unknown>).catch((error: unknown) => {
      if (isIgnoredMsg(error)) {
        console.debug('[kaito-ext] ignored optional message target miss:', (error as { message?: string })?.message || String(error));
        return undefined;
      }
      throw error;
    });
  };

  const tabsApi = chrome.tabs as unknown as { sendMessage?: (...args: unknown[]) => unknown } | undefined;
  if (tabsApi?.sendMessage) {
    const sendMessage = tabsApi.sendMessage.bind(chrome.tabs);
    tabsApi.sendMessage = (...args: unknown[]) => {
      const [tabId, message, optionsOrCallback, callback] = args;
      if (typeof optionsOrCallback === 'function') {
        return sendMessage(tabId, message, wrapCallback(optionsOrCallback));
      }
      if (typeof callback === 'function') {
        return sendMessage(tabId, message, optionsOrCallback, wrapCallback(callback));
      }
      if (args.length <= 2) {
        return sendMessage(tabId, message, wrapCallback(() => undefined));
      }
      return sendMessage(tabId, message, optionsOrCallback, wrapCallback(() => undefined));
    };
  }

  const runtimeApi = chrome.runtime as unknown as { sendMessage?: (...args: unknown[]) => unknown };
  if (runtimeApi?.sendMessage) {
    const sendMessage = runtimeApi.sendMessage.bind(chrome.runtime);
    runtimeApi.sendMessage = (...args: unknown[]) => {
      const last = args[args.length - 1];
      if (typeof last === 'function') {
        args[args.length - 1] = wrapCallback(last);
        return wrapPromise(sendMessage(...args));
      }
      return sendMessage(...args, wrapCallback(() => undefined));
    };
  }
}

export default defineBackground({

  main() {
    console.log('[TIMING] main() start', performance.now());

    installSwRuntimeGuard();

    logDev('background worker booting');
    void initializeVerifierRuntime();
    void startBootstrap();
    startSelectorConfigAlarm();
    startRemoteConfigPolling();
    startAttentionUploader();

    chrome.runtime.onInstalled.addListener((details) => {
      logDev('extension installed');

      void sweepRetiredStorage();
      if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        void bootstrap();

        void injectConnectTabsAfterInstall();
      }
    });
    chrome.runtime.onStartup.addListener(() => {
      logDev('extension startup');
      void bootstrap();
    });

    (chrome.action.onClicked as unknown as { addListener: (...a: unknown[]) => void }).addListener = () => {
      logDev('suppressed a late action.onClicked listener (Primus home.html opener)');
    };

    const RESULT_PANEL_FRESH_MS = 3 * 60 * 1000;

    function siteKey(url: string | undefined): string | undefined {
      if (!url) return undefined;
      try {
        const host = new URL(url).hostname.replace(/^www\./, '');
        return host.split('.').slice(-2).join('.');
      } catch {
        return undefined;
      }
    }

    function panelStateFor(href: string, senderTabId?: number): ProofPanelStateResponse {
      const s = getState();
      const pageSite = siteKey(href);
      if (!pageSite) return { phase: 'idle' };
      const guideSiteOf = (verifierId: string): string | undefined =>
        siteKey(s.verifiers.find((v) => v.id === verifierId)?.guide.url);

      const progress = s.proofProgress;
      if (progress) {
        if (typeof progress.targetTabId !== 'number' || progress.targetTabId !== senderTabId) {
          return { phase: 'idle' };
        }
        const proofSite = siteKey(progress.guideUrl) ?? guideSiteOf(progress.verifierId);
        return proofSite === pageSite
          ? { phase: 'progress', progress, verifierId: progress.verifierId }
          : { phase: 'idle' };
      }

      const result = s.lastResult;
      const fresh = typeof result?.finishedAt === 'number' && Date.now() - result.finishedAt < RESULT_PANEL_FRESH_MS;
      if (result && fresh && guideSiteOf(result.verifierId) === pageSite) {
        return { phase: 'result', result, verifierId: result.verifierId };
      }
      return { phase: 'idle' };
    }

    function unknownMessage(_message: never): RuntimeErrorResponse {
      return { error: 'unknown_message' };
    }

    async function handleKaitoMessage(message: RuntimeRequest, senderTabId?: number): Promise<unknown> {
      try {
        switch (message.action) {
          case 'init': { const state = await bootstrap(); return { state }; }
          case 'getState': {
            console.log('[TIMING] getState entry', performance.now());
            await ensureStartupBootstrap();
            console.log('[TIMING] getState after ensureStartupBootstrap', performance.now());
            return { state: getState() };
          }
          case 'startProof': {
            const result = await runProofFlow(message.verifierId, {
              tabId: typeof message.tabId === 'number' ? message.tabId : undefined,
              ownerWindowId: typeof message.ownerWindowId === 'number' ? message.ownerWindowId : undefined,
            });
            return { ok: !result.error, result, state: getState() };
          }
          case 'cancelProof': { const cancel = cancelActiveProof(); return { ok: true, accepted: cancel.accepted, state: cancel.state }; }
          case 'openVerifyWindow': { await openVerifyWindow(message.verifierId, senderTabId); return { ok: true }; }
          case 'returnFromVerifyWindow': { await returnToOriginTabAfterVerify(message.windowId); return { ok: true }; }
          case 'recordAuthIntent':
          case 'takeAuthIntent':
          case 'cancelAuthIntent':
            return await handleAuthIntentRequest(message, senderTabId);

          case 'listPlatformBindings': return await listPlatformBindings();
          case 'unbindPlatform': {
            const result = await unbindPlatform(message.platform);

            return { ...result, state: getState() };
          }
          case 'signOut': { await signOut(); return { ok: true, state: getState() }; }
          case 'resetSession': { const state = await resetSession(); return { state }; }
          case 'exportLastAttestation': {
            const attestation = await getLastAttestationExport(); return { attestation };
          }
          case 'getDebugRequests': return getDebugRequestSnapshot();
          case 'clearDebugRequests': return clearDebugRequests();
          case 'recordBehaviorEvents': return recordBehaviorEvents(message.events);
          case 'getBehaviorEvents': return getBehaviorEventSnapshot();
          case 'clearBehaviorEvents': return clearBehaviorEvents();
          case 'recordAttentionEvents': return recordAttentionEvents(message.events, message.serveEvents, message.fp);
          case 'fetchImage': return handleFetchImage(message.url, message.width);
          case 'fetchRawImage': return handleFetchRawImage(message.url);
          case 'fetchBadges': return handleFetchBadges(message.twitterIds);
          case 'fetchHoverCard': return handleFetchHoverCard(message.twitterId);

          case 'getSocialSummary': return handleGetSocialSummary();

          case 'getSocialCardActivity': return handleGetSocialCardActivity();

          case 'getSocialCard': return handleGetSocialCard(message.twitterId, message.candidates);
          case 'fetchTokenChart': return handleFetchTokenChart(message.symbol, message.period, message.entity);
          case 'resolveTickers': return handleResolveTickers(message.occurrences);
          case 'putAdFlag': return handlePutAdFlag(message.tweetId, message.reason);
          case 'removeAdFlag': return handleRemoveAdFlag(message.tweetId);
          case 'queryAdFlags': return handleQueryAdFlags(message.tweetIds);
          case 'getProofPanelState': { await ensureStartupBootstrap(); return panelStateFor(message.href, senderTabId); }
          case 'openSignIn': {
            void setPendingSignInReturnTab(senderTabId);
            void openSignInWindow(message.url);
            return { ok: true };
          }

          case 'openOptions': {
            await chrome.runtime.openOptionsPage();
            return { ok: true };
          }
          case 'getSelectorOverrides': return handleGetSelectorOverrides();
          case 'forceRefreshSelectorOverrides': return handleForceRefreshSelectorOverrides();

          case 'getFollowRecommendations': return handleGetFollowRecommendations();

          case 'getAuraSummary': return handleGetAuraSummary();

          case 'getTradingSummary': return handleGetTradingSummary();

          case 'getTradingTotalsPublic': return handleGetTradingTotalsPublic();
          case 'setTradingTotalsPublic': return handleSetTradingTotalsPublic(message.enabled);
          case 'followFromRecommendation':
            return handleFollowFromRecommendation(message.twitterId, message.handle);
          case 'setActivityInsightsPreference':
            return handleSetActivityInsightsPreference(message.enabled);

          case 'acceptTerms':
            return handleAcceptTerms();
          default: return unknownMessage(message);
        }
      } catch (error) {
        logDev('runtime handler error', error);
        return { error: (error as Error)?.message || String(error), state: getState() };
      }
    }

    function isKaitoMessage(message: unknown): message is RuntimeRequest {
      return Boolean(
        message && typeof message === 'object' &&
        (message as { target?: unknown }).target === 'kaitoExtension' &&
        typeof (message as { action?: unknown }).action === 'string',
      );
    }

    chrome.runtime.onConnect.addListener((port) => {
      if (port.name !== 'kaitoExtension') return;
      port.onMessage.addListener((message) => {
        if (!isKaitoMessage(message)) { port.postMessage({ error: 'unknown_message' }); return; }
        void handleKaitoMessage(message, port.sender?.tab?.id).then((response) => {
          try { port.postMessage(response); } finally { port.disconnect(); }
        });
      });
    });

    chrome.runtime.onMessage.addListener((message: RuntimeRequest, sender, sendResponse) => {
      if (!isKaitoMessage(message)) return false;
      void handleKaitoMessage(message, sender.tab?.id).then(sendResponse);
      return true;
    });

    registerSignInMessageHandler();
    registerRecommendationFollowConfirmedHandler();
    registerFollowActionReporter();

    void clearPrimusAttestationState().catch(() => undefined);

    console.log('[TIMING] before importScripts', performance.now());
    try {
      (globalThis as unknown as { importScripts: (...urls: string[]) => void })
        .importScripts('./background.bundle.js');
    } catch (error) {
      console.error('[kaito-ext] primus background import failed', error);
    }
    console.log('[TIMING] after importScripts', performance.now());
    console.info('[kaito-ext] background bundles loaded');
  },
});
