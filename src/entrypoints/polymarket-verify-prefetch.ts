/**
 * polymarket_wallet — fire the referral-partner request the landing page does
 * not fire on its own.
 *
 * The verifier reveals one field, the logged-in account's proxy wallet, from a
 * cookie-authed gamma-api endpoint. The page the flow now lands on does not
 * request it; only the referral page does. Without this script the run waits
 * for a request that never comes.
 *
 * Cross-origin but permitted: gamma-api answers with
 * `access-control-allow-origin: https://polymarket.com` and
 * `access-control-allow-credentials: true`, which is how the site's own call
 * works. MAIN world, so the request is indistinguishable from it.
 *
 * This follows the verifier-runtime prefetch pattern used by
 * axis-verify-prefetch: it is an unlisted script, registered only for an active
 * proof, and torn down on every runtime exit.
 */
import { PROOF_RUNTIME_TEARDOWN_EVENT, whenProofArmed } from '@/shared/proof-arming';

export default defineUnlistedScript({
  main() {
    prefetchReferralPartner();
  },
});

const INSTALL_FLAG = '__kaitoPolymarketReferralPartnerPrefetched';
const REFERRAL_PARTNER_URL = 'https://gamma-api.polymarket.com/referral-partner';
/** Let the page's own boot traffic settle; the endpoint needs the session cookie. */
const PREFETCH_DELAY_MS = 2_000;

type PrefetchWindow = Window & typeof globalThis & { [INSTALL_FLAG]?: boolean };

let prefetchTimer: number | undefined;
let stopWaitingForArm: (() => void) | undefined;

/**
 * The verifier's landing surfaces only, not every Polymarket page the user
 * opens. The referral page is included because it stays the fallback landing
 * page for a first-time verifier, whose proxy wallet is not known yet — that is
 * the one value a profile URL would need and the thing the proof establishes.
 * Firing a second copy there is harmless: the page issues the same request, and
 * the interceptor matches on URL.
 */
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
      fetch(REFERRAL_PARTNER_URL, {
        credentials: 'include',
        headers: { accept: 'application/json' },
      }).catch(() => {
        // Best-effort: a failed prefetch degrades to the behaviour without this
        // script, i.e. the run waits for a request that will not come.
      });
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
