import { PROOF_RUNTIME_TEARDOWN_EVENT, whenProofArmed } from '@/shared/proof-arming';

export default defineUnlistedScript({
  main() {
    installOkxPrefetch();
  },
});

const INSTALL_FLAG = '__kaitoOkxPrefetched';
const API_PATH = /\/v\d+\//;
const PROFILE_PATH = '/v3/users/security/profile';
const OKX_HOSTS = new Set(['www.okx.com', 'app.okx.com']);
const OVERVIEW_PATH = '/priapi/v3/growth/referral/v3/overview';
const WANTED = [
  PROFILE_PATH,
  '/priapi/v3/growth/web/referral/offshore/home',
  '/priapi/v3/growth/web/referral/onshore/home',
  OVERVIEW_PATH,
  '/v2/asset/balance/balance-portfolio',
  '/v2/asset/accounts/frozen-assets-summary',
];
const SKIP_HEADERS = new Set(['content-length', 'host', 'origin', 'referer']);
const TREND_WINDOW_MS = 180 * 24 * 60 * 60 * 1_000;
const AGGREGATE_PATH = '/priapi/v1/affiliate/web/user/stats/aggregate';
const ACCOUNT_PATHS = [
  '/priapi/v5/account/account-summary?kaito_pf=1',
  '/priapi/v5/account/positions?kaito_pf=1',
];

const FIRST_DELAY_MS = 1_000;
const REPEAT_MS = 2_000;
const MAX_SHOTS = 12;

type PrefetchWindow = Window & typeof globalThis & { [INSTALL_FLAG]?: boolean };

const observed: Record<string, string> = {};
const seenUrls = new Map<string, string>();
let trendUrl: string | undefined;
let timer: number | undefined;
let stopWaitingForArm: (() => void) | undefined;
let generation = 0;

function buildTrendUrl(): string {
  const endTime = Date.now();
  const startTime = endTime - TREND_WINDOW_MS;
  return (
    `${location.origin}/v2/asset/analysis/trend` +
    '?accountType=0&cedefiLimit=false&costPriceType=1' +
    `&endTime=${endTime}&fiatCurrency=USD&includeCedefi=true&spotPnlFilterType=2` +
    `&startTime=${startTime}&isPayFeatureOpen=true`
  );
}

const ownUrls = new Set<string>();

function remember(url: string, headers: unknown): void {
  if (!API_PATH.test(url)) return;
  if (ownUrls.has(url)) return;
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

  const proto = XMLHttpRequest.prototype;
  const originalOpen = proto.open;
  const originalSet = proto.setRequestHeader;
  proto.open = function open(this: XMLHttpRequest & { __kaitoUrl?: string }, ...args: unknown[]) {
    this.__kaitoUrl = String(args[1] ?? '');
    try {
      remember(this.__kaitoUrl, undefined);
    } catch {}
    return (originalOpen as (...a: unknown[]) => void).apply(this, args);
  } as typeof proto.open;
  proto.setRequestHeader = function setHeader(
    this: XMLHttpRequest & { __kaitoUrl?: string },
    name: string,
    value: string,
  ) {
    try {
      if (
        this.__kaitoUrl &&
        API_PATH.test(this.__kaitoUrl) &&
        !SKIP_HEADERS.has(name.toLowerCase())
      ) {
        observed[name.toLowerCase()] = value;
      }
    } catch {}
    return originalSet.call(this, name, value);
  };
}

const landed = new Set<string>();

function fireOnce(key: string, url: string, init: RequestInit): void {
  if (landed.has(key)) return;
  landed.add(key);
  ownUrls.add(url);
  fetch(url, init)
    .then((response) => {
      if (!response.ok) landed.delete(key);
    })
    .catch(() => {
      landed.delete(key);
    });
}

function shoot(mine: number, shot: number): void {
  if (mine !== generation || shot > MAX_SHOTS) return;
  if (Object.keys(observed).length > 0) {
    if (!trendUrl) trendUrl = buildTrendUrl();
    const origin = location.origin;
    for (const path of [PROFILE_PATH, OVERVIEW_PATH]) {
      if (!seenUrls.has(path)) {
        fireOnce(path, `${origin}${path}?t=${Date.now()}`, {
          credentials: 'include',
          cache: 'no-store',
          headers: observed,
        });
      }
    }
    for (const url of [...seenUrls.values(), trendUrl]) {
      fireOnce(url, url, { credentials: 'include', cache: 'no-store', headers: observed });
    }
    fireOnce(AGGREGATE_PATH, `${origin}${AGGREGATE_PATH}?t=${Date.now()}`, {
      credentials: 'include',
      cache: 'no-store',
      headers: observed,
    });
    for (const path of ACCOUNT_PATHS) {
      const url = `${origin}${path}`;
      fireOnce(url, url, { credentials: 'include', cache: 'no-store', headers: observed });
    }
  }
  timer = window.setTimeout(() => shoot(mine, shot + 1), REPEAT_MS);
}

function installOkxPrefetch(): void {
  const w = window as PrefetchWindow;
  if (w[INSTALL_FLAG]) return;
  if (!OKX_HOSTS.has(location.hostname)) return;
  w[INSTALL_FLAG] = true;
  const mine = ++generation;
  installObserver();
  document.addEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownOkxPrefetch);
  stopWaitingForArm = whenProofArmed(() => {
    timer = window.setTimeout(() => shoot(mine, 1), FIRST_DELAY_MS);
  });
}

function teardownOkxPrefetch(): void {
  landed.clear();
  ownUrls.clear();
  generation += 1;
  stopWaitingForArm?.();
  stopWaitingForArm = undefined;
  if (timer !== undefined) window.clearTimeout(timer);
  timer = undefined;
  trendUrl = undefined;
  delete (window as PrefetchWindow)[INSTALL_FLAG];
  document.removeEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownOkxPrefetch);
}
