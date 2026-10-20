import { PROOF_RUNTIME_TEARDOWN_EVENT, whenProofArmed } from '@/shared/proof-arming';

export default defineUnlistedScript({
  main() {
    prefetchFomoCurrentUser();
  },
});

const INSTALL_FLAG = '__kaitoFomoPrefetched';
const CURRENT_USER_URL = 'https://prod-api.fomo.family/v2/users/current';
const REFERRER_DETAILS_URL = (userId: string) =>
  `https://prod-api.fomo.family/v2/users/${userId}/referrerDetails`;
const PRIVY_TOKEN_KEY = 'privy:token';

const PREFETCH_DELAY_MS = 2_000;

type PrefetchWindow = Window & typeof globalThis & { [INSTALL_FLAG]?: boolean };

let prefetchTimer: number | undefined;
let stopWaitingForArm: (() => void) | undefined;
let runGeneration = 0;

function isVerifierSurface(): boolean {
  return location.hostname === 'fomo.family' || location.hostname.endsWith('.fomo.family');
}

function readPrivyToken(): string | undefined {
  try {
    const raw = window.localStorage.getItem(PRIVY_TOKEN_KEY);
    if (!raw) return undefined;
    return raw.replace(/^"|"$/g, '') || undefined;
  } catch {
    return undefined;
  }
}

function prefetchFomoCurrentUser(): void {
  const w = window as PrefetchWindow;
  if (w[INSTALL_FLAG]) return;
  if (!isVerifierSurface()) return;
  w[INSTALL_FLAG] = true;
  const generation = ++runGeneration;
  document.addEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownFomoPrefetch);

  stopWaitingForArm = whenProofArmed(() => {
    prefetchTimer = window.setTimeout(() => {
      prefetchTimer = undefined;
      const token = readPrivyToken();
      if (!token) return;
      void prefetchPair(token, generation);
    }, PREFETCH_DELAY_MS);
  });
}

function authedGet(url: string, token: string): Promise<Response> {
  return fetch(url, { headers: { authorization: `Bearer ${token}`, Accept: 'application/json' } });
}

async function prefetchPair(token: string, generation: number): Promise<void> {
  try {
    const current = await authedGet(CURRENT_USER_URL, token);
    if (generation !== runGeneration) return;
    const userId = (await current.json())?.responseObject?.id;
    if (generation !== runGeneration || typeof userId !== 'string' || userId.length === 0) return;
    await authedGet(REFERRER_DETAILS_URL(userId), token);
  } catch {}
}

function teardownFomoPrefetch(): void {
  runGeneration += 1;
  stopWaitingForArm?.();
  stopWaitingForArm = undefined;
  if (prefetchTimer !== undefined) window.clearTimeout(prefetchTimer);
  prefetchTimer = undefined;
  delete (window as PrefetchWindow)[INSTALL_FLAG];
  document.removeEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownFomoPrefetch);
}
