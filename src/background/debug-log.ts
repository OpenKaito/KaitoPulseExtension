import type { DebugRequestEntry, DebugRequestSnapshot, DebugRequestSource } from '@/shared/debug';

const MAX_ENTRIES = 100;
const MAX_SERIALIZED_CHARS = 200_000;

const entries: DebugRequestEntry[] = [];

function createId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function snapshotValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  try {
    const json = JSON.stringify(value);
    if (json.length > MAX_SERIALIZED_CHARS) {
      return {
        truncated: true,
        chars: json.length,
        preview: json.slice(0, MAX_SERIALIZED_CHARS),
      };
    }
    return JSON.parse(json) as unknown;
  } catch {
    return String(value);
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
    url: input.url,
    path: input.path,
    startedAt: Date.now(),
    requestBody: snapshotValue(input.requestBody),
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
  if (result.responseBody !== undefined) entry.responseBody = snapshotValue(result.responseBody);
  if (result.error !== undefined) entry.error = result.error;
}

export function getDebugRequestSnapshot(): DebugRequestSnapshot {
  return { entries: entries.slice().reverse() };
}

export function clearDebugRequests(): DebugRequestSnapshot {
  entries.length = 0;
  return getDebugRequestSnapshot();
}
