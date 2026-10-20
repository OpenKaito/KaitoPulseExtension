import { PROOF_RUNTIME_TEARDOWN_EVENT, whenProofArmed } from '@/shared/proof-arming';

export default defineUnlistedScript({
  main() {
    prefetchReferralPartner();
  },
});

const INSTALL_FLAG = '__kaitoPolymarketReferralPartnerPrefetched';
const REFERRAL_PARTNER_URL = 'https://gamma-api.polymarket.com/referral-partner';
const REFERRAL_CODES_URL = 'https://gamma-api.polymarket.com/referral-codes?kaito_pf=1';
const PREFETCH_DELAY_MS = 2_000;

type PrefetchWindow = Window & typeof globalThis & { [INSTALL_FLAG]?: boolean };

let prefetchTimer: number | undefined;
let stopWaitingForArm: (() => void) | undefined;

function isVerifierSurface(): boolean {
  return /^\/(?:[a-z]{2}\/)?(?:profile\/|@|portfolio(?:$|[/?#])|refer(?:$|[/?#]))/.test(
    location.pathname,
  );
}

function prefetchReferralPartner(): void {
  const w = window as PrefetchWindow;
  if (w[INSTALL_FLAG]) return;
  if (!isVerifierSurface()) return;
  w[INSTALL_FLAG] = true;
  document.addEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownPrefetch);

  stopWaitingForArm = whenProofArmed(() => {
    prefetchTimer = window.setTimeout(() => {
      prefetchTimer = undefined;
      for (const url of [REFERRAL_PARTNER_URL, REFERRAL_CODES_URL]) {
        fetch(url, {
          credentials: 'include',
          headers: { accept: 'application/json' },
        }).catch(() => {});
      }
    }, PREFETCH_DELAY_MS);
  });
}

function teardownPrefetch(): void {
  stopWaitingForArm?.();
  stopWaitingForArm = undefined;
  if (prefetchTimer !== undefined) window.clearTimeout(prefetchTimer);
  prefetchTimer = undefined;
  delete (window as PrefetchWindow)[INSTALL_FLAG];
  document.removeEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownPrefetch);
}
