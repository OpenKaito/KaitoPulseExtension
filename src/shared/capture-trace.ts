export type CaptureHit = { status?: number; error?: string; at: number };

const HITS_KEPT_PER_TARGET = 12;
const TARGETS_REPORTED = 12;

export type CaptureTrace = {
  record(url: string, hit: CaptureHit): void;
  openWindow(at: number): void;
  describe(): string;
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
