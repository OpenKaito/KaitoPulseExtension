import { PROOF_RUNTIME_TEARDOWN_EVENT, whenProofArmed } from '@/shared/proof-arming';

export default defineUnlistedScript({
  main() {
    installBitgetPrefetch();
  },
});

const INSTALL_FLAG = '__kaitoBitgetPrefetched';
const ORIGIN = 'https://www.bitget.com';
const MARKER = '?kaito_pf=1';

const PNL_WINDOW_DAYS = 180;
const DAY_MS = 86_400_000;

const CURVE_DAYS = 30;

function pnlWindow(days = PNL_WINDOW_DAYS): { beginTime: number; endTime: number } {
  const endTime = Math.floor(Date.now() / DAY_MS) * DAY_MS + DAY_MS;
  return { beginTime: endTime - days * DAY_MS, endTime };
}

const PNL_MARKER = `${MARKER}&kaito_days=${PNL_WINDOW_DAYS}`;

function calls(): Array<{ path: string; body: unknown; marker?: string }> {
  const range = pnlWindow();
  const curve = pnlWindow(CURVE_DAYS);
  const curveMarker = `${MARKER}&kaito_days=${CURVE_DAYS}`;
  return [
    { path: '/v1/user/overview/simpleUserInfo', body: { languageType: 1 } },
    { path: '/v1/mix/assetsV2', body: { bizLineCodes: ['spot'] } },
    { path: '/v1/act/invitation/invite/code', body: {} },
    { path: '/v1/act/invitation/dashboard/invite/count', body: { languageType: 0 } },
    { path: '/v1/act/clc/rebate/user/info', body: {} },
    { path: '/v1/statistics/assets/getAssetsOverview', body: {} },
    {
      path: '/v1/statistics/assets/getSpotAssetsDetailV2',
      body: { businessLine: 1, ...range, languageType: 0 },
      marker: PNL_MARKER,
    },
    {
      path: '/v1/statistics/assets/getMixDealAnalyzeV3',
      body: {
        settleToken: 'USDT',
        symbol: 'ALL-SUMMARY',
        businessLine: '10',
        ...range,
        languageType: 0,
      },
      marker: PNL_MARKER,
    },
    {
      path: '/v1/statistics/assets/getSpotAssetsDetailV2',
      body: { businessLine: 1, ...curve, languageType: 0 },
      marker: curveMarker,
    },
    {
      path: '/v1/statistics/assets/getMixDealAnalyzeV3',
      body: {
        settleToken: 'USDT',
        symbol: 'ALL-SUMMARY',
        businessLine: '10',
        ...curve,
        languageType: 0,
      },
      marker: curveMarker,
    },
    {
      path: '/v1/mix/assetsV2',
      body: { bizLineCodes: ['mix'] },
      marker: `${MARKER}&kaito_scope=mix`,
    },
  ];
}

const FIRST_DELAY_MS = 1_500;
const REPEAT_MS = 2_000;
const MAX_SHOTS = 12;

type PrefetchWindow = Window & typeof globalThis & { [INSTALL_FLAG]?: boolean };

let timer: number | undefined;
let stopWaitingForArm: (() => void) | undefined;
let generation = 0;

function shoot(mine: number, shot: number): void {
  if (mine !== generation || shot > MAX_SHOTS) return;
  for (const call of calls()) {
    fetch(`${ORIGIN}${call.path}${call.marker ?? MARKER}`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(call.body),
    }).catch(() => {});
  }
  timer = window.setTimeout(() => shoot(mine, shot + 1), REPEAT_MS);
}

function installBitgetPrefetch(): void {
  const w = window as PrefetchWindow;
  if (w[INSTALL_FLAG]) return;
  if (location.hostname !== 'www.bitget.com') return;
  w[INSTALL_FLAG] = true;
  const mine = ++generation;
  document.addEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownBitgetPrefetch);
  stopWaitingForArm = whenProofArmed(() => {
    timer = window.setTimeout(() => shoot(mine, 1), FIRST_DELAY_MS);
  });
}

function teardownBitgetPrefetch(): void {
  generation += 1;
  stopWaitingForArm?.();
  stopWaitingForArm = undefined;
  if (timer !== undefined) window.clearTimeout(timer);
  timer = undefined;
  delete (window as PrefetchWindow)[INSTALL_FLAG];
  document.removeEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownBitgetPrefetch);
}
