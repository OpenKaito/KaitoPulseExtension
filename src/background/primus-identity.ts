const IDENTITY_PATH = '/public/pado/identity';
const DEFAULT_RETRY_DELAYS_MS = [1_000, 3_000];
const DETAIL_MAX = 80;

type IdentityResponse = { status?: number; rc?: string; msg?: string; error?: string };

let initialization: Promise<void> | undefined;

async function hasIdentity(): Promise<boolean> {
  const { userInfo } = await chrome.storage.local.get('userInfo');
  if (typeof userInfo !== 'string') return false;
  try {
    const value = JSON.parse(userInfo);
    return Boolean(value?.id && typeof value?.token === 'string' && value.token);
  } catch {
    return false;
  }
}

function requestUrl(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (input && typeof input === 'object' && 'url' in input) return String(input.url);
  return '';
}

function clip(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return String(value).replace(/\s+/g, ' ').slice(0, DETAIL_MAX);
}

async function captureIdentityResponse(
  run: () => Promise<void>,
): Promise<IdentityResponse | undefined> {
  const original = globalThis.fetch;
  if (typeof original !== 'function') {
    await run();
    return undefined;
  }
  let seen: IdentityResponse | undefined;
  const wrapped: typeof fetch = async (input, init) => {
    if (!requestUrl(input).includes(IDENTITY_PATH)) return original(input, init);
    try {
      const response = await original(input, init);
      seen = { status: response.status };
      try {
        const body = JSON.parse(await response.clone().text()) as {
          rc?: unknown;
          msg?: unknown;
          mc?: unknown;
        };
        seen.rc = clip(body?.rc);
        seen.msg = clip(body?.msg ?? body?.mc);
      } catch {
        seen.msg = 'non_json_body';
      }
      return response;
    } catch (error) {
      seen = {
        error: clip(error instanceof Error ? error.name || error.message : error) ?? 'unknown',
      };
      throw error;
    }
  };
  globalThis.fetch = wrapped;
  try {
    await run();
  } finally {
    if (globalThis.fetch === wrapped) globalThis.fetch = original;
  }
  return seen;
}

function describeIdentityResponse(seen: IdentityResponse | undefined): string {
  if (!seen) return 'no_request';
  if (seen.error) return `fetch_error=${seen.error}`;
  return [
    `http=${seen.status}`,
    seen.rc !== undefined ? `rc=${seen.rc}` : '',
    seen.msg ? `msg=${seen.msg}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function delay(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

export function ensurePrimusIdentity(
  options: { retryDelaysMs?: readonly number[] } = {},
): Promise<void> {
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  initialization ??= (async () => {
    if (await hasIdentity()) return;
    const initialize = (
      globalThis as typeof globalThis & {
        __kaitoInitializePrimusIdentity?: () => Promise<void>;
      }
    ).__kaitoInitializePrimusIdentity;
    if (!initialize) throw new Error('primus_identity_initialization_failed: no_initializer');
    let last = '';
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
      if (attempt > 0) await delay(retryDelaysMs[attempt - 1]);
      await chrome.storage.local.remove('userInfo');
      let seen: IdentityResponse | undefined;
      try {
        seen = await captureIdentityResponse(initialize);
      } catch (error) {
        throw new Error(
          `primus_identity_initialization_failed: threw ${error instanceof Error ? error.message : String(error)}`.slice(
            0,
            300,
          ),
        );
      }
      if (await hasIdentity()) return;
      last = describeIdentityResponse(seen);
    }
    throw new Error(
      `primus_identity_initialization_failed: no_identity attempts=${retryDelaysMs.length + 1} last=${last}`.slice(
        0,
        300,
      ),
    );
  })()
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        message.startsWith('primus_identity_initialization_failed')
          ? message
          : `primus_identity_initialization_failed: ${message}`.slice(0, 300),
      );
    })
    .finally(() => {
      initialization = undefined;
    });
  return initialization;
}
