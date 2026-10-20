import { PROOF_RUNTIME_TEARDOWN_EVENT, whenProofArmed } from '@/shared/proof-arming';

export default defineUnlistedScript({
  main() {
    installBinancePrefetch();
  },
});

const INSTALL_FLAG = '__kaitoBinancePrefetched';
const PRIVATE_PATH = /\/bapi\/[^?]*\/private\//;
const WANTED = [
  '/bapi/accounts/v1/private/account/get-user-base-info',
  '/bapi/asset/v3/private/asset-service/wallet/wallet-group',
  '/bapi/asset/v2/private/asset-service/wallet/balance',
  '/bapi/futures/v4/private/future/user-data/user-position',
  '/bapi/futures/v4/private/future/user-data/user-balance',
  '/bapi/apex/v2/private/apex/marketing/wallet/userHistoryAssets',
  '/bapi/apex/v1/private/apex/market/overview/wallet/daily-pnls',
  '/bapi/apex/v1/private/apex/market/recent-deposit-withdraw',
  '/bapi/apex/v4/private/apex/pnl/overview/avgCost',
  '/bapi/asset/v2/private/asset-service/wallet/asset',
  '/bapi/composite/v1/private/snapshot/select/checked/sharecode',
  '/bapi/growth/v6/private/referral/commissions/statistic',
  '/bapi/composite/v1/private/bigdata/pnl/timeFrameTotalPnl',
];
const MAX_BODY_VARIANTS = 4;
const SKIP_HEADERS = new Set(['content-length', 'host', 'origin', 'referer']);

const FIRST_DELAY_MS = 1_000;
const REPEAT_MS = 2_000;
const MAX_SHOTS = 12;
const AVG_COST_PATH = '/bapi/apex/v4/private/apex/pnl/overview/avgCost';
const AVG_COST_FALLBACK_AFTER = 3;
const FUTURES_SEEDS: Array<{ path: string; body: string }> = [
  { path: '/bapi/futures/v4/private/future/user-data/user-position', body: '{}' },
  { path: '/bapi/futures/v4/private/future/user-data/user-balance', body: '{"asset":""}' },
  { path: '/bapi/composite/v1/private/bigdata/pnl/timeFrameTotalPnl', body: '{}' },
];

type Shot = { url: string; method: string; body?: string };
type PrefetchWindow = Window & typeof globalThis & { [INSTALL_FLAG]?: boolean };

const observed: Record<string, string> = {};
const seen = new Map<string, Shot>();
let timer: number | undefined;
let stopWaitingForArm: (() => void) | undefined;
let generation = 0;

function sameOriginPrivate(url: string): boolean {
  try {
    const u = new URL(url, location.origin);
    return u.origin === location.origin && PRIVATE_PATH.test(u.pathname);
  } catch {
    return false;
  }
}

function remember(url: string, method: string, headers: unknown, body?: string): void {
  if (!sameOriginPrivate(url)) return;
  const wanted = WANTED.find((path) => url.includes(path));
  if (wanted) {
    const key = `${wanted}|${body ?? ''}`;
    if (seen.has(key) || variantCount(wanted) < MAX_BODY_VARIANTS) {
      seen.set(key, { url: new URL(url, location.origin).toString(), method, body });
    }
  }
  try {
    new Headers((headers as HeadersInit) || {}).forEach((value, key) => {
      if (!SKIP_HEADERS.has(key)) observed[key] = value;
    });
  } catch {}
}

function variantCount(wanted: string): number {
  let n = 0;
  for (const key of seen.keys()) if (key.startsWith(`${wanted}|`)) n += 1;
  return n;
}

function installObserver(): void {
  const originalFetch = window.fetch;
  window.fetch = function patched(input: RequestInfo | URL, init?: RequestInit) {
    try {
      const url = input instanceof Request ? input.url : String(input);
      const method = String(init?.method ?? (input instanceof Request ? input.method : 'GET'));
      const body = typeof init?.body === 'string' ? init.body : undefined;
      remember(
        url,
        method,
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
        body,
      );
    } catch {}
    return originalFetch.call(window, input as RequestInfo, init);
  };

  type TrackedXhr = XMLHttpRequest & { __kaitoUrl?: string; __kaitoMethod?: string };
  const proto = XMLHttpRequest.prototype;
  const originalOpen = proto.open;
  const originalSet = proto.setRequestHeader;
  const originalSend = proto.send;
  proto.open = function open(this: TrackedXhr, ...args: unknown[]) {
    this.__kaitoMethod = String(args[0] ?? 'GET');
    this.__kaitoUrl = String(args[1] ?? '');
    return (originalOpen as (...a: unknown[]) => void).apply(this, args);
  } as typeof proto.open;
  proto.setRequestHeader = function setHeader(this: TrackedXhr, name: string, value: string) {
    try {
      if (
        this.__kaitoUrl &&
        sameOriginPrivate(this.__kaitoUrl) &&
        !SKIP_HEADERS.has(name.toLowerCase())
      ) {
        observed[name.toLowerCase()] = value;
      }
    } catch {}
    return originalSet.call(this, name, value);
  };
  proto.send = function send(this: TrackedXhr, body?: Document | XMLHttpRequestBodyInit | null) {
    try {
      if (this.__kaitoUrl) {
        remember(
          this.__kaitoUrl,
          this.__kaitoMethod ?? 'GET',
          undefined,
          typeof body === 'string' ? body : undefined,
        );
      }
    } catch {}
    return originalSend.call(this, body as XMLHttpRequestBodyInit | null);
  };
}

function shoot(mine: number, shot: number): void {
  if (mine !== generation || shot > MAX_SHOTS) return;
  if (
    shot >= AVG_COST_FALLBACK_AFTER &&
    Object.keys(observed).length > 0 &&
    variantCount(AVG_COST_PATH) === 0
  ) {
    seen.set(`${AVG_COST_PATH}|fallback`, {
      url: new URL(AVG_COST_PATH, location.origin).toString(),
      method: 'POST',
      body: JSON.stringify({ tokens: ['BTC'] }),
    });
  }
  if (Object.keys(observed).length > 0) {
    for (const { path, body } of FUTURES_SEEDS) {
      if (variantCount(path) === 0) {
        seen.set(`${path}|seed`, {
          url: new URL(path, location.origin).toString(),
          method: 'POST',
          body,
        });
      }
    }
  }
  if (Object.keys(observed).length > 0) {
    for (const { url, method, body } of seen.values()) {
      const init: RequestInit = {
        method,
        credentials: 'include',
        cache: 'no-store',
        headers: observed,
      };
      if (method !== 'GET' && method !== 'HEAD') init.body = body ?? '{}';
      fetch(url, init).catch(() => {});
    }
  }
  timer = window.setTimeout(() => shoot(mine, shot + 1), REPEAT_MS);
}

function installBinancePrefetch(): void {
  const w = window as PrefetchWindow;
  if (w[INSTALL_FLAG]) return;
  if (location.hostname !== 'www.binance.com') return;
  w[INSTALL_FLAG] = true;
  const mine = ++generation;
  installObserver();
  document.addEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownBinancePrefetch);
  stopWaitingForArm = whenProofArmed(() => {
    timer = window.setTimeout(() => shoot(mine, 1), FIRST_DELAY_MS);
  });
}

function teardownBinancePrefetch(): void {
  generation += 1;
  stopWaitingForArm?.();
  stopWaitingForArm = undefined;
  if (timer !== undefined) window.clearTimeout(timer);
  timer = undefined;
  seen.clear();
  delete (window as PrefetchWindow)[INSTALL_FLAG];
  document.removeEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownBinancePrefetch);
}
