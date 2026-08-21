import { For, Show, type Component } from 'solid-js';

export const StatCard: Component<{ label: string; value: string; loading?: boolean }> = (props) => (
  <div class="pv-card">
    <p class="pv-card__label">{props.label}</p>
    <Show when={!props.loading} fallback={<span class="rf-sk pv-sk--card-value" aria-hidden="true" />}>
      <p class="pv-card__value">{props.value}</p>
    </Show>
  </div>
);

export const StatCardGrid: Component<{
  items: { label: string; value: string }[];
  loading?: boolean;
}> = (props) => {
  const rows = () => {
    const out: { label: string; value: string }[][] = [];
    for (let i = 0; i < props.items.length; i += 2) out.push(props.items.slice(i, i + 2));
    return out;
  };
  return (
    <div class="pv-cards">
      <For each={rows()}>
        {(row) => (
          <div class="pv-cards__row">
            <For each={row}>
              {(item) => <StatCard label={item.label} value={item.value} loading={props.loading} />}
            </For>
          </div>
        )}
      </For>
    </div>
  );
};
