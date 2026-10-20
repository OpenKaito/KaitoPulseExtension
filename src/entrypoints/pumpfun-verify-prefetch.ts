import { PROOF_RUNTIME_TEARDOWN_EVENT, whenProofArmed } from '@/shared/proof-arming';

export default defineUnlistedScript({
  main() {
    prefetchPumpfunProfile();
  },
});

const INSTALL_FLAG = '__kaitoPumpfunProfilePrefetched';
const API_ORIGIN = 'https://frontend-api-v3.pump.fun';
const MY_PROFILE_URL = `${API_ORIGIN}/auth/my-profile`;
const SVM_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const PREFETCH_SETTLE_MS = 800;
const PREFETCH_ATTEMPTS = 5;
const PREFETCH_INTERVAL_MS = 2_000;

type PrefetchWindow = Window & typeof globalThis & { [INSTALL_FLAG]?: boolean };

let attemptTimer: number | undefined;
let stopWaitingForArm: (() => void) | undefined;
let aborted = false;
let cachedAddress: string | undefined;

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) return undefined;
  return response.json();
}

function readAddress(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const address = (body as { address?: unknown }).address;
  if (typeof address !== 'string' || !SVM_ADDRESS.test(address)) return undefined;
  return address;
}

async function fireTargetRequests(): Promise<boolean> {
  const session = await fetchJson(MY_PROFILE_URL);
  if (aborted) return false;
  cachedAddress = readAddress(session) ?? cachedAddress;
  if (!cachedAddress) return false;
  await fetchJson(`${API_ORIGIN}/users/${cachedAddress}`);
  return !aborted;
}

function scheduleAttempts(attempt: number): void {
  if (aborted || attempt >= PREFETCH_ATTEMPTS) return;
  attemptTimer = window.setTimeout(
    () => {
      attemptTimer = undefined;
      void fireTargetRequests()
        .catch(() => {})
        .finally(() => scheduleAttempts(attempt + 1));
    },
    attempt === 0 ? PREFETCH_SETTLE_MS : PREFETCH_INTERVAL_MS,
  );
}

function prefetchPumpfunProfile(): void {
  const w = window as PrefetchWindow;
  if (w[INSTALL_FLAG]) return;
  w[INSTALL_FLAG] = true;
  document.addEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownPumpfunPrefetch);

  stopWaitingForArm = whenProofArmed(() => {
    scheduleAttempts(0);
  });
}

function teardownPumpfunPrefetch(): void {
  aborted = true;
  stopWaitingForArm?.();
  stopWaitingForArm = undefined;
  if (attemptTimer !== undefined) window.clearTimeout(attemptTimer);
  attemptTimer = undefined;
  cachedAddress = undefined;
  delete (window as PrefetchWindow)[INSTALL_FLAG];
  document.removeEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardownPumpfunPrefetch);
}
