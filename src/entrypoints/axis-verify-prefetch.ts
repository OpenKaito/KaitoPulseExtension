
import { PROOF_RUNTIME_TEARDOWN_EVENT, whenProofArmed } from '@/shared/proof-arming';

export default defineUnlistedScript({
  main() {
    prefetchAxisMe();
  },
});

const INSTALL_FLAG = '__kaitoAxisMePrefetched';
const ME_PATH = '/api/me';

const PREFETCH_DELAY_MS = 2_000;

type PrefetchWindow = Window & typeof globalThis & { [INSTALL_FLAG]?: boolean };

let prefetchTimer: number | undefined;
let stopWaitingForArm: (() => void) | undefined;

function isVerifierSurface(): boolean {
  return location.pathname.startsWith('/hub');
}

function prefetchAxisMe(): void {
  const w = window as PrefetchWindow;
  if (w[INSTALL_FLAG]) return;
  if (!isVerifierSurface()) return;
  w[INSTALL_FLAG] = true;
  document.addEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownAxisPrefetch);

  stopWaitingForArm = whenProofArmed(() => {
    prefetchTimer = window.setTimeout(() => {
      prefetchTimer = undefined;
      fetch(ME_PATH, {
        credentials: 'include',
        headers: { accept: 'application/json' },
      }).catch(() => {

      });
    }, PREFETCH_DELAY_MS);
  });
}

function teardownAxisPrefetch(): void {
  stopWaitingForArm?.();
  stopWaitingForArm = undefined;
  if (prefetchTimer !== undefined) window.clearTimeout(prefetchTimer);
  prefetchTimer = undefined;
  delete (window as PrefetchWindow)[INSTALL_FLAG];
  document.removeEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownAxisPrefetch);
}
