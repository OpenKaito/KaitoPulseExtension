import { PROOF_RUNTIME_TEARDOWN_EVENT, whenProofArmed } from '@/shared/proof-arming';

export default defineUnlistedScript({
  main() {
    installMexcPrefetch();
  },
});

const INSTALL_FLAG = '__kaitoMexcPrefetched';
const OBSERVER_FLAG = '__kaitoMexcObserverInstalled';
const ORIGIN = 'https://www.mexc.com';
const MARKER = 'kaito_pf=1';

const FUTURES_PRIVATE = '/api/platform/futures/api/v1/private';
const SIGNED_PATHS = [
  `${FUTURES_PRIVATE}/account/asset/analysis/v3`,
  `${FUTURES_PRIVATE}/account/asset/analysis/calendar/daily/v3`,
];
const AUTHED_PATHS = [
  `${FUTURES_PRIVATE}/position/open_positions`,
  `${FUTURES_PRIVATE}/account/asset/USDT`,
];

function paths(): string[] {
  return [
    '/api/credit-score/api/v1/credit/user/simple/info',
    '/api/platform/asset/api/asset/overview/convert/v5',
    '/api/platform/asset/api/asset/trend?type=BEFORE_MONTH',
    '/api/assetbussiness/invite/info',
    '/api/agent/main/referral/user/level/info',
    '/api/assetbussiness/asset/spot/analysis/summary',
  ];
}

type SignedRequest = { headers: Record<string, string>; body: string };
const signedRequests = new Map<string, SignedRequest>();
const pendingXhr: WeakMap<XMLHttpRequest, { path: string; headers: Record<string, string> }> =
  new WeakMap();

function signedPath(url: string): string | undefined {
  if (url.includes(MARKER)) return undefined;
  try {
    const { pathname } = new URL(url, location.href);
    return SIGNED_PATHS.find((path) => pathname === path);
  } catch {
    return undefined;
  }
}

function sessionToken(): string | undefined {
  const entry = document.cookie.split('; ').find((c) => c.startsWith('u_id='));
  if (!entry) return undefined;
  try {
    return decodeURIComponent(entry.slice('u_id='.length));
  } catch {
    return undefined;
  }
}

function installObserver(): void {
  const w = window as PrefetchWindow;
  if (w[OBSERVER_FLAG]) return;
  w[OBSERVER_FLAG] = true;
  const open = XMLHttpRequest.prototype.open;
  const setRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    const href = String(url);
    const path = signedPath(href);
    if (path) pendingXhr.set(this, { path, headers: {} });
    return (open as (...a: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.setRequestHeader = function (
    this: XMLHttpRequest,
    name: string,
    value: string,
  ) {
    const pending = pendingXhr.get(this);
    if (pending) pending.headers[name.toLowerCase()] = value;
    return setRequestHeader.call(this, name, value);
  };
  XMLHttpRequest.prototype.send = function (
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null,
  ) {
    const pending = pendingXhr.get(this);
    if (pending && typeof body === 'string')
      signedRequests.set(pending.path, { headers: pending.headers, body });
    return send.call(this, body);
  };
  const originalFetch = window.fetch;
  window.fetch = function patched(input: RequestInfo | URL, init?: RequestInit) {
    try {
      const url = input instanceof Request ? input.url : String(input);
      const path = signedPath(url);
      if (path && typeof init?.body === 'string') {
        const headers: Record<string, string> = {};
        new Headers(init.headers).forEach((value, name) => {
          headers[name] = value;
        });
        signedRequests.set(path, { headers, body: init.body });
      }
    } catch {}
    return originalFetch.call(window, input as RequestInfo, init);
  };
}

const FIRST_DELAY_MS = 1_500;
const REPEAT_MS = 2_000;
const MAX_SHOTS = 12;

type PrefetchWindow = Window &
  typeof globalThis & { [INSTALL_FLAG]?: boolean; [OBSERVER_FLAG]?: boolean };

let timer: number | undefined;
let stopWaitingForArm: (() => void) | undefined;
let generation = 0;

function shoot(mine: number, shot: number): void {
  if (mine !== generation || shot > MAX_SHOTS) return;
  for (const path of paths()) {
    const url = `${ORIGIN}${path}${path.includes('?') ? '&' : '?'}${MARKER}`;
    fetch(url, { credentials: 'include', cache: 'no-store' }).catch(() => {});
  }
  const token = sessionToken();
  if (token) {
    for (const path of AUTHED_PATHS) {
      fetch(`${ORIGIN}${path}?${MARKER}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: { authorization: token },
      }).catch(() => {});
    }
  }
  for (const [path, signed] of signedRequests) {
    fetch(`${ORIGIN}${path}?${MARKER}`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: signed.headers,
      body: signed.body,
    }).catch(() => {});
  }
  timer = window.setTimeout(() => shoot(mine, shot + 1), REPEAT_MS);
}

function installMexcPrefetch(): void {
  const w = window as PrefetchWindow;
  if (w[INSTALL_FLAG]) return;
  if (location.hostname !== 'www.mexc.com') return;
  w[INSTALL_FLAG] = true;
  const mine = ++generation;
  installObserver();
  document.addEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownMexcPrefetch);
  stopWaitingForArm = whenProofArmed(() => {
    timer = window.setTimeout(() => shoot(mine, 1), FIRST_DELAY_MS);
  });
}

function teardownMexcPrefetch(): void {
  generation += 1;
  stopWaitingForArm?.();
  stopWaitingForArm = undefined;
  if (timer !== undefined) window.clearTimeout(timer);
  timer = undefined;
  delete (window as PrefetchWindow)[INSTALL_FLAG];
  document.removeEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownMexcPrefetch);
}
