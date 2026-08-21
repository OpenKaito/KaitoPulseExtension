import { Show, type Component } from 'solid-js';
import auraArtwork from '../assets/aura-artwork.png';
import { AccountSizeDots } from '@/shared/AccountSizeDots';
import { clampTier, formatAccountSize } from '@/shared/account-size';
import { PlatformIconCluster } from '../components/PlatformIconCluster';
import { PlatformList } from '../components/PlatformList';
import { TradingVisibilityRow } from '../components/TradingVisibilityRow';
import { UnlockState } from '../components/UnlockState';
import { auraOnboarded, popupData, tradeLoading, tradingVerified } from '../data/store';
import {
  FX_APPROXIMATE_TITLE,
  NO_VALUE,
  approxFigure,
  formatSignedUsd,
  formatSubDollarAccountValue,
  pnlTone,
} from '../format/numbers';
import { openAuraSetup, openVerificationHub } from '../links';

const NoVerifiedAccounts: Component = () => (
  <div class="pv-state pv-state--verify">
    <div class="pv-state__copy pv-state__copy--verify">
      <p class="pv-state__title pv-state__title--verify">Verify a trading account</p>
      {}
      <p class="pv-state__body">Verify an account to see your account value, P&amp;L, and trading activity.</p>
    </div>
    {}
    <button type="button" class="pv-cta pv-cta--verify" onClick={openVerificationHub}>
      Verify account
    </button>
  </div>
);

const ValueBar: Component<{ lead?: boolean }> = (props) => (
  <span class={`rf-sk ${props.lead ? 'pv-sk--trade-lead' : 'pv-sk--trade-value'}`} aria-hidden="true" />
);

export const TradingTab: Component<{ onOpenPlatform: (platform: string) => void }> = (props) => {
  const profile = () => popupData().profile;
  const overview = () => popupData().tradingOverview;
  const groups = () => popupData().platformGroups;
  const coverage = () => popupData().tradingCoverage;
  const pnl = () => profile().allTimePnlUsd;
  const tone = () => pnlTone(pnl());

  const subDollar = () =>
    profile().accountSize == null ? formatSubDollarAccountValue(profile().accountValueUsd) : null;

  const pnlFigure = () => approxFigure(formatSignedUsd(pnl()), profile().allTimePnlApproximate);

  const hasTradingAccounts = () => (overview() != null ? groups().length > 0 : tradingVerified());

  return (
    <Show
      when={auraOnboarded()}
      fallback={
        <UnlockState
          art={auraArtwork}
          title="Complete your Aura setup"
          body="Finish your Aura setup in Kaito to get started."
          action="Continue in Kaito"
          onAction={openAuraSetup}
        />
      }
    >
      {}
      <Show when={hasTradingAccounts()} fallback={<NoVerifiedAccounts />}>
        {}
        <TradingVisibilityRow />

        {}
        <section class="pv-tsum">
          <div class="pv-tsum__head">
            <p class="pv-tsum__title">Trading summary</p>
            <p class="pv-tsum__helper">Totals across every supported platform for your public wallet.</p>
          </div>

          <div class="pv-tsum__body">
            <div class="pv-tsum__cards">
              <div class="pv-tcard">
                {}
                <div class="pv-tcard__head">
                  <p class="pv-tcard__label">Account Value</p>
                  <PlatformIconCluster platforms={groups().map((g) => g.platform)} />
                </div>
                <div class="pv-tcard__value pv-tcard__value--lead">
                  <Show when={!tradeLoading()} fallback={<ValueBar lead />}>
                    {}
                    <Show
                      when={profile().accountSize != null}
                      fallback={<p>{subDollar() ?? NO_VALUE}</p>}
                    >
                      <AccountSizeDots tier={clampTier(profile().accountSize as number)} size={18} />
                      <p>{formatAccountSize(clampTier(profile().accountSize as number))}</p>
                    </Show>
                  </Show>
                </div>
              </div>

              {}
              <div class="pv-tcard">
                {}
                <div class="pv-tcard__head">
                  <p class="pv-tcard__label">All-Time P&amp;L</p>
                  <PlatformIconCluster platforms={groups().map((g) => g.platform)} />
                </div>
                <div class="pv-tcard__value">
                  <Show when={!tradeLoading()} fallback={<ValueBar />}>
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
                      classList={{ 'pv-teal': tone() === 'profit', 'pv-loss': tone() === 'loss' }}
                      title={pnlFigure().approx ? FX_APPROXIMATE_TITLE : undefined}
                    >
                      {pnlFigure().text}
                    </p>
                  </Show>
                </div>
                <Show when={!tradeLoading()}>
                  {}
                  <p class="pv-tcard__note">
                    From platforms that report all-time history
                    <Show when={coverage()} keyed>
                      {(cov) => (
                        <Show when={cov.total > 0 && cov.covered < cov.total}>
                          {` · ${cov.covered} of ${cov.total} verified accounts`}
                        </Show>
                      )}
                    </Show>
                  </p>
                </Show>
              </div>
            </div>

            {}
            <Show when={!tradeLoading() && overview()?.calculatedLabel}>
              {(label) => <p class="pv-tsum__note">{label()}</p>}
            </Show>
          </div>
        </section>

        <PlatformList groups={groups()} loading={tradeLoading()} onOpenPlatform={props.onOpenPlatform} />
      </Show>
    </Show>
  );
};
