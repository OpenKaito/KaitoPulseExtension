import { PROOF_RUNTIME_TEARDOWN_EVENT, whenProofArmed } from '@/shared/proof-arming';
import { recordPagePrefetch } from '@/verify/x-graphql-prefetch-diagnostics';

export default defineUnlistedScript({
  main() {
    prefetchAxisMe();
  },
});

const INSTALL_FLAG = '__kaitoAxisMePrefetched';
const ME_PATH = '/api/me';
const DIAGNOSTICS_OPERATION = 'axisMe';

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

  recordPagePrefetch(DIAGNOSTICS_OPERATION, (entry) => ({ ...entry, skip: 'waiting_for_arm' }));
  stopWaitingForArm = whenProofArmed(() => {
    recordPagePrefetch(DIAGNOSTICS_OPERATION, (entry) => ({ ...entry, skip: 'armed' }));
    prefetchTimer = window.setTimeout(() => {
      prefetchTimer = undefined;
      const at = Date.now();
      const settle = (status: number | 'network_error') =>
        recordPagePrefetch(DIAGNOSTICS_OPERATION, (entry) => ({
          ...entry,
          results: (entry.results ?? []).map((r) => (r.at === at ? { ...r, status } : r)),
        }));
      recordPagePrefetch(DIAGNOSTICS_OPERATION, (entry) => ({
        ...entry,
        skip: undefined,
        results: [...(entry.results ?? []), { status: 'pending', at }],
      }));
      fetch(ME_PATH, {
        credentials: 'include',
        headers: { accept: 'application/json' },
      })
        .then((response) => settle(response.status))
        .catch(() => settle('network_error'));
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
