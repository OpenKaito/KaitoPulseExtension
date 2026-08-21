
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

const VIEWER_FIELD_TOGGLES = { isDelegate: false, withPayments: false, withAuxiliaryUserLabels: false } as const;
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
    buildParams: () => new URLSearchParams({ variables: JSON.stringify(accountOverviewVariables()) }),
  },
};

export function isSupportedPrefetchOperation(operation: string): boolean {
  return Object.hasOwn(OPERATIONS, operation);
}

const PREFETCH_COOLDOWN_MS = 45_000;

const FIRST_PREFETCH_DELAY_MS = 2_000;

const FORCED_AUTH_WAIT_MS = 8_000;
const FORCED_AUTH_POLL_MS = 250;

type CapturedAuth = { authorization: string; transactionId?: string };

let captured: CapturedAuth | undefined;
const resolvedQueryIds = new Map<string, string>();
const lastFiredAt = new Map<string, number>();
const pending = new Set<string>();

function lowerKeys(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) out[key.toLowerCase()] = value;
  return out;
}

export function captureGraphqlAuth(headers: Record<string, string>): void {
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

async function resolveQueryId(operation: XGraphqlOperation): Promise<string> {
  const cached = resolvedQueryIds.get(operation.name);
  if (cached) return cached;

  const bundles = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'))
    .map((script) => script.src)
    .filter((src) => /abs\.twimg\.com\/responsive-web\/.*\/(main|bundle)\.[0-9a-f]+\.js$/.test(src));

  const needle = new RegExp(`queryId:"([A-Za-z0-9_-]+)",operationName:"${operation.name}"`);
  for (const src of bundles) {
    try {
      const text = await (await fetch(src)).text();
      const match = needle.exec(text);
      if (match) {
        resolvedQueryIds.set(operation.name, match[1]);
        return match[1];
      }
    } catch {

    }
  }

  resolvedQueryIds.set(operation.name, operation.pinnedQueryId);
  return operation.pinnedQueryId;
}

async function fire(operation: XGraphqlOperation): Promise<void> {
  const auth = captured;
  const csrf = readCookie('ct0');
  if (!auth || !csrf) return;

  const queryId = await resolveQueryId(operation);
  const url = `https://${operation.host}${operation.basePath}/${queryId}/${operation.name}?${operation.buildParams().toString()}`;
  const headers: Record<string, string> = {
    authorization: auth.authorization,
    'x-csrf-token': csrf,
    'x-twitter-auth-type': 'OAuth2Session',
    'x-twitter-active-user': 'yes',
    'x-twitter-client-language': 'en',
  };
  if (auth.transactionId) headers['x-client-transaction-id'] = auth.transactionId;

  await fetch(url, {

    credentials: 'include',

    cache: 'no-store',
    headers,
  });
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
      .catch(() => {

      })
      .finally(() => {
        pending.delete(operationName);
      });
  }, delay);
}

export function forceGraphqlPrefetch(operationName: string): void {
  const operation = OPERATIONS[operationName];
  if (!operation) return;
  void (async () => {
    try {
      const deadline = Date.now() + FORCED_AUTH_WAIT_MS;
      while (!hasCredentialsFor(operation) && Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, FORCED_AUTH_POLL_MS));
      }
      if (!hasCredentialsFor(operation)) return;
      lastFiredAt.set(operationName, Date.now());
      await fire(operation);
    } catch {

    }
  })();
}

export function resetGraphqlPrefetchStateForTest(): void {
  captured = undefined;
  resolvedQueryIds.clear();
  lastFiredAt.clear();
  pending.clear();
}
