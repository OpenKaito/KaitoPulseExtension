import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';
import type { PopoverTotals, ReferralTotalFigure } from './types';
import { AccountSizeDots } from '@/shared/AccountSizeDots';
import { buildPlatformCluster } from '@/shared/platform-cluster';
import { triangle } from './shared/icons';
import {
  TOTAL_ACCOUNT_VALUE_LABEL,
  TOTAL_ALL_TIME_PNL_LABEL,
  TOTAL_REFERRAL_VOLUME_LABEL,
} from './shared/stat-labels';

function TotalPlatformIcons(props: { platforms: string[] }): JSX.Element {
  const cluster = () => buildPlatformCluster(props.platforms);
  return (
    <Show when={cluster().icons.length > 0}>
      <div class="signal-popover__total-marks" aria-hidden="true">
        <Show
          when={cluster().collapsed}
          fallback={
            <For each={cluster().icons}>
              {(icon) => <img src={icon.src} data-platform={icon.platform} alt="" />}
            </For>
          }
        >
          <span class="signal-popover__total-more">{cluster().icons.length}</span>
          <span class="signal-popover__total-tip">
            <For each={cluster().icons}>
              {(icon) => <img src={icon.src} data-platform={icon.platform} alt="" />}
            </For>
          </span>
        </Show>
      </div>
    </Show>
  );
}

function ReferralTotalTile(props: { label: string; figure: ReferralTotalFigure }): JSX.Element {
  return (
    <div class="signal-popover__total">
      <div class="signal-popover__total-head">
        <div class="signal-popover__total-label">{props.label}</div>
        <TotalPlatformIcons platforms={props.figure.platforms} />
      </div>
      <div class="signal-popover__total-figure">
        <div class="signal-popover__total-value signal-popover__num">{props.figure.text}</div>
      </div>
    </div>
  );
}

export function PopoverTotalsRow(props: {
  totals?: PopoverTotals;
  referredVolume?: ReferralTotalFigure;
}): JSX.Element {
  const direction = () => props.totals?.allTimePnl?.direction;

  const arrow = () =>
    direction() === 'loss'
      ? ('down' as const)
      : direction() === 'gain'
        ? ('up' as const)
        : undefined;
  return (
    <div class="signal-popover__totals">
      <Show when={props.totals?.accountValue}>
        {(accountValue) => (
          <div class="signal-popover__total">
            <div class="signal-popover__total-head">
              <div class="signal-popover__total-label">{TOTAL_ACCOUNT_VALUE_LABEL}</div>
              <TotalPlatformIcons platforms={accountValue().platforms} />
            </div>
            <div class="signal-popover__total-figure">
              <AccountSizeDots tier={accountValue().tier} size={16} />
              <div class="signal-popover__total-value signal-popover__num">
                {accountValue().label}
              </div>
            </div>
          </div>
        )}
      </Show>
      <Show when={props.totals?.allTimePnl}>
        {(allTimePnl) => (
          <div class="signal-popover__total">
            <div class="signal-popover__total-head">
              <div class="signal-popover__total-label">{TOTAL_ALL_TIME_PNL_LABEL}</div>
              <TotalPlatformIcons platforms={allTimePnl().platforms} />
            </div>
            <div class="signal-popover__total-figure">
              {}
              <Show when={arrow()} keyed>
                {(dir) => triangle(dir)}
              </Show>
              <div
                class="signal-popover__total-value signal-popover__num"
                classList={{
                  'signal-popover__total-value--gain': direction() === 'gain',
                  'signal-popover__total-value--loss': direction() === 'loss',
                }}
              >
                {allTimePnl().text}
              </div>
            </div>
          </div>
        )}
      </Show>
      <Show when={props.referredVolume}>
        {(figure) => <ReferralTotalTile label={TOTAL_REFERRAL_VOLUME_LABEL} figure={figure()} />}
      </Show>
    </div>
  );
}
