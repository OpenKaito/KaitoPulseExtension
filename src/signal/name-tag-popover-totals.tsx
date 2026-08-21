import type { JSX } from "solid-js";
import { For, Show } from "solid-js";
import type { PopoverTotals } from "./types";
import { AccountSizeDots } from "@/shared/AccountSizeDots";
import { buildPlatformCluster } from "@/shared/platform-cluster";
import { triangle } from "./shared/icons";
import { TOTAL_ACCOUNT_VALUE_LABEL, TOTAL_ALL_TIME_PNL_LABEL } from "./shared/stat-labels";

const MAX_MARKS = 5;

function TotalPlatformIcons(props: { platforms: string[] }): JSX.Element {
  const cluster = () => buildPlatformCluster(props.platforms, MAX_MARKS);
  return (
    <Show when={cluster().icons.length > 0}>
      <div class="signal-popover__total-marks" aria-hidden="true">
        <For each={cluster().icons}>{(icon) => <img src={icon.src} alt="" />}</For>
        <Show when={cluster().overflow > 0}>
          <span class="signal-popover__total-more">+{cluster().overflow}</span>
        </Show>
      </div>
    </Show>
  );
}

export function PopoverTotalsRow(props: { totals: PopoverTotals }): JSX.Element {
  const direction = () => props.totals.allTimePnlDirection;

  const arrow = () =>
    direction() === "loss" ? ("down" as const) : direction() === "gain" ? ("up" as const) : undefined;
  return (
    <div class="signal-popover__totals">
      <div class="signal-popover__total">
        <div class="signal-popover__total-head">
          <div class="signal-popover__total-label">{TOTAL_ACCOUNT_VALUE_LABEL}</div>
          <TotalPlatformIcons platforms={props.totals.accountValuePlatforms} />
        </div>
        <div class="signal-popover__total-figure">
          <Show when={props.totals.accountSizeTier}>
            {(tier) => <AccountSizeDots tier={tier()} size={16} />}
          </Show>
          <div class="signal-popover__total-value signal-popover__num">{props.totals.accountSizeLabel}</div>
        </div>
      </div>
      <div class="signal-popover__total">
        <div class="signal-popover__total-head">
          <div class="signal-popover__total-label">{TOTAL_ALL_TIME_PNL_LABEL}</div>
          <TotalPlatformIcons platforms={props.totals.allTimePnlPlatforms} />
        </div>
        <div class="signal-popover__total-figure">
          {}
          <Show when={arrow()} keyed>
            {(dir) => triangle(dir)}
          </Show>
          <div
            class="signal-popover__total-value signal-popover__num"
            classList={{
              "signal-popover__total-value--gain": direction() === "gain",
              "signal-popover__total-value--loss": direction() === "loss",
            }}
          >
            {props.totals.allTimePnl}
          </div>
        </div>
      </div>
    </div>
  );
}
