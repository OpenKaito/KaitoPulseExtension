import {
  isProofCaptured,
  PROOF_RUNTIME_TEARDOWN_EVENT,
  whenProofArmed,
} from '@/shared/proof-arming';

export default defineUnlistedScript({
  main() {
    installLighterPrefetch();
  },
});

const INSTALL_FLAG = '__kaitoLighterPrefetched';
const API_HOST = 'mainnet.zklighter.elliot.ai';
const USER_REFERRALS_URL = (l1: string) =>
  `https://${API_HOST}/api/v1/referral/userReferrals?l1_address=${l1}&is_eligible=false`;
const ACCOUNT_URL_PATTERN = /\/api\/v1\/account\?by=[a-z0-9_]+&value=\S+/;

const ARM_DELAY_MS = 2_000;
const REPLAY_INTERVAL_MS = 4_000;
const MAX_ATTEMPTS = 10;
const ACCOUNT_ATTEMPTS = 3;

type PrefetchWindow = Window & typeof globalThis & { [INSTALL_FLAG]?: boolean };

let timer: number | undefined;
let stopWaitingForArm: (() => void) | undefined;
let runGeneration = 0;
let restoreFetch: (() => void) | undefined;

let observed: {
  authorization?: string;
  wafToken?: string;
  l1Address?: string;
  accountUrl?: string;
} = {};

function isVerifierSurface(): boolean {
  return location.hostname === 'app.lighter.xyz';
}

function remember(url: string, headers: unknown): void {
  if (!url.includes(API_HOST)) return;
  const l1 = /[?&]l1_address=(0x[0-9a-fA-F]{40})/.exec(url)?.[1];
  if (l1) observed.l1Address = l1;
  if (ACCOUNT_URL_PATTERN.test(url)) observed.accountUrl = url;
  try {
    const h = new Headers((headers as HeadersInit) || {});
    const auth = h.get('authorization');
    const waf = h.get('x-aws-waf-token');
    if (auth) observed.authorization = auth;
    if (waf) observed.wafToken = waf;
  } catch {}
}

function installObserver(): void {
  const originalFetch = window.fetch;
  let observing = true;
  const patched = function patched(input: RequestInfo | URL, init?: RequestInit) {
    if (observing) {
      try {
        const url = input instanceof Request ? input.url : String(input);
        remember(url, init?.headers ?? (input instanceof Request ? input.headers : undefined));
      } catch {}
    }
    return originalFetch.call(window, input as RequestInfo, init);
  };
  window.fetch = patched;
  restoreFetch = () => {
    observing = false;
    if (window.fetch === patched) window.fetch = originalFetch;
  };
}

function stillWanted(generation: number): boolean {
  return generation === runGeneration && !isProofCaptured();
}

async function replay(generation: number, attempt = 1): Promise<void> {
  if (!stillWanted(generation) || attempt > MAX_ATTEMPTS) return;
  const again = () => {
    timer = window.setTimeout(() => void replay(generation, attempt + 1), REPLAY_INTERVAL_MS);
  };
  const { authorization, wafToken, l1Address, accountUrl } = observed;
  if (!authorization || !l1Address) {
    again();
    return;
  }
  const headers: Record<string, string> = {
    accept: '*/*',
    authorization,
    preferauthserver: 'true',
  };
  if (wafToken) headers['x-aws-waf-token'] = wafToken;
  try {
    await fetch(USER_REFERRALS_URL(l1Address), { headers, cache: 'no-store' });
    if (!stillWanted(generation)) return;
    if (accountUrl && attempt <= ACCOUNT_ATTEMPTS) {
      await fetch(accountUrl, { cache: 'no-store' });
      if (!stillWanted(generation)) return;
    }
  } catch {}
  again();
}

function installLighterPrefetch(): void {
  const w = window as PrefetchWindow;
  if (w[INSTALL_FLAG]) return;
  if (!isVerifierSurface()) return;
  w[INSTALL_FLAG] = true;
  const generation = ++runGeneration;
  installObserver();
  document.addEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownLighterPrefetch);

  stopWaitingForArm = whenProofArmed(() => {
    timer = window.setTimeout(() => void replay(generation), ARM_DELAY_MS);
  });
}

function teardownLighterPrefetch(): void {
  runGeneration += 1;
  stopWaitingForArm?.();
  stopWaitingForArm = undefined;
  if (timer !== undefined) window.clearTimeout(timer);
  timer = undefined;
  observed = {};
  restoreFetch?.();
  restoreFetch = undefined;
  delete (window as PrefetchWindow)[INSTALL_FLAG];
  document.removeEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownLighterPrefetch);
}
