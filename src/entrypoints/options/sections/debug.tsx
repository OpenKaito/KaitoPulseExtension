import './debug.css';
import { createSignal, createMemo, onCleanup, For, Show, type Component } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import type { ReplyFor, RuntimeRequest } from '@/shared/messages';
import { sendOverKaitoPort } from '@/shared/port-rpc';
import type { DebugRequestEntry } from '@/shared/debug';
import { JsonTree, isTruncatedSnapshot, formatTruncated } from './json-tree';
import { DebugLogSection, formatTime } from './debug-log-section';

const REFRESH_INTERVAL_MS = 2_000;

function sendKaitoMessage<R extends RuntimeRequest>(request: R): Promise<ReplyFor<R['action']>> {
  return sendOverKaitoPort<ReplyFor<R['action']>>(request, {
    disconnectMessage: 'debug request disconnected',
    disconnectAfterResponse: true,
  });
}

function formatJson(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (isTruncatedSnapshot(value)) return formatTruncated(value);

  const body = value && typeof value === 'object' ? (value as Record<string, unknown>).body : undefined;
  if (isTruncatedSnapshot(body)) {
    const error = (value as Record<string, unknown>).error;
    const header = error !== undefined ? `// error: ${String(error)}\n` : '';
    return header + formatTruncated(body);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function statusText(entry: DebugRequestEntry): string {
  if (entry.ok === undefined) return 'pending';
  if (entry.ok) return entry.status ? `${entry.status}` : 'ok';
  return entry.status ? `${entry.status}` : 'error';
}

function statusClass(entry: DebugRequestEntry): string {
  if (entry.ok === undefined) return 'debug-status debug-status--pending';
  return entry.ok ? 'debug-status debug-status--ok' : 'debug-status debug-status--error';
}

function metaParts(entry: DebugRequestEntry): string[] {

  const parts = [
    `source: ${entry.source}`,
    `time: ${formatTime(entry.startedAt)}`,
  ].filter((part): part is string => Boolean(part));
  if (entry.error) parts.push(`error: ${entry.error}`);
  return parts;
}

function responseValue(entry: DebugRequestEntry): unknown {
  return entry.error ? { error: entry.error, body: entry.responseBody } : entry.responseBody;
}

function entryVersionKey(entry: DebugRequestEntry): string {
  return `${entry.id}:${entry.finishedAt ?? 'pending'}`;
}

const TWITTER_ID_RE = /^\d{1,32}$/;

function asTwitterId(raw: string): string | null {
  const q = raw.trim();
  return TWITTER_ID_RE.test(q) ? q : null;
}

const haystackCache = new Map<string, string>();

function haystackFor(entry: DebugRequestEntry): string {
  const key = entryVersionKey(entry);
  const cached = haystackCache.get(key);
  if (cached !== undefined) return cached;

  if (haystackCache.size > 400) haystackCache.clear();
  const blob = [
    entry.method,
    entry.url,
    entry.path,
    entry.error,
    formatJson(entry.requestBody),
    formatJson(entry.responseBody),
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase();
  haystackCache.set(key, blob);
  return blob;
}

function entryMatches(entry: DebugRequestEntry, needle: string): boolean {
  return haystackFor(entry).includes(needle);
}

type VerdictKind = 'ok' | 'warn' | 'absent' | 'muted';
type Verdict = { kind: VerdictKind; label: string };

function isBadgesEntry(e: DebugRequestEntry): boolean {
  return /\/extension\/badges/.test(e.path ?? '') || /\/extension\/badges/.test(e.url);
}
function isHoverCardEntry(e: DebugRequestEntry): boolean {
  return /\/extension\/hover-card/.test(e.path ?? '') || /\/extension\/hover-card/.test(e.url);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function sfVerdict(entry: DebugRequestEntry, id: string): Verdict | null {
  const body = asRecord(entry.responseBody);
  if (!body) return null;
  if (body.truncated === true) return { kind: 'muted', label: 'response truncated' };

  if (isBadgesEntry(entry)) {
    const items = asRecord(body.items);
    if (!items) return null;
    if (!(id in items)) return { kind: 'absent', label: 'not in this batch' };
    const item = items[id];
    if (item === null) return { kind: 'warn', label: 'no data (item null)' };
    const sf = asRecord(item)?.smartFollowers;
    if (typeof sf === 'number' && Number.isFinite(sf)) {
      return { kind: 'ok', label: `SF ${sf.toLocaleString('en-US')}` };
    }
    return { kind: 'warn', label: 'SF: null → N/A' };
  }

  if (isHoverCardEntry(entry)) {

    if (body.twitterId !== undefined && body.twitterId !== id) return null;
    if (body.smartFollowers === null) return { kind: 'warn', label: 'SF: null' };
    const total = asRecord(body.smartFollowers)?.total;
    if (typeof total === 'number' && Number.isFinite(total)) {
      return { kind: 'ok', label: `SF total ${total.toLocaleString('en-US')}` };
    }
    return null;
  }

  return null;
}

const DebugEntryRow: Component<{
  entry: DebugRequestEntry;
  verdictId: () => string | null;
  isNew: (id: string) => boolean;
  onSeen: (id: string) => void;
}> = (props) => {

  const verdict = createMemo<Verdict | null>(() => {
    const id = props.verdictId();
    return id ? sfVerdict(props.entry, id) : null;
  });
  return (
  <details
    class="debug-entry"

    classList={{ 'debug-entry--new': props.isNew(props.entry.id) }}
    onAnimationEnd={() => props.onSeen(props.entry.id)}
  >
    <summary>
      <span class="debug-method">{props.entry.method}</span>
      <span class="debug-url" title={props.entry.url}>
        {props.entry.path || props.entry.url}
      </span>
      <span class="debug-summary-tail">
        <Show when={verdict()}>
          {(v) => <span class={`debug-verdict debug-verdict--${v().kind}`}>{v().label}</span>}
        </Show>
        <Show when={props.entry.durationMs !== undefined}>
          <span class="debug-duration">{props.entry.durationMs}ms</span>
        </Show>
        <span class={statusClass(props.entry)}>{statusText(props.entry)}</span>
      </span>
    </summary>
    <div class="debug-meta">
      <For each={metaParts(props.entry)}>{(part) => <span>{part}</span>}</For>
    </div>
    <div class="debug-payloads">
      <div>
        <p class="debug-payload-title">Request</p>
        <JsonTree value={props.entry.requestBody} rebuildKey={entryVersionKey(props.entry)} />
      </div>
      <div>
        <p class="debug-payload-title">Response</p>
        <JsonTree value={responseValue(props.entry)} rebuildKey={entryVersionKey(props.entry)} />
      </div>
    </div>
  </details>
  );
};

export const DebugSection: Component = () => {
  let disposed = false;
  const [entries, setEntries] = createStore<DebugRequestEntry[]>([]);
  const [status, setStatus] = createSignal('');
  const [filter, setFilter] = createSignal('');

  const [newIds, setNewIds] = createSignal<Set<string>>(new Set());
  let knownIds: Set<string> | null = null;

  const markSeen = (id: string): void => {
    setNewIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const verdictId = createMemo(() => asTwitterId(filter()));

  const visibleEntries = createMemo<DebugRequestEntry[]>(() => {
    const q = filter().trim().toLowerCase();
    return q ? entries.filter((entry) => entryMatches(entry, q)) : entries;
  });

  const load = async (): Promise<void> => {
    try {
      const snapshot = await sendKaitoMessage({
        target: 'kaitoExtension',
        action: 'getDebugRequests',
      });
      if (disposed) return;

      const incomingIds = new Set(snapshot.entries.map((entry) => entry.id));
      if (knownIds === null) {
        knownIds = incomingIds;
      } else {
        const fresh = snapshot.entries
          .filter((entry) => !knownIds!.has(entry.id))
          .map((entry) => entry.id);
        knownIds = incomingIds;
        if (fresh.length) {
          setNewIds((prev) => {
            const next = new Set<string>();

            for (const id of prev) if (incomingIds.has(id)) next.add(id);
            for (const id of fresh) next.add(id);
            return next;
          });
        }
      }

      setEntries(reconcile(snapshot.entries, { key: 'id' }));
      const n = snapshot.entries.length;
      setStatus(`Last updated ${formatTime(Date.now())} · ${n} request${n === 1 ? '' : 's'} logged`);
    } catch (error) {
      if (disposed) return;
      setStatus((error as Error)?.message || 'Failed to load debug requests.');
    }
  };

  const clear = (): void => {
    void sendKaitoMessage({
      target: 'kaitoExtension',
      action: 'clearDebugRequests',
    })
      .then((snapshot) => {
        if (disposed) return;
        setEntries(reconcile(snapshot.entries, { key: 'id' }));

        knownIds = new Set<string>();
        setNewIds(new Set<string>());
        setStatus(`Cleared at ${formatTime(Date.now())}.`);
      })
      .catch((error) => {
        if (disposed) return;
        setStatus((error as Error)?.message || 'Failed to clear debug requests.');
      });
  };

  void load();
  const interval = window.setInterval(() => { void load(); }, REFRESH_INTERVAL_MS);
  onCleanup(() => {
    disposed = true;
    window.clearInterval(interval);
  });

  return (
    <DebugLogSection
      title="API Requests"
      subtitle="In-memory log from the current background worker."
      actions={[
        { label: 'Refresh', onClick: () => void load() },
        { label: 'Clear', onClick: clear },
      ]}
      filterPlaceholder="Filter by twitter_id / handle / text — a numeric id also shows its /badges SF verdict"
      filter={filter}
      onFilterInput={(value) => setFilter(value)}
      status={status}
      recordedNoun="API requests"
      matchNoun="requests"
      totalCount={() => entries.length}
      visibleEntries={visibleEntries}
      renderRow={(entry) => (
        <DebugEntryRow
          entry={entry}
          verdictId={verdictId}
          isNew={(id) => newIds().has(id)}
          onSeen={markSeen}
        />
      )}
    />
  );
};
