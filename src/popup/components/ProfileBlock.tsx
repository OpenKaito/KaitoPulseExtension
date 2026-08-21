import { Show, type Component, type JSX } from 'solid-js';
import type { AuraProfile } from '../data/types';
import {
  FX_APPROXIMATE_TITLE,
  NO_VALUE,
  approxFigure,
  formatCount,
  formatDelta,
  formatSignedUsd,
  formatSubDollarAccountValue,
  pnlTone,
} from '../format/numbers';
import { AccountSizeDots } from '@/shared/AccountSizeDots';
import { clampTier, formatAccountSize } from '@/shared/account-size';
import { AccountMenu } from './AccountMenu';
import { PlatformIconCluster } from './PlatformIconCluster';

const Bar: Component = () => <span class="rf-sk pv-sk--stat" aria-hidden="true" />;

const Stat: Component<{ label: string; children: JSX.Element }> = (props) => (
  <div class="pv-stat">
    <p class="pv-stat__label">{props.label}</p>
    <div class="pv-stat__value-row">{props.children}</div>
  </div>
);

export const ProfileBlock: Component<{
  profile: AuraProfile;

  platforms?: readonly string[];
  auraLoading?: boolean;
  cardLoading?: boolean;
  tradeLoading?: boolean;
}> = (props) => {
  const delta = () => formatDelta(props.profile.auraDelta);
  const pnl = () => props.profile.allTimePnlUsd;
  const tone = () => pnlTone(pnl());

  const pnlFigure = () => approxFigure(formatSignedUsd(pnl()), props.profile.allTimePnlApproximate);
  const size = () => props.profile.accountSize;

  const subDollar = () =>
    size() == null ? formatSubDollarAccountValue(props.profile.accountValueUsd) : null;

  return (
    <section class="pv-profile">
      <div class="pv-profile__identity">
        <div class="pv-profile__who">
          <Show
            when={props.profile.avatarUrl}
            fallback={<div class="pv-profile__avatar" aria-hidden="true" />}
          >
            {(url) => <img class="pv-profile__avatar" src={url()} alt="" />}
          </Show>
          <div class="pv-profile__names">
            <p class="pv-profile__name">{props.profile.username ?? NO_VALUE}</p>
            <p class="pv-profile__handle">{props.profile.handle ?? ''}</p>
          </div>
        </div>
        <AccountMenu />
      </div>

      <div class="pv-profile__stats">
        <Stat label="Aura">
          <Show when={!props.auraLoading} fallback={<Bar />}>
            <p class="pv-stat__value">{formatCount(props.profile.aura)}</p>
            <Show when={delta()}>{(text) => <span class="pv-stat__delta">{text()}</span>}</Show>
          </Show>
        </Stat>

        <Stat label="Smart Followers">
          <Show when={!props.cardLoading} fallback={<Bar />}>
            <p class="pv-stat__value">{formatCount(props.profile.smartFollowers)}</p>
          </Show>
        </Stat>

        <div class="pv-stat">
          <div class="pv-stat__label-row">
            <p class="pv-stat__label">Account Value</p>
            <PlatformIconCluster platforms={props.platforms ?? []} />
          </div>
          <div class="pv-stat__value-row pv-stat__value-row--glyph">
            <Show when={!props.tradeLoading} fallback={<Bar />}>
              <Show
                when={size() != null}
                fallback={

                  <p class="pv-stat__value pv-stat__value--medium">{subDollar() ?? NO_VALUE}</p>
                }
              >
                <AccountSizeDots tier={clampTier(size() as number)} />
                <p class="pv-stat__value pv-stat__value--medium">{formatAccountSize(clampTier(size() as number))}</p>
              </Show>
            </Show>
          </div>
        </div>

        <div class="pv-stat">
          <div class="pv-stat__label-row">
            <p class="pv-stat__label">All-Time P&amp;L</p>
            <PlatformIconCluster platforms={props.platforms ?? []} />
          </div>
          <div class="pv-stat__value-row pv-stat__value-row--glyph">
            <Show when={!props.tradeLoading} fallback={<Bar />}>
              {}
              <Show when={tone()}>
                <span
                  class="pv-pnl-caret"
                  classList={{ 'pv-pnl-caret--down': tone() === 'loss' }}
                  aria-hidden="true"
                >
                  {tone() === 'loss' ? '▼' : '▲'}
                </span>
              </Show>
              <p
                class="pv-stat__value pv-stat__value--pnl"
                classList={{
                  'pv-stat__value--teal': tone() === 'profit',
                  'pv-stat__value--loss': tone() === 'loss',
                }}
                title={pnlFigure().approx ? FX_APPROXIMATE_TITLE : undefined}
              >
                {pnlFigure().text}
              </p>
            </Show>
          </div>
        </div>
      </div>
    </section>
  );
};
