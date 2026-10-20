import { PROOF_RUNTIME_TEARDOWN_EVENT, whenProofArmed } from '@/shared/proof-arming';

export default defineUnlistedScript({
  main() {
    installKrakenPrefetch();
  },
});

const INSTALL_FLAG = '__kaitoKrakenPrefetched';
const API_ORIGIN = 'https://iapi.kraken.com';
const API_PATH = '/api/internal/';
const SETTINGS_PATH = '/api/internal/account/settings';
const PORTFOLIO_URL = `${API_ORIGIN}/api/internal/portfolio/detail?preferred_asset_name=new`;
const SETTINGS_URL = `${API_ORIGIN}${SETTINGS_PATH}?preferred_asset_name=new`;
const WHITELISTED_URL = `${API_ORIGIN}/api/internal/rewards/referrals/whitelisted?preferred_asset_name=new`;
const KORIGIN = { 'X-KOrigin': '2081', 'x-initiated-through': '@frontend/rewards-core' };
const WANTED = [SETTINGS_PATH, '/api/internal/rewards/referrals/whitelisted'];
const SKIP_HEADERS = new Set(['content-length', 'host', 'origin', 'referer']);
const HISTORY_WINDOW_DAYS = 30;

const FIRST_DELAY_MS = 1_000;
const REPEAT_MS = 2_500;
const MAX_SHOTS = 5;

type PrefetchWindow = Window & typeof globalThis & { [INSTALL_FLAG]?: boolean };

const observed: Record<string, string> = {};
const seenUrls = new Map<string, string>();
let historyUrl: string | undefined;
let timer: number | undefined;
let stopWaitingForArm: (() => void) | undefined;
let generation = 0;

const PNL_TYPES = ['spot'];

function buildHistoryUrl(): string {
  const startDate = Math.floor(Date.now() / 1000) - HISTORY_WINDOW_DAYS * 24 * 60 * 60;
  const types = PNL_TYPES.map((t) => `&selected_account_pnl_types=${t}`).join('');
  return `${API_ORIGIN}/api/internal/account/balance/history?include_total=true&quote=USD&start_date=${startDate}${types}`;
}

function isApiUrl(url: string): boolean {
  try {
    const u = new URL(url, location.origin);
    return u.origin === API_ORIGIN && u.pathname.startsWith(API_PATH);
  } catch {
    return false;
  }
}

function remember(url: string, headers: unknown): void {
  if (!isApiUrl(url)) return;
  const wanted = WANTED.find((path) => url.includes(path));
  if (wanted) seenUrls.set(wanted, new URL(url, location.origin).toString());
  try {
    new Headers((headers as HeadersInit) || {}).forEach((value, key) => {
      if (!SKIP_HEADERS.has(key)) observed[key] = value;
    });
  } catch {}
}

function installObserver(): void {
  const originalFetch = window.fetch;
  window.fetch = function patched(input: RequestInfo | URL, init?: RequestInit) {
    try {
      const url = input instanceof Request ? input.url : String(input);
      remember(url, init?.headers ?? (input instanceof Request ? input.headers : undefined));
    } catch {}
    return originalFetch.call(window, input as RequestInfo, init);
  };

  type TrackedXhr = XMLHttpRequest & { __kaitoUrl?: string };
  const proto = XMLHttpRequest.prototype;
  const originalOpen = proto.open;
  const originalSet = proto.setRequestHeader;
  proto.open = function open(this: TrackedXhr, ...args: unknown[]) {
    this.__kaitoUrl = String(args[1] ?? '');
    try {
      remember(this.__kaitoUrl, undefined);
    } catch {}
    return (originalOpen as (...a: unknown[]) => void).apply(this, args);
  } as typeof proto.open;
  proto.setRequestHeader = function setHeader(this: TrackedXhr, name: string, value: string) {
    try {
      if (this.__kaitoUrl && isApiUrl(this.__kaitoUrl) && !SKIP_HEADERS.has(name.toLowerCase())) {
        observed[name.toLowerCase()] = value;
      }
    } catch {}
    return originalSet.call(this, name, value);
  };
}

function shoot(mine: number, shot: number): void {
  if (mine !== generation || shot > MAX_SHOTS) return;
  if (Object.keys(observed).length > 0) {
    if (!historyUrl) historyUrl = buildHistoryUrl();
    const urls = new Set([SETTINGS_URL, PORTFOLIO_URL, WHITELISTED_URL, historyUrl]);
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(observed)) headers[key.toLowerCase()] = value;
    for (const [key, value] of Object.entries(KORIGIN)) headers[key.toLowerCase()] = value;
    for (const url of urls) {
      fetch(url, { credentials: 'include', cache: 'no-store', headers }).catch(() => {});
    }
  }
  timer = window.setTimeout(() => shoot(mine, shot + 1), REPEAT_MS);
}

function installKrakenPrefetch(): void {
  const w = window as PrefetchWindow;
  if (w[INSTALL_FLAG]) return;
  if (location.hostname !== 'www.kraken.com') return;
  w[INSTALL_FLAG] = true;
  const mine = ++generation;
  installObserver();
  document.addEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownKrakenPrefetch);
  stopWaitingForArm = whenProofArmed(() => {
    timer = window.setTimeout(() => shoot(mine, 1), FIRST_DELAY_MS);
  });
}

function teardownKrakenPrefetch(): void {
  generation += 1;
  stopWaitingForArm?.();
  stopWaitingForArm = undefined;
  if (timer !== undefined) window.clearTimeout(timer);
  timer = undefined;
  historyUrl = undefined;
  seenUrls.clear();
  delete (window as PrefetchWindow)[INSTALL_FLAG];
  document.removeEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownKrakenPrefetch);
}
