import { formatPageState, type MainFrameOutcome } from '@/shared/verifier-url';

const TRACKED_TABS_LIMIT = 32;
const lastMainFrame = new Map<number, MainFrameOutcome>();
let installed = false;

function remember(tabId: number, outcome: MainFrameOutcome): void {
  if (tabId < 0) return;
  lastMainFrame.delete(tabId);
  lastMainFrame.set(tabId, outcome);
  while (lastMainFrame.size > TRACKED_TABS_LIMIT) {
    const oldest = lastMainFrame.keys().next().value;
    if (oldest === undefined) break;
    lastMainFrame.delete(oldest);
  }
}

export function installMainFrameTracker(): void {
  if (installed || !globalThis.chrome?.webRequest?.onErrorOccurred) return;
  installed = true;
  const filter: chrome.webRequest.RequestFilter = { urls: ['<all_urls>'], types: ['main_frame'] };
  chrome.webRequest.onErrorOccurred.addListener(
    (details) => remember(details.tabId, { error: details.error, at: Date.now() }),
    filter,
  );
  chrome.webRequest.onCompleted.addListener(
    (details) => remember(details.tabId, { status: details.statusCode, at: Date.now() }),
    filter,
  );
  chrome.tabs?.onRemoved.addListener((tabId) => {
    lastMainFrame.delete(tabId);
  });
}

export async function describeTabForLog(
  tabId: number,
  guideUrl?: string,
  since?: number,
): Promise<string> {
  const tab = await chrome.tabs.get(tabId).catch(() => undefined);
  return formatPageState({
    url: tab ? tab.url || tab.pendingUrl : undefined,
    loadStatus: tab ? tab.status : 'closed',
    guideUrl,
    mainFrame: lastMainFrame.get(tabId),
    since,
  });
}
