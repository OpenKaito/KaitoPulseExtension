import './debug.css';
import { createSignal, onCleanup, type Component } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import type { ReplyFor, RuntimeRequest } from '@/shared/messages';
import { sendOverKaitoPort } from '@/shared/port-rpc';
import type { BehaviorEvent } from '@/shared/behavior';
import { JsonTree } from './json-tree';
import { DebugLogSection, formatTime } from './debug-log-section';

const REFRESH_INTERVAL_MS = 2_000;

function sendKaitoMessage<R extends RuntimeRequest>(request: R): Promise<ReplyFor<R['action']>> {
  return sendOverKaitoPort<ReplyFor<R['action']>>(request, {
    disconnectMessage: 'behavior debug request disconnected',
    disconnectAfterResponse: true,
  });
}

function haystackFor(entry: BehaviorEvent): string {
  return [entry.kind, entry.actor.handle, entry.actor.twitterId, JSON.stringify(entry.payload)]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase();
}

const BehaviorEntryRow: Component<{ entry: BehaviorEvent }> = (props) => (
  <details class="debug-entry">
    <summary>
      <span class="debug-method">{props.entry.kind}</span>
      <span class="debug-url">{formatTime(props.entry.ts)} · {props.entry.surface}</span>
    </summary>
    <div class="debug-meta">
      <span>actor: {props.entry.actor.handle ?? props.entry.actor.twitterId ?? 'unknown'}</span>
    </div>
    <div class="debug-payloads">
      <div>
        <p class="debug-payload-title">Payload</p>
        <JsonTree value={props.entry.payload} rebuildKey={props.entry.id} />
      </div>
    </div>
  </details>
);

export const BehaviorDebugSection: Component = () => {
  let disposed = false;
  const [entries, setEntries] = createStore<BehaviorEvent[]>([]);
  const [status, setStatus] = createSignal('');
  const [filter, setFilter] = createSignal('');

  const visibleEntries = (): BehaviorEvent[] => {
    const q = filter().trim().toLowerCase();
    return q ? entries.filter((entry) => haystackFor(entry).includes(q)) : entries;
  };

  const load = async (): Promise<void> => {
    try {
      const snapshot = await sendKaitoMessage({
        target: 'kaitoExtension',
        action: 'getBehaviorEvents',
      });
      if (disposed) return;
      setEntries(reconcile(snapshot.entries, { key: 'id' }));
      const n = snapshot.entries.length;
      setStatus(`Last updated ${formatTime(Date.now())} · ${n} event${n === 1 ? '' : 's'} logged`);
    } catch (error) {
      if (disposed) return;
      setStatus((error as Error)?.message || 'Failed to load behavior events.');
    }
  };

  const clear = (): void => {
    void sendKaitoMessage({
      target: 'kaitoExtension',
      action: 'clearBehaviorEvents',
    })
      .then((snapshot) => {
        if (disposed) return;
        setEntries(reconcile(snapshot.entries, { key: 'id' }));
        setStatus(`Cleared at ${formatTime(Date.now())}.`);
      })
      .catch((error) => {
        if (disposed) return;
        setStatus((error as Error)?.message || 'Failed to clear behavior events.');
      });
  };

  const exportJson = (): void => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kaito-behavior-events-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  void load();
  const interval = window.setInterval(() => { void load(); }, REFRESH_INTERVAL_MS);
  onCleanup(() => {
    disposed = true;
    window.clearInterval(interval);
  });

  return (
    <DebugLogSection
      title="Behavior events"
      subtitle="Local-only capture log from the current background worker."
      actions={[
        { label: 'Refresh', onClick: () => void load() },
        { label: 'Export JSON', onClick: exportJson },
        { label: 'Clear', onClick: clear },
      ]}
      filterPlaceholder="Filter by kind / handle / twitter_id / text"
      filter={filter}
      onFilterInput={(value) => setFilter(value)}
      status={status}
      recordedNoun="behavior events"
      matchNoun="events"
      totalCount={() => entries.length}
      visibleEntries={visibleEntries}
      renderRow={(entry) => <BehaviorEntryRow entry={entry} />}
    />
  );
};
