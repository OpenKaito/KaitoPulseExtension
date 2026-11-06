export type CaptureHit = { status?: number; error?: string; at: number };

const HITS_KEPT_PER_TARGET = 12;
const TARGETS_REPORTED = 12;

export type CaptureTrace = {
  record(url: string, hit: CaptureHit): void;
  openWindow(at: number): void;
  describe(): string;
  outcomes(): CapturedTarget[];
};

export function createCaptureTrace(
  targets: readonly string[],
  matches: (url: string, target: string) => boolean,
): CaptureTrace {
  const hits: CaptureHit[][] = targets.map(() => []);
  let windowOpenedAt: number | undefined;
  return {
    record(url, hit) {
      targets.forEach((target, index) => {
        if (!matches(url, target)) return;
        const list = hits[index];
        if (list.length >= HITS_KEPT_PER_TARGET) list.shift();
        list.push(hit);
      });
    },
    openWindow(at) {
      windowOpenedAt ??= at;
    },
    outcomes() {
      return hits.map((list, index) => ({
        label: targetLabel(targets[index]),
        outcomes: list
          .filter((hit) => windowOpenedAt === undefined || hit.at >= windowOpenedAt)
          .map(outcome),
      }));
    },
    describe() {
      return formatCaptureTrace(
        hits.slice(0, TARGETS_REPORTED),
        windowOpenedAt,
        targets.slice(0, TARGETS_REPORTED).map(targetLabel),
      );
    },
  };
}

function outcome(hit: CaptureHit): string {
  if (hit.error)
    return hit.error
      .replace(/^net::/, '')
      .replace(/[^\w.-]/g, '')
      .slice(0, 32);
  return typeof hit.status === 'number' ? String(hit.status) : '?';
}

function tally(hits: readonly CaptureHit[]): string {
  const counts = new Map<string, number>();
  for (const hit of hits) counts.set(outcome(hit), (counts.get(outcome(hit)) ?? 0) + 1);
  return [...counts].map(([key, n]) => (n > 1 ? `${key}x${n}` : key)).join('/');
}

export function targetLabel(expression: string): string {
  const path = expression
    .replace(/^\^?https?:(?:\\\/|\/){2}[^/\\]+(?:\\\/|\/)/, '')
    .replace(/\\(.)/g, '$1')
    .split(/[?([{$*+|]/)[0];
  return path.split('/').filter(Boolean).slice(-2).join('/').slice(0, 40) || '?';
}

export function formatCaptureTrace(
  hits: readonly (readonly CaptureHit[])[],
  windowOpenedAt?: number,
  labels: readonly string[] = [],
): string {
  const parts = hits.map((list, at) => {
    const index = labels[at] ? `${at}[${labels[at]}]` : String(at);
    if (list.length === 0) return `${index}:none`;
    const before =
      windowOpenedAt === undefined ? [] : list.filter((hit) => hit.at < windowOpenedAt);
    const after =
      windowOpenedAt === undefined ? list : list.filter((hit) => hit.at >= windowOpenedAt);
    const main = after.length > 0 ? tally(after) : 'none';
    return before.length > 0 ? `${index}:${main}(pre ${tally(before)})` : `${index}:${main}`;
  });
  const window = windowOpenedAt === undefined ? ' window=never' : '';
  return `capture=${parts.join(',')}${window}`;
}

export function joinForFallback(prefix: string, message: string, limit: number): string {
  if (!prefix) return message.slice(0, limit);
  if (prefix.length >= limit) return prefix.slice(0, limit);
  return `${prefix} | ${message}`.slice(0, limit);
}

export const TARGET_CHECK_DEBUG_KEY = 'kaitoTargetCheckDebug';

export type TargetCheck = {
  outcome: string;
  missing?: string[];
  found?: string;
  keys?: string;
  n?: number;
  at?: number;
};

export type TargetCheckRecord = { at?: number; targets?: Record<string, TargetCheck> };

export type CapturedTarget = { label: string; outcomes: string[] };

const CHECKS_REPORTED = 8;

function clean(value: string, max: number): string {
  return value.replace(/[\s|,]/g, '_').slice(0, max);
}

function checksSince(record: unknown, since: number): [string, TargetCheck][] {
  const targets = (record as TargetCheckRecord | undefined)?.targets;
  if (!targets || typeof targets !== 'object') return [];
  return Object.entries(targets).filter(
    ([, check]) => check && typeof check.outcome === 'string' && (check.at ?? 0) >= since,
  );
}

export function formatTargetCheck(record: unknown, since = 0): string | undefined {
  const entries = checksSince(record, since).slice(0, CHECKS_REPORTED);
  if (entries.length === 0) return undefined;
  const parts = entries.map(([url, check]) => {
    let part = `${clean(targetLabel(url), 40)}:${clean(check.outcome, 32)}`;
    if (check.n && check.n > 1) part += `x${check.n}`;
    if (check.missing?.length) part += `;missing=${clean(check.missing[0], 80)}`;
    if (check.found) part += `;found=${clean(check.found, 80)}`;
    if (check.keys) part += `;keys=${clean(check.keys, 120)}`;
    return part;
  });
  return `check=${parts.join(',')}`;
}

const LOGIN_OUTCOMES = new Set(['401', '403', 'http401', 'http403']);

export function refineTargetDataMissing(
  verifierId: string,
  captured: readonly CapturedTarget[],
  checks: unknown,
  since = 0,
): 'third_party_login_required' | 'platform_account_not_found' | undefined {
  const outcomesByLabel = new Map<string, string[]>();
  for (const target of captured) {
    if (target.outcomes.length > 0) outcomesByLabel.set(target.label, [...target.outcomes]);
  }
  for (const [url, check] of checksSince(checks, since)) {
    const label = targetLabel(url);
    outcomesByLabel.set(label, [...(outcomesByLabel.get(label) ?? []), check.outcome]);
  }
  const only = (outcomes: string[], allowed: (o: string) => boolean) =>
    outcomes.length > 0 && outcomes.every(allowed);

  if (verifierId === 'lighter_wallet') {
    const account = outcomesByLabel.get('v1/account');
    if (
      account &&
      only(account, (o) => ['400', 'ERR_FAILED', 'http400', 'replay_failed'].includes(o))
    ) {
      return 'platform_account_not_found';
    }
  }
  for (const outcomes of outcomesByLabel.values()) {
    if (only(outcomes, (o) => LOGIN_OUTCOMES.has(o))) return 'third_party_login_required';
  }
  return undefined;
}
