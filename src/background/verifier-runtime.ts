import { logDev } from '@/lib/env';
import { PROOF_RUNTIME_TEARDOWN_EVENT } from '@/shared/proof-arming';
import { optionalPatternForUrl, PROOF_TARGETS } from '@/shared/proof-targets';
import { verifierUrlMatches } from '@/shared/verifier-url';

const SCRIPT_IDS = [
  'kaito-proof-arming',
  'kaito-axis-prefetch',
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
    default:
      return undefined;
  }
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
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        args: [PROOF_RUNTIME_TEARDOWN_EVENT],
        func: (eventName: string) => document.dispatchEvent(new Event(eventName)),
      }).catch(() => undefined);
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'ISOLATED',
        func: () => {
          try {
            sessionStorage.removeItem('kaito.proofArmed');
          } catch {

          }
          document.documentElement?.removeAttribute('data-kaito-proof-armed');
        },
      }).catch(() => undefined);
    }),
  );
}

async function injectIntoTab(
  tabId: number,
  scripts: RegisteredScript[],
): Promise<void> {
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
  const optionalPattern = optionalPatternForUrl(guideUrl);
  if (!optionalPattern) {
    return {
      prepareTab: async () => undefined,
      dispose: async () => undefined,
    };
  }
  if (!(await chrome.permissions.contains({ origins: [optionalPattern] }))) {
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
  logDev('verifier runtime activated', { origin: url.origin, scripts: scripts.map(({ id }) => id) });

  let disposed = false;
  return {
    async prepareTab(tabId: number): Promise<void> {
      const tab = await chrome.tabs.get(tabId);
      const tabUrl = tab.status === 'loading' ? tab.pendingUrl || tab.url : tab.url || tab.pendingUrl;
      if (!verifierUrlMatches(tabUrl, guideUrl)) {
        throw new Error(`verifier_runtime_tab_mismatch:${tabId}`);
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
