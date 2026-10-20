import { PROOF_RUNTIME_TEARDOWN_EVENT, whenProofArmed } from '@/shared/proof-arming';

export default defineUnlistedScript({
  main() {
    installBybitPrefetch();
  },
});

const INSTALL_FLAG = '__kaitoBybitPrefetched';
const CUMULATIVE_PNL_PATH = '/x-api/trading-performance/v1/account/cumulative-pnl?kaito_pf=1';
const CUMULATIVE_PNL_LIST_PATH = '/x-api/trading-performance/v1/account/cumulative-pnl-list';
const SHOTS: Array<{ path: string; init?: RequestInit }> = [
  { path: '/x-api/v3/private/position/list' },
  { path: '/x-api/v3/private/cht/asset-show/asset-trend-chart?dimension=30' },
  {
    path: '/x-api/s1/campaign/referral/commission/get_referral_code',
    init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
  },
  {
    path: '/x-api/s1/campaign/referral/commission/get_commission_info',
    init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
  },
  { path: '/x-api/v2/private/user/profile' },
  { path: '/x-api/user/private/member/info?kaito_pf=1' },
  {
    path: '/x-api/siteapi/unified/private/account-walletbalance',
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ coinList: [] }),
    },
  },
];
const FIRST_DELAY_MS = 1_000;
const REPEAT_MS = 2_000;
const MAX_SHOTS = 12;

type PrefetchWindow = Window & typeof globalThis & { [INSTALL_FLAG]?: boolean };

let timer: number | undefined;
let stopWaitingForArm: (() => void) | undefined;
let generation = 0;

let listUrl: string | undefined;
let listInFlight = false;
let listAbort: AbortController | undefined;
const LIST_EVERY_N_SHOTS = 3;

function shootCumulativePnl(mine: number): void {
  if (listInFlight) return;
  listInFlight = true;
  listAbort ??= new AbortController();
  const signal = listAbort.signal;
  const list = (url: string) =>
    fetch(url, { credentials: 'include', cache: 'no-store', signal })
      .then((response) => response.text())
      .then(() => undefined);
  const request = listUrl
    ? list(listUrl)
    : fetch(CUMULATIVE_PNL_PATH, { credentials: 'include', cache: 'no-store', signal })
        .then((response) => response.json())
        .then((body: { result?: { dataStartTime?: string | number } }) => {
          if (mine !== generation) return;
          const start = Number(body?.result?.dataStartTime);
          const now = Date.now();
          if (!Number.isSafeInteger(start) || start < 1_000_000_000_000 || start > now) return;
          listUrl = `${CUMULATIVE_PNL_LIST_PATH}?startTime=${start}&endTime=${now}&kaito_pf=1`;
          return list(listUrl);
        });
  request
    .catch(() => {})
    .finally(() => {
      listInFlight = false;
    });
}

function shoot(mine: number, shot: number): void {
  if (mine !== generation || shot > MAX_SHOTS) return;
  for (const shot of SHOTS) {
    fetch(shot.path, { credentials: 'include', cache: 'no-store', ...shot.init }).catch(() => {});
  }
  const listShot = (shot - 1) % LIST_EVERY_N_SHOTS === 0;
  if (listUrl || !listShot)
    fetch(CUMULATIVE_PNL_PATH, { credentials: 'include', cache: 'no-store' }).catch(() => {});
  if (listShot) shootCumulativePnl(mine);
  timer = window.setTimeout(() => shoot(mine, shot + 1), REPEAT_MS);
}

function installBybitPrefetch(): void {
  const w = window as PrefetchWindow;
  if (w[INSTALL_FLAG]) return;
  if (location.hostname !== 'www.bybit.com') return;
  w[INSTALL_FLAG] = true;
  const mine = ++generation;
  document.addEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownBybitPrefetch);
  stopWaitingForArm = whenProofArmed(() => {
    timer = window.setTimeout(() => shoot(mine, 1), FIRST_DELAY_MS);
  });
}

function teardownBybitPrefetch(): void {
  generation += 1;
  stopWaitingForArm?.();
  stopWaitingForArm = undefined;
  if (timer !== undefined) window.clearTimeout(timer);
  timer = undefined;
  listAbort?.abort();
  listAbort = undefined;
  listUrl = undefined;
  listInFlight = false;
  delete (window as PrefetchWindow)[INSTALL_FLAG];
  document.removeEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownBybitPrefetch);
}
