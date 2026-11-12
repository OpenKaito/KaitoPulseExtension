import { PROOF_CAPTURED_ATTR } from '@/shared/proof-arming';

const PRIMUS_BEGIN_ATTEST_KEY = 'beginAttest';
const PRIMUS_PAGE_DECODE_DEBUG_KEY = 'kaitoPageDecodeInitDebug';
export const LAST_CAPTURE_SIGNAL_STORAGE_KEY = 'kaito.lastCaptureSignal';

type MarkResult = { tabId: number; marked?: boolean; error?: string };

async function writeCapturedAttr(tabId: number, captured: boolean): Promise<MarkResult> {
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      args: [PROOF_CAPTURED_ATTR, captured],
      func: (attr: string, on: boolean) => {
        const root = document.documentElement;
        if (!root) return false;
        if (on) root.setAttribute(attr, '1');
        else root.removeAttribute(attr);
        return root.hasAttribute(attr);
      },
    });
    return { tabId, marked: injection?.result === true };
  } catch (error) {
    return { tabId, error: (error instanceof Error ? error.message : String(error)).slice(0, 120) };
  }
}

// `stored=<via>/marked=<n>` for the failure diagnostics: the captured target
// response being armed for the attestor (beginAttest fired) is the "request
// stored" step on the 00013 path. Its ABSENCE on a failed attempt is itself the
// signal — the attestor never got a response to prove. Read from
// chrome.storage.local, so it survives the offscreen restart.
export async function describeCaptureSignal(since = 0): Promise<string | undefined> {
  const stored = await chrome.storage?.local
    ?.get(LAST_CAPTURE_SIGNAL_STORAGE_KEY)
    .catch(() => undefined);
  const signal = stored?.[LAST_CAPTURE_SIGNAL_STORAGE_KEY] as
    | { at?: number; via?: string; results?: { marked?: boolean }[] }
    | undefined;
  if (!signal || typeof signal.at !== 'number' || signal.at < since) return undefined;
  const marked = Array.isArray(signal.results)
    ? signal.results.filter((result) => result?.marked).length
    : 0;
  const via =
    String(signal.via ?? '?')
      .replace(/[^a-z]/gi, '')
      .slice(0, 8) || '?';
  return `stored=${via}/marked=${marked}`;
}

export function watchPrimusCaptureComplete(tabId: number): () => void {
  if (!chrome.storage?.onChanged || !chrome.scripting?.executeScript) return () => undefined;
  const tabs = new Set([tabId]);
  let stopped = false;
  let pending: Promise<unknown> = writeCapturedAttr(tabId, false);
  const mark = (via: 'change' | 'initial') => {
    if (stopped) return;
    const targets = [...tabs];
    pending = pending.then(async () => {
      const results = await Promise.all(targets.map((id) => writeCapturedAttr(id, true)));
      await chrome.storage.local
        .set({ [LAST_CAPTURE_SIGNAL_STORAGE_KEY]: { at: Date.now(), via, results } })
        .catch(() => undefined);
    });
  };
  const onChanged = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== 'local' || stopped) return;
    const debug = changes[PRIMUS_PAGE_DECODE_DEBUG_KEY]?.newValue as
      | { stage?: unknown; tabId?: unknown }
      | undefined;
    if (debug?.stage === 'data_source_tab_ready' && typeof debug.tabId === 'number') {
      tabs.add(debug.tabId);
    }
    if (changes[PRIMUS_BEGIN_ATTEST_KEY]?.newValue === '1') mark('change');
  };
  chrome.storage.onChanged.addListener(onChanged);
  pending = pending.then(async () => {
    const stored = await chrome.storage.local.get(PRIMUS_BEGIN_ATTEST_KEY).catch(() => undefined);
    if (stored?.[PRIMUS_BEGIN_ATTEST_KEY] === '1') mark('initial');
  });
  return () => {
    stopped = true;
    chrome.storage.onChanged.removeListener(onChanged);
  };
}
