import type { JSX } from "solid-js";

export function TokenChartSkeleton(): JSX.Element {
  return (
    <div class="token-chart-popover__skeleton" aria-hidden="true">
      <div class="token-chart-popover__sk token-chart-popover__sk--chart" />
    </div>
  );
}

export function TokenChartError(props: { onRetry: () => void }): JSX.Element {
  return (
    <div class="token-chart-popover__error">
      <div class="token-chart-popover__error-msg">Couldn't load chart</div>
      <button type="button" class="token-chart-popover__retry" onClick={props.onRetry}>
        Retry
      </button>
    </div>
  );
}
