import type { ExtensionUpdateCheckResponse } from '@/shared/messages';

const UPDATE_CHECK_CACHE_KEY = 'kaitoExtensionUpdateCheck';
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const PENDING_UPDATE_ALARM = 'kaito-pending-update';
const PENDING_UPDATE_RETRY_MINUTES = 2;

// A reload that does not install the pending update would be retried forever,
// and Chrome throttles an extension that reloads in a loop.
const MAX_APPLY_ATTEMPTS = 3;

const BLOCKING_CONTEXT_TYPES = [
  'TAB',
  'POPUP',
  'SIDE_PANEL',
  'OFFSCREEN_DOCUMENT',
] as `${chrome.runtime.ContextType}`[];

type CachedUpdateCheck = ExtensionUpdateCheckResponse & {
  checkedAt: number;
  applyAttempts?: number;
};

type ReloadGate = () => boolean;

let reloadGate: ReloadGate = () => true;

function currentVersion(): string {
  return chrome.runtime.getManifest().version;
}

async function readCachedCheck(): Promise<CachedUpdateCheck | undefined> {
  const stored = await chrome.storage.session.get(UPDATE_CHECK_CACHE_KEY);
  const value = stored[UPDATE_CHECK_CACHE_KEY] as CachedUpdateCheck | undefined;
  if (!value || value.currentVersion !== currentVersion()) return undefined;
  return value;
}

async function writeCachedCheck(
  value: ExtensionUpdateCheckResponse,
  applyAttempts?: number,
): Promise<void> {
  await chrome.storage.session.set({
    [UPDATE_CHECK_CACHE_KEY]: {
      ...value,
      checkedAt: Date.now(),
      applyAttempts,
    } satisfies CachedUpdateCheck,
  });
}

async function hasOpenExtensionView(): Promise<boolean> {
  try {
    const contexts = await chrome.runtime.getContexts({ contextTypes: BLOCKING_CONTEXT_TYPES });
    return contexts.length > 0;
  } catch {
    return true;
  }
}

// Reloading orphans the content scripts already running in a page, so hold off
// while the user is looking at one of them.
async function hasFocusedInjectedTab(): Promise<boolean> {
  const matches = (chrome.runtime.getManifest().content_scripts ?? []).flatMap(
    (entry) => entry.matches ?? [],
  );
  if (matches.length === 0) return false;
  try {
    const lastFocused = await chrome.windows.getLastFocused();
    if (!lastFocused.focused) return false;
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true, url: matches });
    return tabs.length > 0;
  } catch {
    return true;
  }
}

async function canReloadNow(): Promise<boolean> {
  if (!reloadGate()) return false;
  if (await hasOpenExtensionView()) return false;
  return !(await hasFocusedInjectedTab());
}

async function applyPendingUpdateWhenSafe(): Promise<void> {
  const cached = await readCachedCheck();
  if (cached?.status !== 'update_available') {
    await chrome.alarms.clear(PENDING_UPDATE_ALARM);
    return;
  }

  const attempts = cached.applyAttempts ?? 0;
  if (attempts >= MAX_APPLY_ATTEMPTS) {
    await chrome.alarms.clear(PENDING_UPDATE_ALARM);
    return;
  }

  if (!(await canReloadNow())) {
    chrome.alarms.create(PENDING_UPDATE_ALARM, { delayInMinutes: PENDING_UPDATE_RETRY_MINUTES });
    return;
  }

  await chrome.alarms.clear(PENDING_UPDATE_ALARM);
  await writeCachedCheck(cached, attempts + 1);
  applyExtensionUpdate();
}

export function registerExtensionUpdateListener(isSafeToReload: ReloadGate): void {
  reloadGate = isSafeToReload;

  chrome.runtime.onUpdateAvailable.addListener((details) => {
    void (async () => {
      await writeCachedCheck({
        currentVersion: currentVersion(),
        status: 'update_available',
        availableVersion: details.version,
      });
      await applyPendingUpdateWhenSafe();
    })();
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === PENDING_UPDATE_ALARM) void applyPendingUpdateWhenSafe();
  });

  void applyPendingUpdateWhenSafe();
}

export async function checkForExtensionUpdate(): Promise<ExtensionUpdateCheckResponse> {
  const cached = await readCachedCheck();
  if (
    cached &&
    (cached.status === 'update_available' ||
      Date.now() - cached.checkedAt < UPDATE_CHECK_INTERVAL_MS)
  ) {
    return cached;
  }

  const result = await chrome.runtime.requestUpdateCheck();
  const response: ExtensionUpdateCheckResponse = {
    currentVersion: currentVersion(),
    status: result.status,
    availableVersion: result.version,
  };

  await writeCachedCheck(response);
  return response;
}

export function applyExtensionUpdate(): void {
  setTimeout(() => chrome.runtime.reload(), 150);
}
