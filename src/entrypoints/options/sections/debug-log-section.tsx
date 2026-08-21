import { For, Show, type JSX } from 'solid-js';

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

export type DebugLogAction = { label: string; onClick: () => void };

export function DebugLogSection<T>(props: {
  title: string;
  subtitle: string;
  actions: DebugLogAction[];
  filterPlaceholder: string;
  filter: () => string;
  onFilterInput: (value: string) => void;
  status: () => string;

  recordedNoun: string;

  matchNoun: string;
  totalCount: () => number;
  visibleEntries: () => T[];
  renderRow: (entry: T) => JSX.Element;
}): JSX.Element {
  const visibleCount = () => props.visibleEntries().length;
  const emptyText = (): string =>
    props.totalCount() === 0
      ? `No ${props.recordedNoun} recorded yet.`
      : `No ${props.matchNoun} match “${props.filter().trim()}”.`;

  return (
    <section class="debug-shell">
      <div class="debug-toolbar">
        <div>
          <h2 class="debug-title">{props.title}</h2>
          <div class="debug-muted">{props.subtitle}</div>
        </div>
        <div class="debug-actions">
          <For each={props.actions}>
            {(action) => (
              <button class="debug-button" type="button" onClick={action.onClick}>
                {action.label}
              </button>
            )}
          </For>
        </div>
      </div>
      <input
        class="debug-filter"
        type="search"
        spellcheck={false}
        autocomplete="off"
        placeholder={props.filterPlaceholder}
        value={props.filter()}
        onInput={(e) => props.onFilterInput(e.currentTarget.value)}
      />
      <div class="debug-muted">
        {props.status()}
        <Show when={props.filter().trim()}>
          {' '}· {visibleCount()} / {props.totalCount()} match “{props.filter().trim()}”
        </Show>
      </div>
      <div class="debug-list">
        <Show when={visibleCount() > 0} fallback={<div class="debug-empty">{emptyText()}</div>}>
          <For each={props.visibleEntries()}>{(entry) => props.renderRow(entry)}</For>
        </Show>
      </div>
    </section>
  );
}
