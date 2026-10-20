import type { DebugRequestEntry, DebugRequestSnapshot, DebugRequestSource } from '@/shared/debug';

const MAX_ENTRIES = 100;
const MAX_SERIALIZED_CHARS = 200_000;

const entries: DebugRequestEntry[] = [];
const SENSITIVE_KEY =
  /token|authorization|cookie|password|secret|privatekey|attestation|fingerprint|^(fp|signature|signatures|behaviorEvents|serveEvents)$/i;
const PRIVATE_ENDPOINT = /\/extension\/(sessions|sign|proof|proofs|attention)(\/|$)/;

function sanitizeText(value: string): string {
  return value.replace(/Bearer\s+[^\s"',}]+/gi, 'Bearer [redacted]');
}

function sanitizeUrl(value: string): string {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_KEY.test(key)) url.searchParams.set(key, '[redacted]');
    }
    url.username = '';
    url.password = '';
    url.hash = '';
    return url.toString();
  } catch {
    return '[invalid URL]';
  }
}

function createId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function snapshotValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  try {
    const json = JSON.stringify(value, (key, item: unknown) => {
      if (SENSITIVE_KEY.test(key)) return '[redacted]';
      return typeof item === 'string' ? sanitizeText(item) : item;
    });
    if (json.length > MAX_SERIALIZED_CHARS) {
      return {
        truncated: true,
        chars: json.length,
        preview: json.slice(0, MAX_SERIALIZED_CHARS),
      };
    }
    return JSON.parse(json) as unknown;
  } catch {
    return '[unserializable]';
  }
}

function trimEntries(): void {
  while (entries.length > MAX_ENTRIES) entries.shift();
}

export function startDebugRequest(input: {
  source: DebugRequestSource;
  method: string;
  url: string;
  path?: string;
  requestBody?: unknown;
}): string {
  const id = createId();
  entries.push({
    id,
    source: input.source,
    method: input.method.toUpperCase(),
    url: sanitizeUrl(input.url),
    path: input.path?.split('?')[0],
    startedAt: Date.now(),
    requestBody: PRIVATE_ENDPOINT.test(input.path ?? input.url)
      ? undefined
      : snapshotValue(input.requestBody),
  });
  trimEntries();
  return id;
}

export function finishDebugRequest(
  id: string,
  result: {
    status?: number;
    ok?: boolean;
    responseBody?: unknown;
    error?: string;
  },
): void {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;
  const finishedAt = Date.now();
  entry.finishedAt = finishedAt;
  entry.durationMs = finishedAt - entry.startedAt;
  if (result.status !== undefined) entry.status = result.status;
  if (result.ok !== undefined) entry.ok = result.ok;
  const privateEndpoint = PRIVATE_ENDPOINT.test(entry.path ?? entry.url);
  if (result.responseBody !== undefined && !privateEndpoint) {
    entry.responseBody = snapshotValue(result.responseBody);
  }
  if (result.error !== undefined) {
    entry.error = privateEndpoint
      ? 'Request failed (sensitive details omitted)'
      : sanitizeText(result.error);
  }
}

export function getDebugRequestSnapshot(): DebugRequestSnapshot {
  return { entries: entries.slice().reverse() };
}

export function clearDebugRequests(): DebugRequestSnapshot {
  entries.length = 0;
  return getDebugRequestSnapshot();
}
