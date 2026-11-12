export const PREFETCH_DIAGNOSTICS_STORAGE_KEY = 'kaito.xPrefetchDiagnostics';

export type PrefetchDiagnostics = {
  auth?: boolean;
  tid?: boolean;
  csrf?: boolean;
  qid?: 'bundle' | 'pinned';
  bearer?: 'page' | 'public';
  bundles?: number;
  at?: number;
  results?: PrefetchResult[];
  skip?: string;
};

export type PrefetchResult = {
  status: number | 'pending' | 'network_error';
  at: number;
  xerr?: string;
  // Response wire size (Content-Length) in bytes, when the server reports it. This
  // is the proxy for zkTLS proof cost: the attestor proves the TLS record bytes, so
  // a 00014/slow proof on a large `accountOverviewDailyQuery` response is told apart
  // from one on a small response (size vs. network, in the proof_outcome diagnostics).
  bytes?: number;
};

export const PREFETCH_RESULTS_KEPT = 3;

function clip(value: unknown, max: number): string {
  let text: string;
  try {
    text = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  } catch {
    text = '';
  }
  return text.replace(/[\p{Cc}{}|,]+/gu, ' ').slice(0, max);
}

const PREFETCH_OPERATIONS_BY_VERIFIER: Record<string, readonly string[]> = {
  x_analytics_overview: ['Viewer', 'accountOverviewDailyQuery'],
  x_creator_rewards_zktls: ['originalContentRewards'],
  axis_account: ['axisMe'],
};

export function prefetchOperationsFor(verifierId: string): readonly string[] {
  return PREFETCH_OPERATIONS_BY_VERIFIER[verifierId] ?? [];
}

export function formatPrefetchDiagnostics(
  byOperation: unknown,
  since = 0,
  operations?: readonly string[],
): string | undefined {
  if (!byOperation || typeof byOperation !== 'object') return undefined;
  const parts: string[] = [];
  for (const [operation, raw] of Object.entries(byOperation as Record<string, unknown>).slice(
    0,
    4,
  )) {
    if (operations && !operations.includes(operation)) continue;
    if (!raw || typeof raw !== 'object') continue;
    const d = raw as Partial<PrefetchDiagnostics>;
    if (since > 0 && !(typeof d.at === 'number' && d.at >= since)) continue;
    const results = (Array.isArray(d.results) ? d.results : [])
      .slice(-PREFETCH_RESULTS_KEPT)
      .filter(
        (r): r is PrefetchResult =>
          Boolean(r) &&
          typeof r === 'object' &&
          (since === 0 || (typeof r.at === 'number' && r.at >= since)),
      );
    const fields = [
      typeof d.auth === 'boolean' ? `auth=${d.auth ? 1 : 0}` : undefined,
      typeof d.tid === 'boolean' ? `tid=${d.tid ? 1 : 0}` : undefined,
      d.csrf === undefined ? undefined : `ct0=${d.csrf ? 1 : 0}`,
      d.qid ? `qid=${clip(d.qid, 8)}` : undefined,
      d.bearer ? `bearer=${clip(d.bearer, 8)}` : undefined,
      d.bundles === undefined ? undefined : `bundles=${clip(d.bundles, 3)}`,
      `fired=${results.length}`,
      d.skip ? `skip=${clip(d.skip, 24)}` : undefined,
      ...results.map(
        (r) =>
          `status=${clip(r.status, 16)}` +
          `${typeof r.bytes === 'number' ? ` bytes=${clip(r.bytes, 12)}` : ''}` +
          `${r.xerr ? ` xerr=${clip(r.xerr, 80)}` : ''}`,
      ),
    ].filter(Boolean);
    parts.push(`${clip(operation, 32)}{${fields.join(' ')}}`);
  }
  return parts.length > 0 ? `prefetch=${parts.join(',')}` : undefined;
}

export function environmentTag(userAgent: string, extensionVersion: string): string {
  const chrome = /Chrome\/(\d+)/.exec(userAgent)?.[1] ?? '?';
  const platform = /Android/.test(userAgent)
    ? 'android'
    : /iPhone|iPad/.test(userAgent)
      ? 'ios'
      : /Mac OS X/.test(userAgent)
        ? 'mac'
        : /Windows/.test(userAgent)
          ? 'win'
          : /Linux/.test(userAgent)
            ? 'linux'
            : 'other';
  const brand = /Edg\//.test(userAgent)
    ? 'edge'
    : /OPR\//.test(userAgent)
      ? 'opera'
      : /Brave/.test(userAgent)
        ? 'brave'
        : 'chrome';
  return `env=${brand}/${chrome} ${platform} mobile=${/Mobile|Android/.test(userAgent) ? 1 : 0} ext=${clip(extensionVersion, 16)}`;
}

export function recordPagePrefetch(
  operation: string,
  update: (entry: PrefetchDiagnostics) => PrefetchDiagnostics,
): void {
  try {
    const raw: unknown = JSON.parse(
      sessionStorage.getItem(PREFETCH_DIAGNOSTICS_STORAGE_KEY) ?? '{}',
    );
    const all: Record<string, unknown> =
      raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const current = all[operation];
    const entry: PrefetchDiagnostics =
      current && typeof current === 'object' ? (current as PrefetchDiagnostics) : {};
    const next = update({
      ...entry,
      results: Array.isArray(entry.results) ? entry.results : [],
    });
    all[operation] = {
      ...next,
      results: (next.results ?? []).slice(-PREFETCH_RESULTS_KEPT),
      at: Date.now(),
    };
    sessionStorage.setItem(PREFETCH_DIAGNOSTICS_STORAGE_KEY, JSON.stringify(all));
  } catch {}
}
