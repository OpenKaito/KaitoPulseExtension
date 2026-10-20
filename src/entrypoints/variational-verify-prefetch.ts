import {
  isProofCaptured,
  PROOF_RUNTIME_TEARDOWN_EVENT,
  whenProofArmed,
} from '@/shared/proof-arming';

export default defineUnlistedScript({
  main() {
    installVariationalPrefetch();
  },
});

const INSTALL_FLAG = '__kaitoVariationalReferralPrefetched';
const PATHS = [
  '/api/referrals?limit=1&offset=0',
  '/api/portfolio/timeseries?period=one_day&kaito_pf=1',
  '/api/portfolio/timeseries?period=one_year&kaito_pf=1',
  '/api/points/history?kaito_pf=1',
];
const SPARSE_PATHS = ['/api/rewards/vip'];
const SPARSE_SHOTS = new Set([1, 6]);
const FIRST_DELAY_MS = 1_000;
const REPEAT_MS = 2_000;
const MAX_SHOTS = 12;

type PrefetchWindow = Window & typeof globalThis & { [INSTALL_FLAG]?: boolean };

let timer: number | undefined;
let stopWaitingForArm: (() => void) | undefined;
let generation = 0;

function shoot(mine: number, shot: number): void {
  if (mine !== generation || shot > MAX_SHOTS || isProofCaptured()) return;
  const paths = SPARSE_SHOTS.has(shot) ? [...PATHS, ...SPARSE_PATHS] : PATHS;
  for (const path of paths) {
    fetch(path, { cache: 'no-store' }).catch(() => {});
  }
  timer = window.setTimeout(() => shoot(mine, shot + 1), REPEAT_MS);
}

function installVariationalPrefetch(): void {
  const w = window as PrefetchWindow;
  if (w[INSTALL_FLAG]) return;
  if (location.hostname !== 'omni.variational.io') return;
  w[INSTALL_FLAG] = true;
  const mine = ++generation;
  document.addEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownVariationalPrefetch);

  stopWaitingForArm = whenProofArmed(() => {
    timer = window.setTimeout(() => shoot(mine, 1), FIRST_DELAY_MS);
  });
}

function teardownVariationalPrefetch(): void {
  generation += 1;
  stopWaitingForArm?.();
  stopWaitingForArm = undefined;
  if (timer !== undefined) window.clearTimeout(timer);
  timer = undefined;
  delete (window as PrefetchWindow)[INSTALL_FLAG];
  document.removeEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownVariationalPrefetch);
}
