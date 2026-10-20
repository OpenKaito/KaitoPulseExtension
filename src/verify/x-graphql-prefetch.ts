import {
  PREFETCH_DIAGNOSTICS_STORAGE_KEY,
  PREFETCH_RESULTS_KEPT,
  type PrefetchDiagnostics,
  type PrefetchResult,
} from './x-graphql-prefetch-diagnostics';

const DAY_MS = 86_400_000;

type XGraphqlOperation = {
  name: string;

  host: 'x.com' | 'api.x.com';

  basePath: string;

  pinnedQueryId: string;

  requiresTransactionId: boolean;
  buildParams: () => URLSearchParams;
};

const VIEWER_FEATURES = {
  subscriptions_upsells_api_enabled: true,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: true,
  rweb_tipjar_consumption_enabled: false,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
} as const;

const VIEWER_FIELD_TOGGLES = {
  isDelegate: false,
  withPayments: false,
  withAuxiliaryUserLabels: false,
} as const;
const VIEWER_VARIABLES = { withCommunitiesMemberships: true } as const;

function accountOverviewVariables(): Record<string, unknown> {
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);
  const to = midnight.getTime() + DAY_MS;
  const from = to - 7 * DAY_MS;
  const iso = (ms: number) => new Date(ms).toISOString();
  return {
    current_from: from,
    current_from_iso: iso(from),
    current_to: to,
    current_to_iso: iso(to),
    prev_from: from - 7 * DAY_MS,
    prev_from_iso: iso(from - 7 * DAY_MS),
    prev_to: from,
    prev_to_iso: iso(from),
    backfill_from: to - 2 * DAY_MS,
    backfill_to: to,
    show_verified_followers: true,
  };
}

const OPERATIONS: Record<string, XGraphqlOperation> = {
  Viewer: {
    name: 'Viewer',
    host: 'api.x.com',
    basePath: '/graphql',
    pinnedQueryId: '5XShkXk2oO2J7SYmTu6pvw',
    requiresTransactionId: true,
    buildParams: () =>
      new URLSearchParams({
        variables: JSON.stringify(VIEWER_VARIABLES),
        features: JSON.stringify(VIEWER_FEATURES),
        fieldToggles: JSON.stringify(VIEWER_FIELD_TOGGLES),
      }),
  },

  accountOverviewDailyQuery: {
    name: 'accountOverviewDailyQuery',
    host: 'x.com',
    basePath: '/i/api/graphql',
    pinnedQueryId: '_P1caq0YB4SVuEtFLPDMfQ',
    requiresTransactionId: false,
    buildParams: () =>
      new URLSearchParams({ variables: JSON.stringify(accountOverviewVariables()) }),
  },
};

export function isSupportedPrefetchOperation(operation: string): boolean {
  return Object.hasOwn(OPERATIONS, operation);
}

const PREFETCH_COOLDOWN_MS = 45_000;

const FIRST_PREFETCH_DELAY_MS = 2_000;

const FORCED_AUTH_WAIT_MS = 8_000;
const PUBLIC_BEARER_FALLBACK_WAIT_MS = 2_000;
const X_WEB_PUBLIC_BEARER =
  'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
const FORCED_AUTH_POLL_MS = 250;

type CapturedAuth = { authorization: string; transactionId?: string };

let captured: CapturedAuth | undefined;
const resolvedQueryIds = new Map<
  string,
  { id: string; source: 'bundle' | 'pinned'; bundles: number }
>();
const lastFiredAt = new Map<string, number>();
const pending = new Set<string>();
const diagnostics = new Map<string, PrefetchDiagnostics>();
const attempts = new Map<string, number>();

function persistDiagnostics(): void {
  try {
    sessionStorage.setItem(
      PREFETCH_DIAGNOSTICS_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(diagnostics)),
    );
  } catch {}
}

function noteDiagnostics(
  operationName: string,
  patch: Partial<PrefetchDiagnostics>,
  attempt?: number,
): void {
  if (attempt !== undefined && attempt !== (attempts.get(operationName) ?? 0)) return;
  try {
    const current = diagnostics.get(operationName) ?? {};
    diagnostics.set(operationName, {
      ...current,
      auth: Boolean(captured),
      tid: Boolean(captured?.transactionId),
      ...patch,
      at: Date.now(),
    });
    persistDiagnostics();
  } catch {}
}

function recordResult(operationName: string, result: PrefetchResult): void {
  const previous = diagnostics.get(operationName)?.results;
  const results = [...(Array.isArray(previous) ? previous : []), result].slice(
    -PREFETCH_RESULTS_KEPT,
  );
  noteDiagnostics(operationName, { results });
}

export function restorePrefetchDiagnostics(): void {
  try {
    const stored: unknown = JSON.parse(
      sessionStorage.getItem(PREFETCH_DIAGNOSTICS_STORAGE_KEY) ?? '{}',
    );
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return;
    for (const [operation, value] of Object.entries(stored)) {
      if (!Object.hasOwn(OPERATIONS, operation) || diagnostics.has(operation)) continue;
      if (!value || typeof value !== 'object') continue;
      const entry = value as Partial<PrefetchDiagnostics>;
      diagnostics.set(operation, {
        auth: Boolean(entry.auth),
        tid: Boolean(entry.tid),
        at: typeof entry.at === 'number' ? entry.at : undefined,
        csrf: typeof entry.csrf === 'boolean' ? entry.csrf : undefined,
        qid: entry.qid === 'bundle' || entry.qid === 'pinned' ? entry.qid : undefined,
        bearer: entry.bearer === 'page' || entry.bearer === 'public' ? entry.bearer : undefined,
        bundles: typeof entry.bundles === 'number' ? entry.bundles : undefined,
        skip: typeof entry.skip === 'string' ? entry.skip : undefined,
        results: Array.isArray(entry.results)
          ? entry.results.filter(
              (r): r is PrefetchResult =>
                Boolean(r) && typeof r === 'object' && typeof r.at === 'number',
            )
          : [],
      });
    }
  } catch {}
}

function lowerKeys(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) out[key.toLowerCase()] = value;
  return out;
}

let firingOwnRequest = false;

export function captureGraphqlAuth(headers: Record<string, string>): void {
  if (firingOwnRequest) return;
  const lower = lowerKeys(headers);
  const authorization = lower['authorization'];
  if (!authorization) return;
  const transactionId = lower['x-client-transaction-id'] ?? captured?.transactionId;
  captured = { authorization, transactionId };
}

export function hasCapturedGraphqlAuth(): boolean {
  return captured !== undefined;
}

function hasCredentialsFor(operation: XGraphqlOperation): boolean {
  if (!captured) return false;
  return operation.requiresTransactionId ? Boolean(captured.transactionId) : true;
}

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  return document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length);
}

async function resolveQueryId(operation: XGraphqlOperation, attempt: number): Promise<string> {
  const cached = resolvedQueryIds.get(operation.name);
  if (cached) {
    noteDiagnostics(operation.name, { qid: cached.source, bundles: cached.bundles }, attempt);
    return cached.id;
  }

  const bundles = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'))
    .map((script) => script.src)
    .filter((src) =>
      /abs\.twimg\.com\/responsive-web\/.*\/(main|bundle)\.[0-9a-f]+\.js$/.test(src),
    );

  const needle = new RegExp(`queryId:"([A-Za-z0-9_-]+)",operationName:"${operation.name}"`);
  let resolved: { id: string; source: 'bundle' | 'pinned'; bundles: number } = {
    id: operation.pinnedQueryId,
    source: 'pinned',
    bundles: bundles.length,
  };
  for (const src of bundles) {
    try {
      const text = await (await fetch(src)).text();
      const match = needle.exec(text);
      if (match) {
        resolved = { id: match[1], source: 'bundle', bundles: bundles.length };
        break;
      }
    } catch {}
  }

  if (resolved.source === 'bundle') resolvedQueryIds.set(operation.name, resolved);
  noteDiagnostics(operation.name, { qid: resolved.source, bundles: resolved.bundles }, attempt);
  return resolved.id;
}

async function fire(
  operation: XGraphqlOperation,
  attempt = attempts.get(operation.name) ?? 0,
  allowPublicBearer = false,
): Promise<void> {
  const auth =
    captured ??
    (allowPublicBearer && !operation.requiresTransactionId
      ? { authorization: X_WEB_PUBLIC_BEARER }
      : undefined);
  noteDiagnostics(
    operation.name,
    { bearer: captured ? 'page' : auth ? 'public' : undefined },
    attempt,
  );
  const csrf = readCookie('ct0');
  noteDiagnostics(operation.name, { csrf: Boolean(csrf) }, attempt);
  if (!auth || !csrf) {
    noteDiagnostics(operation.name, { skip: auth ? 'no_csrf' : 'no_auth' }, attempt);
    return;
  }

  const queryId = await resolveQueryId(operation, attempt);
  const url = `https://${operation.host}${operation.basePath}/${queryId}/${operation.name}?${operation.buildParams().toString()}`;
  const headers: Record<string, string> = {
    authorization: auth.authorization,
    'x-csrf-token': csrf,
    'x-twitter-auth-type': 'OAuth2Session',
    'x-twitter-active-user': 'yes',
    'x-twitter-client-language': 'en',
  };
  if (auth.transactionId) headers['x-client-transaction-id'] = auth.transactionId;

  noteDiagnostics(operation.name, { skip: undefined }, attempt);
  const result: PrefetchResult = { status: 'pending', at: Date.now() };
  recordResult(operation.name, result);
  let response: Response;
  try {
    firingOwnRequest = true;
    let pendingResponse: Promise<Response>;
    try {
      pendingResponse = fetch(url, {
        credentials: 'include',

        cache: 'no-store',
        headers,
      });
    } finally {
      firingOwnRequest = false;
    }
    response = await pendingResponse;
  } catch (error) {
    result.status = 'network_error';
    noteDiagnostics(operation.name, {});
    throw error;
  }
  result.status = response.status;
  noteDiagnostics(operation.name, {});
  void response
    .clone()
    .json()
    .then((body: { errors?: { message?: unknown }[] }) => {
      const message = body?.errors?.[0]?.message;
      if (typeof message !== 'string') return;
      result.xerr = message;
      noteDiagnostics(operation.name, {});
    })
    .catch(() => undefined);
}

export function armGraphqlPrefetch(operationName: string): void {
  const operation = OPERATIONS[operationName];
  if (!operation) return;
  if (pending.has(operationName)) return;
  if (!hasCredentialsFor(operation)) return;

  const last = lastFiredAt.get(operationName) ?? 0;
  if (last !== 0 && Date.now() - last < PREFETCH_COOLDOWN_MS) return;

  pending.add(operationName);
  const delay = last === 0 ? FIRST_PREFETCH_DELAY_MS : 0;
  window.setTimeout(() => {
    lastFiredAt.set(operationName, Date.now());
    void fire(operation)
      .catch(() => {})
      .finally(() => {
        pending.delete(operationName);
      });
  }, delay);
}

export function forceGraphqlPrefetch(operationName: string): void {
  const operation = OPERATIONS[operationName];
  if (!operation) return;
  const attempt = (attempts.get(operationName) ?? 0) + 1;
  attempts.set(operationName, attempt);
  noteDiagnostics(operationName, { skip: 'waiting_for_auth' }, attempt);
  void (async () => {
    try {
      const canUsePublicBearer = !operation.requiresTransactionId;
      const deadline =
        Date.now() + (canUsePublicBearer ? PUBLIC_BEARER_FALLBACK_WAIT_MS : FORCED_AUTH_WAIT_MS);
      while (!hasCredentialsFor(operation) && Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, FORCED_AUTH_POLL_MS));
      }
      if (!hasCredentialsFor(operation) && !canUsePublicBearer) {
        noteDiagnostics(operationName, { skip: 'no_auth_after_wait' }, attempt);
        return;
      }
      lastFiredAt.set(operationName, Date.now());
      await fire(operation, attempt, canUsePublicBearer);
    } catch {}
  })();
}

export function resetGraphqlPrefetchStateForTest(): void {
  captured = undefined;
  resolvedQueryIds.clear();
  lastFiredAt.clear();
  pending.clear();
  diagnostics.clear();
  attempts.clear();
}
