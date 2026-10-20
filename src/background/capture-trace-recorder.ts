import { createCaptureTrace, type CaptureTrace } from '@/shared/capture-trace';

let active: { stop: () => void } | undefined;
let last: { startedAt: number; trace: CaptureTrace } | undefined;

export function startCaptureTrace(
  tabId: number,
  targets: readonly string[],
  matches: (url: string, target: string) => boolean,
  windowSignalKey: string,
): void {
  stopCaptureTrace();
  last = undefined;
  if (targets.length === 0 || !globalThis.chrome?.webRequest?.onCompleted) return;
  const trace = createCaptureTrace(targets, matches);
  const filter: chrome.webRequest.RequestFilter = {
    tabId,
    urls: ['<all_urls>'],
    types: ['xmlhttprequest', 'other'],
  };
  const onCompleted = (details: chrome.webRequest.OnCompletedDetails) =>
    trace.record(details.url, { status: details.statusCode, at: Date.now() });
  const onError = (details: chrome.webRequest.OnErrorOccurredDetails) =>
    trace.record(details.url, { error: details.error, at: Date.now() });
  const onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local') return;
    const stage = (changes[windowSignalKey]?.newValue as { stage?: unknown } | undefined)?.stage;
    if (stage === 'data_source_tab_ready') trace.openWindow(Date.now());
  };
  chrome.webRequest.onCompleted.addListener(onCompleted, filter);
  chrome.webRequest.onErrorOccurred?.addListener(onError, filter);
  chrome.storage?.onChanged?.addListener(onStorage);
  active = {
    stop: () => {
      chrome.webRequest.onCompleted.removeListener(onCompleted);
      chrome.webRequest.onErrorOccurred?.removeListener(onError);
      chrome.storage?.onChanged?.removeListener(onStorage);
    },
  };
  last = { startedAt: Date.now(), trace };
}

export const LAST_CAPTURE_TRACE_STORAGE_KEY = 'kaito.lastCaptureTrace';

export function stopCaptureTrace(): void {
  if (!active) return;
  active.stop();
  active = undefined;
  if (last) {
    void chrome.storage?.local
      ?.set({ [LAST_CAPTURE_TRACE_STORAGE_KEY]: { at: Date.now(), trace: last.trace.describe() } })
      .catch(() => undefined);
  }
}

export function describeCaptureTrace(since = 0): string | undefined {
  if (!last || last.startedAt < since) return undefined;
  return last.trace.describe();
}
