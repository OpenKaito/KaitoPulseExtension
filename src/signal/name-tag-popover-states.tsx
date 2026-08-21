import type { Accessor, JSX } from "solid-js";
import { Show } from "solid-js";
import type { SignalProtocol } from "./types";
import { StickyShadowCard } from "./shared/scroll-shadow";

function SkeletonBar(props: { modifier: string }): JSX.Element {
  return <div class={`signal-popover__sk signal-popover__sk--${props.modifier}`} />;
}

function SkeletonMetric(): JSX.Element {
  return (
    <div class="signal-popover__metric">
      <SkeletonBar modifier="label" />
      <div class="signal-popover__metric-value">
        <SkeletonBar modifier="value" />
      </div>
    </div>
  );
}

function SkeletonChartCard(): JSX.Element {
  return (
    <StickyShadowCard class="signal-popover__card signal-popover__card--hyperliquid">
      <div class="signal-popover__card-top">
        <div class="signal-popover__card-head">
          <div class="signal-popover__addr-row">
            <div class="signal-popover__addr">
              <SkeletonBar modifier="addr" />
            </div>
          </div>
          <div class="signal-popover__brand">
            <SkeletonBar modifier="icon" />
          </div>
        </div>
        <div class="signal-popover__summary">
          <div class="signal-popover__metrics">
            <SkeletonMetric />
            <SkeletonMetric />
          </div>
          <div class="signal-popover__chartgroup signal-popover__chartgroup--wide">
            <div class="signal-popover__pnlrow">
              <SkeletonBar modifier="label" />
            </div>
            <SkeletonBar modifier="value" />
            <SkeletonBar modifier="chart" />
          </div>
        </div>
      </div>
      <div class="signal-popover__footer">
        <SkeletonBar modifier="footer" />
      </div>
    </StickyShadowCard>
  );
}

function SkeletonStatCard(props: { variant: "polymarket" }): JSX.Element {
  return (
    <StickyShadowCard class={`signal-popover__card signal-popover__card--${props.variant}`}>
      <div class="signal-popover__card-top">
        <div class="signal-popover__card-head">
          <div class="signal-popover__profile">
            <SkeletonBar modifier="avatar" />
            <div class="signal-popover__profile-text">
              <div class="signal-popover__profile-namerow">
                <SkeletonBar modifier="name" />
                <SkeletonBar modifier="meta" />
              </div>
              <SkeletonBar modifier="bio" />
            </div>
          </div>
          <div class="signal-popover__brand">
            <SkeletonBar modifier="icon" />
          </div>
        </div>
        <div class="signal-popover__statrow">
          <SkeletonMetric />
          <SkeletonMetric />
          <SkeletonMetric />
        </div>
      </div>
      <div class="signal-popover__footer">
        <SkeletonBar modifier="footer" />
      </div>
    </StickyShadowCard>
  );
}

export function PopoverSkeleton(props: { platforms: Accessor<SignalProtocol[]> }): JSX.Element {
  return (
    <div class="signal-popover__skeleton" aria-hidden="true">
      <Show when={props.platforms().includes("hyperliquid")}>
        <SkeletonChartCard />
      </Show>
      <Show when={props.platforms().includes("polymarket")}>
        <SkeletonStatCard variant="polymarket" />
      </Show>
    </div>
  );
}

export function PopoverError(props: { onRetry: () => void }): JSX.Element {
  return (
    <div class="signal-popover__error">
      <div class="signal-popover__error-msg">Couldn't load data</div>
      <button type="button" class="signal-popover__retry" onClick={props.onRetry}>
        Retry
      </button>
    </div>
  );
}
