import { Show, For, Match, Switch, type Accessor, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type {
  HyperliquidAccount,
  HyperliquidSummary,
  PerpPosition,
  PolymarketAccount,
  PredictionMarket,
  PredictionSummary,
  SignalProfileSnapshot,
} from '../types';
import { chevron, kaitoLockup, protocolChip } from './icons';
import { hyperliquidAddressUrl } from './links';
import { ChartGroup } from './chart';
import { ChipAvatarImage, MarketIcon, UserAvatarImage } from './images';
import { StickyShadowCard } from './scroll-shadow';
import {
  createWalletDetail,
  withHyperliquidDetail,
  withPolymarketDetail,
  type WalletDetailStatus,
} from './wallet-detail-view';
import {
  ACCOUNT_VALUE_LABEL,
  GROUP_ACCOUNT_VALUE_LABEL,
  GROUP_PROFIT_LOSS_ALL_TIME_LABEL,
  GROUP_UPNL_LABEL,
  POSITIONS_VALUE_LABEL,
  PREDICTIONS_LABEL,
  PROFIT_LOSS_ALL_TIME_LABEL,
  SEE_DETAILS_LABEL,
  VIEW_IN_PROFILE_LABEL,
  WALLET_DETAIL_LOADING,
} from './stat-labels';

export function UserHeader(props: {
  profile: SignalProfileSnapshot;
  bioPending: Accessor<boolean>;
  bio: Accessor<string | undefined>;
}): JSX.Element {
  return (
    <div class="signal-popover__user">
      <div class="signal-popover__user-info">
        <UserAvatarImage url={props.profile.avatarUrl} />
        <div class="signal-popover__user-textcol">
          <div class="signal-popover__user-text">
            <span class="signal-popover__user-name">{props.profile.displayName}</span>
            <span class="signal-popover__user-handle">@{props.profile.handle}</span>
          </div>
          <Show when={props.bioPending()}>
            <div class="signal-popover__bio-line signal-popover__sk signal-popover__sk--bio" />
          </Show>
          <Show when={!props.bioPending() && props.bio()}>
            {(bio) => <div class="signal-popover__bio-line">{bio()}</div>}
          </Show>
        </div>
      </div>
      {kaitoLockup()}
    </div>
  );
}

export function Metric(props: {
  label: string;
  value: string;
  modifier?: 'loss' | 'gain' | 'liq';
}): JSX.Element {
  return (
    <div class="signal-popover__metric">
      <div class="signal-popover__metric-label">{props.label}</div>
      <div
        class={`signal-popover__metric-value signal-popover__num${
          props.modifier ? ` signal-popover__value--${props.modifier}` : ''
        }`}
      >
        {props.value}
      </div>
    </div>
  );
}

function lossGainClass(negative: boolean): string {
  return negative ? 'signal-popover__value--loss' : 'signal-popover__value--gain';
}

function upDownClass(negative: boolean): string {
  return negative ? 'signal-popover__change--down' : 'signal-popover__change--up';
}

function PerpPositionTokenCell(props: { pos: PerpPosition; cellClass: string }): JSX.Element {
  return (
    <div class={props.cellClass}>
      <MarketIcon url={props.pos.iconUrl} size={16} />
      <span>{props.pos.pair}</span>
    </div>
  );
}

const POSTABLE_RIGHT =
  'signal-popover__postable-cell signal-popover__postable-cell--right signal-popover__num';

const PERP_COLUMNS: { label: string; right: boolean }[] = [
  { label: 'Token', right: false },
  { label: 'Side', right: false },
  { label: 'Lev.', right: true },
  { label: 'Entry', right: true },
  { label: 'Margin', right: true },
  { label: 'Liq Price', right: true },
  { label: 'Size', right: true },
  { label: 'Mark', right: true },
  { label: 'PnL', right: true },
  { label: 'Funding', right: true },
];

export function PositionsTable(props: { positions: PerpPosition[] }): JSX.Element {
  return (
    <Show when={props.positions.length > 0}>
      <div class="signal-popover__postable-scroll">
        <div class="signal-popover__postable" role="table">
          <For each={PERP_COLUMNS}>
            {(col) => (
              <div
                class={`signal-popover__postable-head${col.right ? ' signal-popover__postable-head--right' : ''}`}
              >
                {col.label}
              </div>
            )}
          </For>
          <For each={props.positions}>
            {(pos) => (
              <>
                <PerpPositionTokenCell
                  pos={pos}
                  cellClass="signal-popover__postable-cell signal-popover__postable-token"
                />
                <div class={`signal-popover__postable-cell ${lossGainClass(pos.side === 'Short')}`}>
                  {pos.side.toUpperCase()}
                </div>
                <div class="signal-popover__postable-cell signal-popover__postable-cell--right">
                  {pos.leverage}
                </div>
                <div class={POSTABLE_RIGHT}>{pos.entry}</div>
                <div class={POSTABLE_RIGHT}>{pos.margin}</div>
                <div class={POSTABLE_RIGHT}>{pos.liqPrice}</div>
                <div class={POSTABLE_RIGHT}>{pos.size}</div>
                <div
                  class={`${POSTABLE_RIGHT}${pos.markNegative ? ' signal-popover__value--loss' : ''}`}
                >
                  {pos.mark}
                </div>
                <div class={`${POSTABLE_RIGHT} ${lossGainClass(pos.pnlNegative)}`}>{pos.pnl}</div>
                <div class={POSTABLE_RIGHT}>{pos.funding}</div>
              </>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}

export function HyperliquidPositionsTable(props: { positions: PerpPosition[] }): JSX.Element {
  return (
    <Show when={props.positions.length > 0}>
      <div class="signal-uinfo__hltable-scroll">
        <div class="signal-uinfo__hltable" role="table">
          <For each={PERP_COLUMNS}>
            {(col) => (
              <div
                class={`signal-uinfo__hltable-head${col.right ? ' signal-uinfo__hltable-head--right' : ''}`}
              >
                {col.label}
              </div>
            )}
          </For>
          <For each={props.positions}>
            {(pos) => (
              <>
                <PerpPositionTokenCell
                  pos={pos}
                  cellClass="signal-uinfo__hltable-cell signal-uinfo__hltable-token"
                />
                <div class={`signal-uinfo__hltable-cell ${lossGainClass(pos.side === 'Short')}`}>
                  {pos.side.toUpperCase()}
                </div>
                <div class="signal-uinfo__hltable-cell signal-uinfo__hltable-cell--right">
                  {pos.leverage}
                </div>
                <div class="signal-uinfo__hltable-cell signal-uinfo__hltable-cell--right signal-popover__num">
                  {pos.entry}
                </div>
                <div class="signal-uinfo__hltable-cell signal-uinfo__hltable-cell--right signal-popover__num">
                  {pos.margin}
                </div>
                <div class="signal-uinfo__hltable-cell signal-uinfo__hltable-cell--right signal-popover__num">
                  {pos.liqPrice}
                </div>
                <div class="signal-uinfo__hltable-cell signal-uinfo__hltable-cell--right signal-popover__num">
                  {pos.size}
                </div>
                {}
                <div class="signal-uinfo__hltable-cell signal-uinfo__hltable-cell--right signal-popover__num">
                  {pos.mark}
                </div>
                <div
                  class={`signal-uinfo__hltable-cell signal-uinfo__hltable-cell--right signal-popover__num ${lossGainClass(pos.pnlNegative)}`}
                >
                  {pos.pnl}
                </div>
                {}
                <div class="signal-uinfo__hltable-cell signal-uinfo__hltable-cell--right signal-popover__num">
                  {pos.funding}
                </div>
              </>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}

export type AccountChip = {
  label: string;

  avatarUrl?: string;

  hasPositions: boolean;
};

export function AccountChipRow(props: {
  chips: AccountChip[];
  selected: number;
  expanded: boolean;
  onSelect: (index: number) => void;

  onToggle?: () => void;
  toggleStyle?: 'show' | 'details';

  avatarFallback?: boolean;
}): JSX.Element {
  const toggleText = () =>
    props.toggleStyle === 'details' ? SEE_DETAILS_LABEL : props.expanded ? 'Collapse' : 'Show';
  return (
    <div class="signal-popover__chiprow">
      <div class="signal-popover__chips">
        <For each={props.chips}>
          {(chip, index) => (
            <span
              class={`signal-popover__acct-chip${
                index() === props.selected ? ' signal-popover__acct-chip--on' : ''
              }`}
              role="button"
              aria-pressed={index() === props.selected}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                props.onSelect(index());
              }}
            >
              <Show when={props.avatarFallback || chip.avatarUrl}>
                <ChipAvatarImage
                  url={chip.avatarUrl}
                  seed={props.avatarFallback ? chip.label : undefined}
                />
              </Show>
              <span class="signal-popover__acct-chip-label signal-popover__num">{chip.label}</span>
              <Show when={chip.hasPositions}>
                <span class="signal-popover__acct-chip-tail">
                  <span class="signal-popover__acct-chip-dot" />
                  Positions
                </span>
              </Show>
            </span>
          )}
        </For>
      </div>
      <Show when={props.onToggle}>
        {(onToggle) => (
          <span
            class="signal-popover__chiptoggle"
            role="button"
            aria-expanded={props.expanded}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggle()();
            }}
          >
            {toggleText()}
            {chevron(props.toggleStyle === 'details' ? 'right' : 'down')}
          </span>
        )}
      </Show>
    </div>
  );
}

export function hyperliquidChips(accounts: HyperliquidAccount[]): AccountChip[] {
  return accounts.map((a) => ({ label: a.addressShort, hasPositions: a.hasPositions }));
}

export function polymarketChips(accounts: PolymarketAccount[]): AccountChip[] {
  return accounts.map((a) => ({
    label: a.name,
    avatarUrl: a.avatarUrl,

    hasPositions: a.hasPositions,
  }));
}

const MARKET_SKELETON_ROWS = 4;
const PERP_SKELETON_ROWS = 5;

export function WalletDetailLoading(): JSX.Element {
  return <p class="signal-popover__nodetail">{WALLET_DETAIL_LOADING}</p>;
}

/** A wallet the backend withheld, could not read, or that holds nothing: all
 *  leave the card with no rows to draw and nothing to say about why. */
export function walletDetailEmpty(status: WalletDetailStatus, hasDetail: boolean): boolean {
  return !hasDetail || status === 'withheld' || status === 'unavailable';
}

export function WalletDetailBody(props: {
  status: WalletDetailStatus;
  hasDetail: boolean;
  rows: number;
  skeleton?: WalletDetailSkeletonVariant;
  children: JSX.Element;
}): JSX.Element {
  return (
    <Show when={!walletDetailEmpty(props.status, props.hasDetail)}>
      <Switch fallback={props.children}>
        <Match when={props.rows === 0 && props.status === 'loading'}>
          <Show when={props.skeleton} fallback={<WalletDetailLoading />}>
            {(variant) => <WalletDetailSkeleton variant={variant()} />}
          </Show>
        </Match>
      </Switch>
    </Show>
  );
}

export function ViewInProfileRow(props: { href?: string }): JSX.Element {
  return (
    <div class="signal-popover__viewrow">
      <a
        class="signal-popover__footer-viewall"
        href={props.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        {VIEW_IN_PROFILE_LABEL}
      </a>
    </div>
  );
}

/** The expand/collapse control for a single-account card, which has no chip
 *  row to carry one. */
export function PositionsFooter(props: {
  total: number;
  expanded: boolean;
  onToggle: () => void;
}): JSX.Element {
  const toggle = (e: MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    props.onToggle();
  };
  return (
    <Show when={props.total > 0}>
      <Show
        when={props.expanded}
        fallback={
          <div class="signal-popover__footer" role="button" aria-expanded={false} onClick={toggle}>
            <span class="signal-popover__footer-dot" />
            <span class="signal-popover__footer-count signal-popover__num">
              <span class="signal-popover__footer-strong">{props.total}</span> positions
            </span>
            {chevron('down')}
          </div>
        }
      >
        <div class="signal-popover__footer signal-popover__footer--expanded">
          <span
            class="signal-popover__footer-collapse"
            role="button"
            aria-expanded
            onClick={toggle}
          >
            Collapse {chevron('down')}
          </span>
        </div>
      </Show>
    </Show>
  );
}

function CardHeadLink(props: { href?: string; children: JSX.Element }): JSX.Element {
  return (
    <Dynamic
      component={props.href ? 'a' : 'div'}
      class={`signal-popover__card-head${props.href ? ' signal-popover__card-head--link' : ''}`}
      href={props.href}
      target={props.href ? '_blank' : undefined}
      rel={props.href ? 'noopener noreferrer' : undefined}
    >
      {props.children}
    </Dynamic>
  );
}

export function HyperliquidCard(props: {
  data: HyperliquidSummary;
  expanded: boolean;
  period: string;
  selected: number;
  onSelect: (index: number) => void;
  onToggle: () => void;
  onSelectPeriod: (period: string) => void;
}): JSX.Element {
  const selectedChip = (): HyperliquidAccount | undefined =>
    props.data.accounts[Math.min(props.selected, props.data.accounts.length - 1)];

  const single = (): boolean => !props.data.aggregate && props.data.accounts.length === 1;

  const detail = createWalletDetail('hyperliquid', () =>
    props.expanded ? (selectedChip()?.address ?? null) : null,
  );
  const account = (): HyperliquidAccount | undefined => {
    const chip = selectedChip();
    return chip && withHyperliquidDetail(chip, detail());
  };
  const accountUrl = () => hyperliquidAddressUrl(account()?.address ?? null);
  return (
    <StickyShadowCard class="signal-popover__card signal-popover__card--hyperliquid">
      <div class="signal-popover__card-top">
        <CardHeadLink href={accountUrl()}>
          <div class="signal-popover__addr-row">
            <span class="signal-popover__addr">{props.data.heading}</span>
          </div>
          {protocolChip('hyperliquid')}
        </CardHeadLink>
        <div class="signal-popover__summary">
          <div class="signal-popover__metrics">
            <Metric
              label={props.data.aggregate ? GROUP_ACCOUNT_VALUE_LABEL : ACCOUNT_VALUE_LABEL}
              value={props.data.accountValue}
            />
            <Metric
              label={GROUP_UPNL_LABEL}
              value={props.data.upnl}
              modifier={props.data.upnlNegative ? 'loss' : 'gain'}
            />
          </div>
          <ChartGroup
            charts={props.data.charts}
            selected={props.period}
            card="hyperliquid"
            wide
            pnlLabel={
              props.data.aggregate ? GROUP_PROFIT_LOSS_ALL_TIME_LABEL : PROFIT_LOSS_ALL_TIME_LABEL
            }
            pnlValue={props.data.profitLoss}
            pnlValueModifier={props.data.profitLossNegative ? 'loss' : 'gain'}
            onSelectPeriod={props.onSelectPeriod}
          />
        </div>
      </div>
      <Show when={!single() && props.data.accounts.length > 0}>
        <AccountChipRow
          chips={hyperliquidChips(props.data.accounts)}
          selected={props.selected}
          expanded={props.expanded}
          onSelect={props.onSelect}
          onToggle={props.onToggle}
        />
      </Show>
      <Show when={props.expanded && account()}>
        {(shown) => (
          <>
            <Show when={!single()}>
              <div class="signal-popover__statrow">
                <Metric label={ACCOUNT_VALUE_LABEL} value={shown().accountValue} />
                <Metric
                  label={GROUP_UPNL_LABEL}
                  value={shown().upnl}
                  modifier={shown().upnlNegative ? 'loss' : 'gain'}
                />
                <Metric
                  label={GROUP_PROFIT_LOSS_ALL_TIME_LABEL}
                  value={shown().profitLoss}
                  modifier={shown().profitLossNegative ? 'loss' : 'gain'}
                />
              </div>
            </Show>

            <Show when={accountUrl()}>
              <ViewInProfileRow href={accountUrl()} />
            </Show>
            <WalletDetailBody
              status={detail().status}
              hasDetail={shown().hasDetail}
              rows={shown().positions.length}
              skeleton="hyperliquid-popover"
            >
              <PositionsTable positions={shown().positions} />
            </WalletDetailBody>
          </>
        )}
      </Show>
      <Show when={single() && account()}>
        {(shown) => (
          <PositionsFooter
            total={shown().positionsTotal}
            expanded={props.expanded}
            onToggle={props.onToggle}
          />
        )}
      </Show>
    </StickyShadowCard>
  );
}

export function polymarketProfileUrl(name: string): string | undefined {
  return name ? `https://polymarket.com/@${encodeURIComponent(name)}` : undefined;
}

export function PolymarketCard(props: {
  data: PredictionSummary;
  expanded: boolean;
  selected: number;
  onSelect: (index: number) => void;
  onToggle: () => void;
}): JSX.Element {
  const selectedChip = (): PolymarketAccount | undefined =>
    props.data.accounts[Math.min(props.selected, props.data.accounts.length - 1)];

  const single = (): boolean => !props.data.aggregate && props.data.accounts.length === 1;

  const detail = createWalletDetail('polymarket', () =>
    props.expanded ? (selectedChip()?.address ?? null) : null,
  );
  const account = (): PolymarketAccount | undefined => {
    const chip = selectedChip();
    return chip && withPolymarketDetail(chip, detail());
  };

  const accountUrl = () => {
    const shown = account();
    return shown?.profileHandle == null ? undefined : polymarketProfileUrl(shown.profileHandle);
  };
  return (
    <StickyShadowCard class="signal-popover__card signal-popover__card--polymarket">
      <div class="signal-popover__card-top">
        <CardHeadLink href={accountUrl()}>
          <div class="signal-popover__addr-row">
            <span class="signal-popover__addr">{props.data.heading}</span>
          </div>
          {protocolChip('polymarket')}
        </CardHeadLink>
        {}
        <div class="signal-popover__statrow">
          <Metric label={POSITIONS_VALUE_LABEL} value={props.data.positionsValue} />
          <Metric
            label={PROFIT_LOSS_ALL_TIME_LABEL}
            value={props.data.profitLoss}
            modifier={props.data.profitLossNegative ? 'loss' : 'gain'}
          />
          <Metric label={PREDICTIONS_LABEL} value={props.data.predictions} />
        </div>
      </div>
      <Show when={!single() && props.data.accounts.length > 0}>
        <AccountChipRow
          chips={polymarketChips(props.data.accounts)}
          selected={props.selected}
          expanded={props.expanded}
          onSelect={props.onSelect}
          onToggle={props.onToggle}
          avatarFallback
        />
      </Show>
      <Show when={props.expanded && account()}>
        {(shown) => (
          <>
            <Show when={!single()}>
              <div class="signal-popover__statrow">
                <Metric label={POSITIONS_VALUE_LABEL} value={shown().positionsValue} />
                <Metric
                  label={PROFIT_LOSS_ALL_TIME_LABEL}
                  value={shown().profitLoss}
                  modifier={shown().profitLossNegative ? 'loss' : 'gain'}
                />
                <Metric label={PREDICTIONS_LABEL} value={shown().predictions} />
              </div>
            </Show>
            <Show when={!walletDetailEmpty(detail().status, shown().hasDetail)}>
              <ViewInProfileRow href={accountUrl()} />
            </Show>
            <WalletDetailBody
              status={detail().status}
              hasDetail={shown().hasDetail}
              rows={shown().markets.length}
              skeleton="polymarket-popover"
            >
              <OutcomeMarketList markets={shown().markets} />
            </WalletDetailBody>
          </>
        )}
      </Show>
      <Show when={single() && account()}>
        {(shown) => (
          <PositionsFooter
            total={shown().positionsTotal}
            expanded={props.expanded}
            onToggle={props.onToggle}
          />
        )}
      </Show>
    </StickyShadowCard>
  );
}

function MarketNameCell(props: { market: PredictionMarket; iconSize?: number }): JSX.Element {
  return (
    <>
      <MarketIcon url={props.market.iconUrl} size={props.iconSize} />
      <div class="signal-popover__market-info">
        <div class="signal-popover__market-title">{props.market.title}</div>
        <div class="signal-popover__pmoutcome">
          <span
            class={`signal-popover__pmpill signal-popover__pmpill--${props.market.outcomeYes ? 'yes' : 'no'}`}
          >
            {props.market.outcome}
          </span>
          <Show when={props.market.shares}>
            <span class="signal-popover__pmshares">{props.market.shares}</span>
          </Show>
        </div>
      </div>
    </>
  );
}

function MarketValueCell(props: { value: string; children: JSX.Element }): JSX.Element {
  return (
    <div class="signal-popover__market-valcell">
      <div class="signal-popover__market-value signal-popover__num">{props.value}</div>
      {props.children}
    </div>
  );
}

type MarketVariant = 'table' | 'list';

const MARKET_HEADROW_CLASS: Record<MarketVariant, string> = {
  table: 'signal-popover__market-headrow',
  list: 'signal-popover__pmlist-head',
};

const MARKET_WRAP_CLASS: Record<MarketVariant, string> = {
  table: 'signal-popover__market',
  list: 'signal-popover__pmlist',
};

function MarketHeadRow(props: { variant: MarketVariant }): JSX.Element {
  return (
    <div class={MARKET_HEADROW_CLASS[props.variant]}>
      <div class="signal-popover__market-head signal-popover__market-head--left">Market</div>
      <div class="signal-popover__market-head signal-popover__market-head--right">Value</div>
    </div>
  );
}

function MarketSkeletonRow(props: { altRow: boolean }): JSX.Element {
  return (
    <div
      class={`signal-popover__market-cell${props.altRow ? ' signal-popover__market-cell--alt' : ''}`}
    >
      <div class="signal-popover__market-icon signal-popover__sk" />
      <div class="signal-popover__market-info">
        <div class="signal-popover__sk signal-popover__sk--mkt-title" />
        <div class="signal-popover__pmoutcome">
          <div class="signal-popover__sk signal-popover__sk--mkt-pill" />
          <div class="signal-popover__sk signal-popover__sk--mkt-shares" />
        </div>
      </div>
      <div class="signal-popover__market-valcell">
        <div class="signal-popover__sk signal-popover__sk--mkt-value" />
        <div class="signal-popover__sk signal-popover__sk--mkt-change" />
      </div>
    </div>
  );
}

function MarketSkeleton(props: { variant: MarketVariant; rows?: number }): JSX.Element {
  const rows = (): number[] =>
    Array.from({ length: props.rows ?? MARKET_SKELETON_ROWS }, (_, i) => i);
  return (
    <div class={MARKET_WRAP_CLASS[props.variant]} aria-hidden="true">
      <MarketHeadRow variant={props.variant} />
      <For each={rows()}>{(i) => <MarketSkeletonRow altRow={i % 2 === 1} />}</For>
    </div>
  );
}

type PerpVariant = 'popover' | 'profile';

const PERP_TABLE_CLASS: Record<
  PerpVariant,
  { scroll: string; grid: string; head: string; cell: string; token: string }
> = {
  popover: {
    scroll: 'signal-popover__postable-scroll',
    grid: 'signal-popover__postable',
    head: 'signal-popover__postable-head',
    cell: 'signal-popover__postable-cell',
    token: 'signal-popover__postable-token',
  },
  profile: {
    scroll: 'signal-uinfo__hltable-scroll',
    grid: 'signal-uinfo__hltable',
    head: 'signal-uinfo__hltable-head',
    cell: 'signal-uinfo__hltable-cell',
    token: 'signal-uinfo__hltable-token',
  },
};

function PerpSkeleton(props: { variant: PerpVariant; rows?: number }): JSX.Element {
  const cls = () => PERP_TABLE_CLASS[props.variant];
  const rows = (): number[] =>
    Array.from({ length: props.rows ?? PERP_SKELETON_ROWS }, (_, i) => i);
  return (
    <div class={cls().scroll} aria-hidden="true">
      <div class={cls().grid}>
        <For each={PERP_COLUMNS}>
          {(col) => (
            <div class={`${cls().head}${col.right ? ` ${cls().head}--right` : ''}`}>
              {col.label}
            </div>
          )}
        </For>
        <For each={rows()}>
          {() => (
            <>
              <div class={`${cls().cell} ${cls().token}`}>
                <div class="signal-popover__market-icon signal-popover__sk" />
                <div class="signal-popover__sk signal-popover__sk--perp-token" />
              </div>
              <For each={PERP_COLUMNS.slice(1)}>
                {(col) => (
                  <div class={`${cls().cell}${col.right ? ` ${cls().cell}--right` : ''}`}>
                    <div class="signal-popover__sk signal-popover__sk--perp" />
                  </div>
                )}
              </For>
            </>
          )}
        </For>
      </div>
    </div>
  );
}

export type WalletDetailSkeletonVariant =
  | 'polymarket-popover'
  | 'polymarket-profile'
  | 'hyperliquid-popover'
  | 'hyperliquid-profile';

function WalletDetailSkeleton(props: { variant: WalletDetailSkeletonVariant }): JSX.Element {
  return (
    <Switch>
      <Match when={props.variant === 'polymarket-popover'}>
        <MarketSkeleton variant="list" />
      </Match>
      <Match when={props.variant === 'polymarket-profile'}>
        <MarketSkeleton variant="table" />
      </Match>
      <Match when={props.variant === 'hyperliquid-popover'}>
        <PerpSkeleton variant="popover" />
      </Match>
      <Match when={props.variant === 'hyperliquid-profile'}>
        <PerpSkeleton variant="profile" />
      </Match>
    </Switch>
  );
}

export function MarketTable(props: { markets: PredictionMarket[] }): JSX.Element {
  return (
    <div class="signal-popover__market">
      <MarketHeadRow variant="table" />
      <For each={props.markets}>
        {(m, i) => (
          <div
            class={`signal-popover__market-cell${i() % 2 === 1 ? ' signal-popover__market-cell--alt' : ''}`}
          >
            <MarketNameCell market={m} iconSize={24} />
            <MarketValueCell value={m.value}>
              <div
                class={`signal-popover__market-change signal-popover__num ${upDownClass(m.changeNegative)}`}
              >
                {m.change}
              </div>
            </MarketValueCell>
          </div>
        )}
      </For>
    </div>
  );
}

export function OutcomeMarketList(props: { markets: PredictionMarket[] }): JSX.Element {
  return (
    <div class="signal-popover__pmlist">
      <MarketHeadRow variant="list" />
      <For each={props.markets}>
        {(m, i) => (
          <div
            class={`signal-popover__market-cell${i() % 2 === 1 ? ' signal-popover__market-cell--alt' : ''}`}
          >
            <MarketNameCell market={m} />
            <MarketValueCell value={m.value}>
              <div
                class={`signal-popover__market-change signal-popover__num ${upDownClass(m.changeNegative)}`}
              >
                {m.change}
              </div>
            </MarketValueCell>
          </div>
        )}
      </For>
    </div>
  );
}
