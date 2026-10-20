import { logDev } from '@/lib/env';
import { PROOF_RUNTIME_TEARDOWN_EVENT } from '@/shared/proof-arming';
import { optionalPatternsForUrl, PROOF_TARGETS } from '@/shared/proof-targets';
import { navigationTargetForLog, verifierUrlMatches } from '@/shared/verifier-url';

const SCRIPT_IDS = [
  'kaito-proof-arming',
  'kaito-axis-prefetch',
  'kaito-polymarket-prefetch',
  'kaito-pumpfun-prefetch',
  'kaito-fomo-prefetch',
  'kaito-lighter-prefetch',
  'kaito-variational-prefetch',
  'kaito-binance-prefetch',
  'kaito-okx-prefetch',
  'kaito-bybit-prefetch',
  'kaito-kraken-prefetch',
  'kaito-bitget-prefetch',
  'kaito-gate-prefetch',
  'kaito-mexc-prefetch',
] as const;

type RegisteredScript = chrome.scripting.RegisteredContentScript;
type MainWorldScript = {
  id: string;
  js: string[];
  runAt: chrome.extensionTypes.RunAt;
  world: 'MAIN';
};

export type VerifierRuntime = {
  prepareTab(tabId: number): Promise<void>;
  dispose(): Promise<void>;
};

let initialization: Promise<void> | undefined;

function exactHostPattern(url: URL): string {
  return `${url.protocol}//${url.hostname}/*`;
}

function mainWorldScriptFor(hostname: string): MainWorldScript | undefined {
  switch (hostname) {
    case 'hub.axisrobotics.ai':
      return {
        id: 'kaito-axis-prefetch',
        js: ['axis-verify-prefetch.js'],
        runAt: 'document_idle',
        world: 'MAIN',
      };
    case 'polymarket.com':
      return {
        id: 'kaito-polymarket-prefetch',
        js: ['polymarket-verify-prefetch.js'],
        runAt: 'document_idle',
        world: 'MAIN',
      };
    case 'pump.fun':
      return {
        id: 'kaito-pumpfun-prefetch',
        js: ['pumpfun-verify-prefetch.js'],
        runAt: 'document_idle',
        world: 'MAIN',
      };
    case 'fomo.family':
      return {
        id: 'kaito-fomo-prefetch',
        js: ['fomo-verify-prefetch.js'],
        runAt: 'document_idle',
        world: 'MAIN',
      };
    case 'app.lighter.xyz':
      return {
        id: 'kaito-lighter-prefetch',
        js: ['lighter-verify-prefetch.js'],
        runAt: 'document_start',
        world: 'MAIN',
      };
    case 'omni.variational.io':
      return {
        id: 'kaito-variational-prefetch',
        js: ['variational-verify-prefetch.js'],
        runAt: 'document_idle',
        world: 'MAIN',
      };
    case 'www.binance.com':
      return {
        id: 'kaito-binance-prefetch',
        js: ['binance-verify-prefetch.js'],
        runAt: 'document_start',
        world: 'MAIN',
      };
    case 'www.okx.com':
    case 'app.okx.com':
      return {
        id: 'kaito-okx-prefetch',
        js: ['okx-verify-prefetch.js'],
        runAt: 'document_start',
        world: 'MAIN',
      };
    case 'www.bitget.com':
      return {
        id: 'kaito-bitget-prefetch',
        js: ['bitget-verify-prefetch.js'],
        runAt: 'document_start',
        world: 'MAIN',
      };
    case 'www.mexc.com':
      return {
        id: 'kaito-mexc-prefetch',
        js: ['mexc-verify-prefetch.js'],
        runAt: 'document_start',
        world: 'MAIN',
      };
    case 'www.gate.com':
      return {
        id: 'kaito-gate-prefetch',
        js: ['gate-verify-prefetch.js'],
        runAt: 'document_start',
        world: 'MAIN',
      };
    case 'www.kraken.com':
      return {
        id: 'kaito-kraken-prefetch',
        js: ['kraken-verify-prefetch.js'],
        runAt: 'document_start',
        world: 'MAIN',
      };
    case 'www.bybit.com':
      return {
        id: 'kaito-bybit-prefetch',
        js: ['bybit-verify-prefetch.js'],
        runAt: 'document_idle',
        world: 'MAIN',
      };
    default:
      return undefined;
  }
}

export function hasMainWorldPrefetch(hostname: string): boolean {
  return mainWorldScriptFor(hostname) !== undefined;
}

async function unregisterKnownScripts(): Promise<boolean> {
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [...SCRIPT_IDS] });
  if (registered.length === 0) return false;
  await chrome.scripting.unregisterContentScripts({ ids: registered.map(({ id }) => id) });
  return true;
}

function isVerifierHost(url: string | undefined, origin?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (origin && parsed.origin !== origin) return false;
    return PROOF_TARGETS.some(
      ({ domain, manifestRole }) =>
        manifestRole === 'optional' &&
        (parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)),
    );
  } catch {
    return false;
  }
}

async function teardownInjectedTabs(origin?: string): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (typeof tab.id !== 'number' || !isVerifierHost(tab.url || tab.pendingUrl, origin)) return;
      await chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          args: [PROOF_RUNTIME_TEARDOWN_EVENT],
          func: (eventName: string) => document.dispatchEvent(new Event(eventName)),
        })
        .catch(() => undefined);
      await chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          world: 'ISOLATED',
          func: () => {
            try {
              sessionStorage.removeItem('kaito.proofArmed');
            } catch {}
            document.documentElement?.removeAttribute('data-kaito-proof-armed');
            document.documentElement?.removeAttribute('data-kaito-proof-captured');
          },
        })
        .catch(() => undefined);
    }),
  );
}

async function injectIntoTab(tabId: number, scripts: RegisteredScript[]): Promise<void> {
  for (const script of scripts) {
    if (!script.js?.length) continue;
    await chrome.scripting.executeScript({
      target: { tabId },
      files: script.js,
      world: script.world,
    });
  }
}

async function initialize(): Promise<void> {
  const hadStaleRegistration = await unregisterKnownScripts().catch((error) => {
    logDev('stale verifier script unregister failed', error);
    return false;
  });
  if (!hadStaleRegistration) return;
  await teardownInjectedTabs().catch((error) => {
    logDev('stale verifier runtime teardown failed', error);
  });
}

export function initializeVerifierRuntime(): Promise<void> {
  initialization ??= initialize();
  return initialization;
}

export async function activateVerifierRuntime(guideUrl: string): Promise<VerifierRuntime> {
  await initializeVerifierRuntime();

  const url = new URL(guideUrl);
  const optionalPatterns = optionalPatternsForUrl(guideUrl);
  if (optionalPatterns.length === 0) {
    return {
      prepareTab: async () => undefined,
      dispose: async () => undefined,
    };
  }
  if (!(await chrome.permissions.contains({ origins: optionalPatterns }))) {
    throw new Error(`proof_host_permission_required:${url.hostname}`);
  }

  const match = exactHostPattern(url);
  const scripts: RegisteredScript[] = [
    {
      id: 'kaito-proof-arming',
      js: ['verify-sites.js'],
      matches: [match],
      persistAcrossSessions: false,
      runAt: 'document_idle',
      world: 'ISOLATED',
    },
  ];
  const mainWorld = mainWorldScriptFor(url.hostname);
  if (mainWorld) {
    scripts.push({
      ...mainWorld,
      matches: [match],
      persistAcrossSessions: false,
    });
  }

  try {
    await chrome.scripting.registerContentScripts(scripts);
  } catch (error) {
    await unregisterKnownScripts().catch(() => undefined);
    await teardownInjectedTabs(url.origin).catch(() => undefined);
    throw error;
  }
  logDev('verifier runtime activated', {
    origin: url.origin,
    scripts: scripts.map(({ id }) => id),
  });

  let disposed = false;
  return {
    async prepareTab(tabId: number): Promise<void> {
      const tab = await chrome.tabs.get(tabId);
      const tabUrl =
        tab.status === 'loading' ? tab.pendingUrl || tab.url : tab.url || tab.pendingUrl;
      if (!verifierUrlMatches(tabUrl, guideUrl)) {
        throw new Error(
          `verifier_runtime_tab_mismatch:${tabId} at ${tabUrl ? navigationTargetForLog(tabUrl, guideUrl) : 'unknown'}`,
        );
      }
      if (tab.status !== 'complete') return;
      await injectIntoTab(tabId, scripts);
    },
    async dispose(): Promise<void> {
      if (disposed) return;
      disposed = true;
      await unregisterKnownScripts().catch((error) => {
        logDev('verifier script unregister failed', error);
      });
      await teardownInjectedTabs(url.origin).catch((error) => {
        logDev('verifier runtime teardown failed', error);
      });
    },
  };
}
