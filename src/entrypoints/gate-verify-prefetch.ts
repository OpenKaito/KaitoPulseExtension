import { PROOF_RUNTIME_TEARDOWN_EVENT, whenProofArmed } from '@/shared/proof-arming';

export default defineUnlistedScript({
  main() {
    installGatePrefetch();
  },
});

const INSTALL_FLAG = '__kaitoGatePrefetched';
const ORIGIN = 'https://www.gate.com';
const IDENTITY_PATH = '/api/web/v1/rebate/get_user_info';
const TOTAL_FUNDS_PATH = '/apiw/v2/account/total_funds';
const ANALYSIS_PATH = '/apiw/v2/account/analysis/summary';
const MARKER = 'kaito_pf=1';
const DEFAULT_SITE_ID = '0';
const HISTORY_WINDOW_DAYS = 30;
const PNL_WINDOW_DAYS = 180;
const REFERRAL_INFO_PATH = '/api/web/v1/rebate/get_my_referral_info';
const REFERRAL_STATS_PATH = '/api/web/v1/rebate/get_growth_referral_statics';
const POSITIONS_PATH = '/apiw/v2/futures/usdt/positions';
const USER_TIER_PATH = '/api/web/v1/usercenter/get_user_tier';
const FUTURES_ACCOUNT_PATH = '/apiw/v2/futures/usdt/accounts';

const FIRST_DELAY_MS = 1_000;
const REPEAT_MS = 2_500;
const MAX_SHOTS = 5;

type PrefetchWindow = Window & typeof globalThis & { [INSTALL_FLAG]?: boolean };

let siteId = DEFAULT_SITE_ID;
let timer: number | undefined;
let stopWaitingForArm: (() => void) | undefined;
let generation = 0;

function rememberSiteId(url: string): void {
  try {
    const value = new URL(url, location.origin).searchParams.get('sub_website_id');
    if (value && /^\d+$/.test(value)) siteId = value;
  } catch {}
}

function installObserver(): void {
  const originalFetch = window.fetch;
  window.fetch = function patched(input: RequestInfo | URL, init?: RequestInit) {
    try {
      rememberSiteId(input instanceof Request ? input.url : String(input));
    } catch {}
    return originalFetch.call(window, input as RequestInfo, init);
  };

  const proto = XMLHttpRequest.prototype;
  const originalOpen = proto.open;
  proto.open = function open(this: XMLHttpRequest, ...args: unknown[]) {
    try {
      rememberSiteId(String(args[1] ?? ''));
    } catch {}
    return (originalOpen as (...a: unknown[]) => void).apply(this, args);
  } as typeof proto.open;
}

function stamp(offsetDays: number): string {
  const d = new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

function get(path: string, query: string): Promise<Response> {
  return fetch(`${ORIGIN}${path}?${query}`, { credentials: 'include', cache: 'no-store' });
}

async function shoot(mine: number, shot: number): Promise<void> {
  if (mine !== generation || shot > MAX_SHOTS) return;
  const base = `sub_website_id=${siteId}&${MARKER}`;
  try {
    const identity = await get(IDENTITY_PATH, base);
    void get(TOTAL_FUNDS_PATH, base);
    void get(REFERRAL_STATS_PATH, `start_time=0&end_time=${Math.floor(Date.now() / 1000)}&${base}`);
    void get(REFERRAL_INFO_PATH, base);
    void get(POSITIONS_PATH, base);
    void get(USER_TIER_PATH, base);
    void get(FUTURES_ACCOUNT_PATH, base);
    const body = await identity.clone().json();
    const uid = body?.data?.uid;
    if (mine === generation && (typeof uid === 'number' || /^\d+$/.test(String(uid ?? '')))) {
      void get(
        ANALYSIS_PATH,
        `sub_uid=${uid}&from=${stamp(HISTORY_WINDOW_DAYS)}&to=${stamp(0)}&sub_website_id=${siteId}&${MARKER}`,
      );
      void get(
        ANALYSIS_PATH,
        `sub_uid=${uid}&from=${stamp(PNL_WINDOW_DAYS - 1)}&to=${stamp(0)}&sub_website_id=${siteId}&${MARKER}&kaito_days=${PNL_WINDOW_DAYS}`,
      );
    }
  } catch {}
  if (mine !== generation) return;
  timer = window.setTimeout(() => void shoot(mine, shot + 1), REPEAT_MS);
}

function installGatePrefetch(): void {
  const w = window as PrefetchWindow;
  if (w[INSTALL_FLAG]) return;
  if (location.hostname !== 'www.gate.com') return;
  w[INSTALL_FLAG] = true;
  const mine = ++generation;
  installObserver();
  document.addEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownGatePrefetch);
  stopWaitingForArm = whenProofArmed(() => {
    timer = window.setTimeout(() => void shoot(mine, 1), FIRST_DELAY_MS);
  });
}

function teardownGatePrefetch(): void {
  generation += 1;
  stopWaitingForArm?.();
  stopWaitingForArm = undefined;
  if (timer !== undefined) window.clearTimeout(timer);
  timer = undefined;
  siteId = DEFAULT_SITE_ID;
  delete (window as PrefetchWindow)[INSTALL_FLAG];
  document.removeEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownGatePrefetch);
}
