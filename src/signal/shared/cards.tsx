import { Show, For, Match, Switch, type Accessor, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type {
  AccountPlatformSummary,
  PlatformAccountChip,
  PositionsFooterCopy,
  TokenAccount,
  TokenPlatformSummary,
  HyperliquidAccount,
  HyperliquidSummary,
  PerpPosition,
  PolymarketAccount,
  PredictionMarket,
  PlatformMetrics,
  PredictionSummary,
  SignalProtocol,
  SignalProfileSnapshot,
  TokenPosition,
} from '../types';
import { arrowOut, chevron, kaitoLockup, protocolChip, triangle } from './icons';
import { hyperliquidAddressUrl } from './links';
import { PROTOCOL_LABEL } from '../protocol-labels';
import { tokenPlatformChips } from '../social-card-map';
import { ChartGroup, hasChartPoints, servedPeriod } from './chart';
import { count } from './format';
import { AvatarImage, ChipAvatarImage, MarketIcon, UserAvatarImage } from './images';
import { StickyShadowCard } from './scroll-shadow';
import {
  createAccountPositions,
  createWalletDetail,
  withHyperliquidDetail,
  withPolymarketDetail,
  withPumpfunDetail,
  type WalletDetailStatus,
} from './wallet-detail-view';
import {
  ACCOUNT_VALUE_LABEL,
  COLLAPSE_LABEL,
  GROUP_ACCOUNT_VALUE_LABEL,
  GROUP_POSITIONS_VALUE_LABEL,
  GROUP_PROFIT_LOSS_ALL_TIME_LABEL,
  GROUP_UPNL_LABEL,
  POINTS_LABEL,
  POSITIONS_VALUE_LABEL,
  PREDICTIONS_LABEL,
  PROFIT_LOSS_ALL_TIME_LABEL,
  REFERRED_TRADERS_STAT_LABEL,
  REFERRED_VOLUME_LABEL,
  SEE_DETAILS_LABEL,
  SHOW_LABEL,
  showingPositionsLabel,
  TRADES_LABEL,
  UPNL_LABEL,
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

type PerpColumn = {
  label: string;
  right: boolean;
  cell: (pos: PerpPosition) => JSX.Element;
  value?: (pos: PerpPosition) => string;
};

const PERP_COLUMNS: PerpColumn[] = [
  {
    label: 'Token',
    right: false,
    cell: (pos) => (
      <PerpPositionTokenCell
        pos={pos}
        cellClass="signal-popover__postable-cell signal-popover__postable-token"
      />
    ),
  },
  {
    label: 'Side',
    right: false,
    cell: (pos) => (
      <div class={`signal-popover__postable-cell ${lossGainClass(pos.side === 'Short')}`}>
        {pos.side.toUpperCase()}
      </div>
    ),
  },
  {
    label: 'Lev.',
    right: true,
    value: (pos) => pos.leverage,
    cell: (pos) => (
      <div class="signal-popover__postable-cell signal-popover__postable-cell--right">
        {pos.leverage}
      </div>
    ),
  },
  { label: 'Entry', right: true, cell: (pos) => <div class={POSTABLE_RIGHT}>{pos.entry}</div> },
  {
    label: 'Margin',
    right: true,
    value: (pos) => pos.margin,
    cell: (pos) => <div class={POSTABLE_RIGHT}>{pos.margin}</div>,
  },
  {
    label: 'Liq Price',
    right: true,
    value: (pos) => pos.liqPrice,
    cell: (pos) => <div class={POSTABLE_RIGHT}>{pos.liqPrice}</div>,
  },
  { label: 'Size', right: true, cell: (pos) => <div class={POSTABLE_RIGHT}>{pos.size}</div> },
  {
    label: 'Mark',
    right: true,
    cell: (pos) => (
      <div class={`${POSTABLE_RIGHT}${pos.markNegative ? ' signal-popover__value--loss' : ''}`}>
        {pos.mark}
      </div>
    ),
  },
  {
    label: 'PnL',
    right: true,
    cell: (pos) => (
      <div class={`${POSTABLE_RIGHT} ${lossGainClass(pos.pnlNegative)}`}>{pos.pnl}</div>
    ),
  },
  {
    label: 'Funding',
    right: true,
    value: (pos) => pos.funding,
    cell: (pos) => <div class={POSTABLE_RIGHT}>{pos.funding}</div>,
  },
];

const isEmptyCell = (value: string): boolean => {
  const v = value.trim();
  return v === '' || v === '-' || v === '—';
};

export function perpColumnsFor(positions: readonly PerpPosition[]): string[] {
  return PERP_COLUMNS.filter(
    (col) => !col.value || positions.some((pos) => !isEmptyCell(col.value?.(pos) ?? '')),
  ).map((col) => col.label);
}

export function PositionsTable(props: { positions: PerpPosition[] }): JSX.Element {
  const columns = () => {
    const shown = new Set(perpColumnsFor(props.positions));
    return PERP_COLUMNS.filter((col) => shown.has(col.label));
  };
  return (
    <Show when={props.positions.length > 0}>
      <div class="signal-popover__postable-scroll">
        <div
          class="signal-popover__postable"
          role="table"
          style={{ 'grid-template-columns': `repeat(${columns().length}, max-content)` }}
        >
          <For each={columns()}>
            {(col) => (
              <div
                class={`signal-popover__postable-head${col.right ? ' signal-popover__postable-head--right' : ''}`}
              >
                {col.label}
              </div>
            )}
          </For>
          <For each={props.positions}>
            {(pos) => <For each={columns()}>{(col) => col.cell(pos)}</For>}
          </For>
        </div>
      </div>
    </Show>
  );
}

export function StackedPositionsTable(props: { positions: PerpPosition[] }): JSX.Element {
  return (
    <Show when={props.positions.length > 0}>
      <div class="signal-popover__stack" role="table">
        <div class="signal-popover__stack-head" role="row">
          <span>Market</span>
          <span class="signal-popover__stack-right">Size</span>
          <span class="signal-popover__stack-right">Unrealized P&L</span>
        </div>
        <For each={props.positions}>
          {(pos) => (
            <div class="signal-popover__stack-row" role="row">
              <div class="signal-popover__stack-cell">
                <div class="signal-popover__stack-main">
                  {pos.pair}
                  <span class={`signal-popover__stack-side ${lossGainClass(pos.side === 'Short')}`}>
                    {pos.side}
                  </span>
                </div>
                <Show when={pos.detail}>
                  {(detail) => <div class="signal-popover__stack-sub">{detail()}</div>}
                </Show>
              </div>
              <div class="signal-popover__stack-cell signal-popover__stack-right">
                <div class="signal-popover__stack-main signal-popover__num">
                  {pos.quantity ?? pos.size}
                </div>
                <Show when={pos.value}>
                  {(value) => (
                    <div class="signal-popover__stack-sub signal-popover__num">{value()}</div>
                  )}
                </Show>
              </div>
              <div class="signal-popover__stack-cell signal-popover__stack-right">
                <div
                  class={`signal-popover__stack-main signal-popover__num ${lossGainClass(pos.pnlNegative)}`}
                >
                  {pos.pnl}
                </div>
                <Show when={pos.entryMark}>
                  {(entryMark) => (
                    <div class="signal-popover__stack-sub signal-popover__num">{entryMark()}</div>
                  )}
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}

export function HyperliquidPositionsTable(props: { positions: PerpPosition[] }): JSX.Element {
  const shown = () => new Set(perpColumnsFor(props.positions));
  return (
    <Show when={props.positions.length > 0}>
      <div class="signal-uinfo__hltable-scroll">
        <div
          class="signal-uinfo__hltable"
          role="table"
          style={{ 'grid-template-columns': `repeat(${shown().size}, max-content)` }}
        >
          <For each={PERP_COLUMNS.filter((col) => shown().has(col.label))}>
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
                <Show when={shown().has('Lev.')}>
                  <div class="signal-uinfo__hltable-cell signal-uinfo__hltable-cell--right">
                    {pos.leverage}
                  </div>
                </Show>
                <div class="signal-uinfo__hltable-cell signal-uinfo__hltable-cell--right signal-popover__num">
                  {pos.entry}
                </div>
                <Show when={shown().has('Margin')}>
                  <div class="signal-uinfo__hltable-cell signal-uinfo__hltable-cell--right signal-popover__num">
                    {pos.margin}
                  </div>
                </Show>
                <Show when={shown().has('Liq Price')}>
                  <div class="signal-uinfo__hltable-cell signal-uinfo__hltable-cell--right signal-popover__num">
                    {pos.liqPrice}
                  </div>
                </Show>
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
                <Show when={shown().has('Funding')}>
                  <div class="signal-uinfo__hltable-cell signal-uinfo__hltable-cell--right signal-popover__num">
                    {pos.funding}
                  </div>
                </Show>
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

  profileUrl?: string;
};

function AddressChip(props: {
  chip: AccountChip;
  on: boolean;
  avatar: boolean;
  seed: boolean;
  onSelect?: () => void;
}): JSX.Element {
  return (
    <div class={`signal-popover__acct-chip${props.on ? ' signal-popover__acct-chip--on' : ''}`}>
      <span
        class="signal-popover__acct-chip-zone"
        role={props.onSelect ? 'button' : undefined}
        aria-pressed={props.onSelect ? props.on : undefined}
        onClick={(e) => {
          if (!props.onSelect) return;
          e.preventDefault();
          e.stopPropagation();
          props.onSelect();
        }}
      >
        <Show
          when={props.avatar}
          fallback={
            <Show when={props.chip.hasPositions}>
              <span class="signal-popover__acct-chip-dot" />
            </Show>
          }
        >
          <span class="signal-popover__acct-chip-avatar-box">
            <ChipAvatarImage
              url={props.chip.avatarUrl}
              seed={props.seed ? props.chip.label : undefined}
            />
            <Show when={props.chip.hasPositions}>
              <span class="signal-popover__acct-chip-avatar-dot" />
            </Show>
          </span>
        </Show>
        <span class="signal-popover__acct-chip-label signal-popover__num">{props.chip.label}</span>
      </span>
      <Show when={props.chip.profileUrl}>
        {(href) => (
          <>
            <span class="signal-popover__acct-chip-rule" />
            <a
              class="signal-popover__acct-chip-link"
              href={href()}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${props.chip.label}`}
              onClick={(e) => e.stopPropagation()}
            >
              {arrowOut()}
            </a>
          </>
        )}
      </Show>
    </div>
  );
}

export function AccountChipRow(props: {
  chips: AccountChip[];
  selected: number;
  expanded: boolean;
  onSelect?: (index: number) => void;

  onToggle?: () => void;
  toggleStyle?: 'show' | 'details';

  avatarFallback?: boolean;
}): JSX.Element {
  const toggleText = () =>
    props.toggleStyle === 'details'
      ? SEE_DETAILS_LABEL
      : props.expanded
        ? COLLAPSE_LABEL
        : SHOW_LABEL;
  return (
    <div class="signal-popover__chiprow">
      <div class="signal-popover__chips">
        <For each={props.chips}>
          {(chip, index) => (
            <AddressChip
              chip={chip}
              on={props.expanded && index() === props.selected}
              avatar={!!(props.avatarFallback || chip.avatarUrl)}
              seed={!!props.avatarFallback}
              onSelect={props.onSelect ? () => props.onSelect?.(index()) : undefined}
            />
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
  return accounts.map((a) => ({
    label: a.addressShort,
    hasPositions: a.hasPositions,
    profileUrl: hyperliquidAddressUrl(a.address),
  }));
}

export function accountPlatformChips(accounts: PlatformAccountChip[]): AccountChip[] {
  return accounts.map((a) => ({ label: a.label, hasPositions: a.hasPositions }));
}

export function polymarketChips(accounts: PolymarketAccount[]): AccountChip[] {
  return accounts.map((a) => ({
    label: a.name,
    avatarUrl: a.avatarUrl,

    hasPositions: a.hasPositions,
    profileUrl: a.profileHandle == null ? undefined : polymarketProfileUrl(a.profileHandle),
  }));
}

const MARKET_SKELETON_ROWS = 4;
const PERP_SKELETON_ROWS = 5;

export function WalletDetailLoading(): JSX.Element {
  return <p class="signal-popover__nodetail">{WALLET_DETAIL_LOADING}</p>;
}

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

export function PositionsFooter(props: {
  total: number;
  expanded: boolean;
  onToggle: () => void;

  copy?: PositionsFooterCopy;

  shown?: number;

  profileUrl?: string;
}): JSX.Element {
  const toggle = (e: MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    props.onToggle();
  };
  const card = (): string => (props.copy ? ' signal-popover__footer--tokencard' : '');
  return (
    <Show when={props.total > 0}>
      <Show
        when={props.expanded}
        fallback={
          <div
            class={`signal-popover__footer${card()}${props.copy === 'slice' ? ' signal-popover__footer--slice' : ''}`}
            role="button"
            aria-expanded={false}
            onClick={toggle}
          >
            <Switch
              fallback={
                <>
                  <span class="signal-popover__footer-dot" />
                  <span class="signal-popover__footer-count signal-popover__num">
                    <span class="signal-popover__footer-strong">{props.total}</span>{' '}
                    {props.total === 1 ? 'position' : 'positions'}
                  </span>
                </>
              }
            >
              <Match when={props.copy === 'slice'}>
                <span class="signal-popover__footer-slice">
                  <span class="signal-popover__footer-dot" />
                  <span class="signal-popover__footer-count signal-popover__num">
                    {showingPositionsLabel(props.shown ?? 0, props.total)}
                  </span>
                </span>
              </Match>
              <Match when={props.copy === 'affordance'}>
                <span class="signal-popover__footer-collapse">{SHOW_LABEL}</span>
              </Match>
            </Switch>
            {chevron('down')}
          </div>
        }
      >
        <div class={`signal-popover__footer signal-popover__footer--expanded${card()}`}>
          <span
            class="signal-popover__footer-collapse"
            role="button"
            aria-expanded
            onClick={toggle}
          >
            {COLLAPSE_LABEL} {chevron('down')}
          </span>
          <Show when={props.profileUrl}>
            {(href) => (
              <a
                class="signal-popover__footer-profile"
                href={href()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {VIEW_IN_PROFILE_LABEL}
              </a>
            )}
          </Show>
        </div>
      </Show>
    </Show>
  );
}

function PerpStatRow(props: {
  data: Pick<
    HyperliquidSummary,
    'aggregate' | 'accountValue' | 'profitLoss' | 'profitLossNegative' | 'upnl' | 'upnlNegative'
  >;
}): JSX.Element {
  return (
    <div class="signal-popover__statrow">
      <Metric
        label={props.data.aggregate ? GROUP_ACCOUNT_VALUE_LABEL : ACCOUNT_VALUE_LABEL}
        value={props.data.accountValue}
      />
      <Metric
        label={props.data.aggregate ? GROUP_PROFIT_LOSS_ALL_TIME_LABEL : PROFIT_LOSS_ALL_TIME_LABEL}
        value={props.data.profitLoss}
        modifier={props.data.profitLossNegative ? 'loss' : 'gain'}
      />
      <Metric
        label={props.data.aggregate ? GROUP_UPNL_LABEL : UPNL_LABEL}
        value={props.data.upnl}
        modifier={props.data.upnlNegative ? 'loss' : 'gain'}
      />
    </div>
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
  metrics?: PlatformMetrics;
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
        <Show when={hasChartPoints(props.data.charts)} fallback={<PerpStatRow data={props.data} />}>
          <div class="signal-popover__summary">
            <div class="signal-popover__metrics">
              <Metric
                label={props.data.aggregate ? GROUP_ACCOUNT_VALUE_LABEL : ACCOUNT_VALUE_LABEL}
                value={props.data.accountValue}
              />
              <Metric
                label={props.data.aggregate ? GROUP_UPNL_LABEL : UPNL_LABEL}
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
        </Show>
      </div>
      <PlatformMetricsRow metrics={props.metrics} />
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
  period: string;
  selected: number;
  onSelect: (index: number) => void;
  onToggle: () => void;
  onSelectPeriod: (period: string) => void;
  metrics?: PlatformMetrics;
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
        <Show
          when={hasChartPoints(props.data.charts)}
          fallback={
            <div class="signal-popover__statrow">
              <Metric
                label={props.data.aggregate ? GROUP_POSITIONS_VALUE_LABEL : POSITIONS_VALUE_LABEL}
                value={props.data.positionsValue}
              />
              <Metric
                label={PROFIT_LOSS_ALL_TIME_LABEL}
                value={props.data.profitLoss}
                modifier={props.data.profitLossNegative ? 'loss' : 'gain'}
              />
              <Metric label={PREDICTIONS_LABEL} value={props.data.predictions} />
            </div>
          }
        >
          <div class="signal-popover__summary">
            <div class="signal-popover__metrics">
              <Metric
                label={props.data.aggregate ? GROUP_POSITIONS_VALUE_LABEL : POSITIONS_VALUE_LABEL}
                value={props.data.positionsValue}
              />
              <Metric label={PREDICTIONS_LABEL} value={props.data.predictions} />
            </div>
            <ChartGroup
              charts={props.data.charts}
              selected={servedPeriod(props.data.charts, props.period)}
              card="polymarket"
              wide
              pnlLabel={PROFIT_LOSS_ALL_TIME_LABEL}
              pnlValue={props.data.profitLoss}
              pnlValueModifier={props.data.profitLossNegative ? 'loss' : 'gain'}
              onSelectPeriod={props.onSelectPeriod}
            />
          </div>
        </Show>
      </div>
      <PlatformMetricsRow metrics={props.metrics} />
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
              <div class="signal-popover__divider-h" />
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

export function PlatformMetricsRow(props: { metrics?: PlatformMetrics }): JSX.Element {
  const cells = () =>
    [
      [REFERRED_TRADERS_STAT_LABEL, props.metrics?.referredTraders],
      [REFERRED_VOLUME_LABEL, props.metrics?.referredVolume],
      [POINTS_LABEL, props.metrics?.points],
    ].filter((cell): cell is [string, string] => cell[1] != null);
  return (
    <Show when={cells().length > 0}>
      <div class="signal-popover__statrow signal-popover__metricsrow">
        <For each={cells()}>{([label, value]) => <Metric label={label} value={value} />}</For>
      </div>
    </Show>
  );
}

export function PlatformMetricsCard(props: {
  protocol: SignalProtocol;
  metrics: PlatformMetrics;
}): JSX.Element {
  return (
    <StickyShadowCard
      class={`signal-popover__card signal-popover__card--${props.protocol} signal-popover__card--metrics-only`}
    >
      <div class="signal-popover__card-top">
        <CardHeadLink>
          <div class="signal-popover__addr-row">
            <span class="signal-popover__addr">{PROTOCOL_LABEL[props.protocol]}</span>
          </div>
          {protocolChip(props.protocol)}
        </CardHeadLink>
      </div>
      <PlatformMetricsRow metrics={props.metrics} />
    </StickyShadowCard>
  );
}

export function PlatformMetaLine(props: {
  positionsCount: number | null;
  dataAsOf?: string;
  class: string;
}): JSX.Element {
  const positions = () =>
    props.positionsCount != null && props.positionsCount > 0
      ? `${count(props.positionsCount)} ${props.positionsCount === 1 ? 'position' : 'positions'}`
      : undefined;
  return (
    <Show when={positions() || props.dataAsOf}>
      <div class={props.class}>
        <Show when={positions()}>
          {(text) => <span class="signal-popover__num">{text()}</span>}
        </Show>
        <Show when={props.dataAsOf}>{(asOf) => <span>{asOf()}</span>}</Show>
      </div>
    </Show>
  );
}

export function AccountPlatformCard(props: {
  data: AccountPlatformSummary;
  period: string;
  onSelectPeriod: (period: string) => void;
  metrics?: PlatformMetrics;
  expanded?: boolean;
  selected?: number;
  onSelect?: (index: number) => void;
  onToggle?: () => void;
}): JSX.Element {
  const {
    hasDetail,
    canOpen,
    chip: selectedChip,
    view: detail,
  } = createAccountPositions(
    () => props.data,
    () => props.selected ?? 0,
    () => props.expanded === true,
  );
  const lighterSummary = () => {
    const summary = detail().summary;
    return summary?.platform === 'lighter' ? summary : undefined;
  };
  return (
    <StickyShadowCard class={`signal-popover__card signal-popover__card--${props.data.protocol}`}>
      <div class="signal-popover__card-top">
        <CardHeadLink>
          <div class="signal-popover__addr-row">
            <span class="signal-popover__addr">{props.data.heading}</span>
          </div>
          {protocolChip(props.data.protocol)}
        </CardHeadLink>
        <Show when={hasChartPoints(props.data.charts)} fallback={<PerpStatRow data={props.data} />}>
          <div class="signal-popover__summary">
            <div class="signal-popover__metrics">
              <Metric
                label={props.data.aggregate ? GROUP_ACCOUNT_VALUE_LABEL : ACCOUNT_VALUE_LABEL}
                value={props.data.accountValue}
              />
              <Metric
                label={props.data.aggregate ? GROUP_UPNL_LABEL : UPNL_LABEL}
                value={props.data.upnl}
                modifier={props.data.upnlNegative ? 'loss' : 'gain'}
              />
            </div>
            <ChartGroup
              charts={props.data.charts}
              selected={servedPeriod(props.data.charts, props.period)}
              card={props.data.protocol}
              wide
              pnlLabel={
                props.data.aggregate ? GROUP_PROFIT_LOSS_ALL_TIME_LABEL : PROFIT_LOSS_ALL_TIME_LABEL
              }
              pnlValue={props.data.profitLoss}
              pnlValueModifier={props.data.profitLossNegative ? 'loss' : 'gain'}
              onSelectPeriod={props.onSelectPeriod}
            />
          </div>
        </Show>
      </div>
      <PlatformMetricsRow metrics={props.metrics} />
      <Show when={props.data.aggregate && props.data.accounts.length > 0}>
        <AccountChipRow
          chips={accountPlatformChips(props.data.accounts)}
          selected={hasDetail() ? (props.selected ?? 0) : 0}
          expanded={hasDetail() && props.expanded === true}
          onSelect={hasDetail() ? props.onSelect : undefined}
          onToggle={hasDetail() ? props.onToggle : undefined}
        />
      </Show>
      <PlatformMetaLine
        class="signal-popover__platform-meta"
        positionsCount={
          !props.data.aggregate && props.onToggle && canOpen() ? null : props.data.positionsCount
        }
        dataAsOf={props.data.dataAsOf}
      />
      <Show when={props.expanded && canOpen()}>
        <Show when={selectedChip()?.tier}>
          {(tier) => <span class="signal-popover__tier">{tier()}</span>}
        </Show>
        <Show when={props.data.aggregate && lighterSummary()}>
          {(summary) => (
            <div class="signal-popover__statrow">
              <Metric label={ACCOUNT_VALUE_LABEL} value={summary().accountValue} />
              <Metric
                label={UPNL_LABEL}
                value={summary().upnl}
                modifier={summary().upnlNegative ? 'loss' : 'gain'}
              />
              <Metric
                label={PROFIT_LOSS_ALL_TIME_LABEL}
                value={summary().profitLoss}
                modifier={summary().profitLossNegative ? 'loss' : 'gain'}
              />
            </div>
          )}
        </Show>
        <WalletDetailBody
          status={detail().status}
          hasDetail
          rows={detail().positions.length}
          skeleton="hyperliquid-popover"
        >
          <StackedPositionsTable positions={detail().positions} />
        </WalletDetailBody>
      </Show>
      <Show when={!props.data.aggregate && props.onToggle && canOpen()}>
        <PositionsFooter
          total={detail().positionsTotal ?? props.data.positionsCount ?? 0}
          expanded={props.expanded === true}
          onToggle={() => props.onToggle?.()}
        />
      </Show>
    </StickyShadowCard>
  );
}

export function TokenPlatformCard(props: {
  data: TokenPlatformSummary;
  expanded: boolean;
  selected: number;
  onSelect: (index: number) => void;
  onToggle: () => void;
  metrics?: PlatformMetrics;
}): JSX.Element {
  const selectedChip = (): TokenAccount | undefined =>
    props.data.accounts[Math.min(props.selected, props.data.accounts.length - 1)];

  const single = (): boolean => !props.data.aggregate;

  const baseAccount = (): TokenAccount | undefined =>
    single() ? props.data.accounts[0] : selectedChip();
  const detail = createWalletDetail('pumpfun', () =>
    props.data.protocol === 'pumpfun' && props.expanded ? (baseAccount()?.address ?? null) : null,
  );
  const account = (): TokenAccount | undefined => {
    const base = baseAccount();
    return base && withPumpfunDetail(base, detail());
  };
  const fetchesDetail = (): boolean =>
    props.data.protocol === 'pumpfun' && account()?.address != null;
  const hasDetail = (): boolean => (account()?.hasDetail ?? false) || fetchesDetail();
  const profileUrl = () => account()?.profileUrl;

  return (
    <StickyShadowCard class={`signal-popover__card signal-popover__card--${props.data.protocol}`}>
      <div class="signal-popover__card-top">
        <CardHeadLink href={profileUrl()}>
          <Show
            when={single() && account()}
            fallback={
              <div class="signal-popover__addr-row">
                <span class="signal-popover__addr">{props.data.heading}</span>
              </div>
            }
          >
            {(shown) => (
              <div class="signal-popover__profile">
                <AvatarImage url={shown().avatarUrl} />
                <div class="signal-popover__profile-text">
                  <div class="signal-popover__profile-namerow">
                    <div class="signal-popover__profile-name">{shown().name}</div>
                    <div class="signal-popover__profile-meta">{shown().meta}</div>
                  </div>
                  <div class="signal-popover__bio-line">{shown().bio}</div>
                </div>
              </div>
            )}
          </Show>
          {protocolChip(props.data.protocol)}
        </CardHeadLink>
        <div class="signal-popover__statrow">
          <Metric label={props.data.valueLabel} value={props.data.accountValue} />
          <Metric
            label={PROFIT_LOSS_ALL_TIME_LABEL}
            value={props.data.profitLoss}
            modifier={props.data.profitLossNegative ? 'loss' : 'gain'}
          />
          <Metric label={props.data.countLabel} value={props.data.trades} />
        </div>
      </div>
      <PlatformMetricsRow metrics={props.metrics} />
      <Show when={!single() && props.data.accounts.length > 0}>
        <AccountChipRow
          chips={tokenPlatformChips(props.data.accounts)}
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
                <Metric label={ACCOUNT_VALUE_LABEL} value={shown().accountValue} />
                <Metric
                  label={PROFIT_LOSS_ALL_TIME_LABEL}
                  value={shown().profitLoss}
                  modifier={shown().profitLossNegative ? 'loss' : 'gain'}
                />
                <Metric label={TRADES_LABEL} value={shown().trades} />
              </div>
            </Show>
            <Show when={!walletDetailEmpty(detail().status, hasDetail())}>
              <div class="signal-popover__divider-h" />
            </Show>
            <WalletDetailBody
              status={detail().status}
              hasDetail={hasDetail()}
              rows={shown().tokens.length}
              skeleton="polymarket-popover"
            >
              <TokenPositionList tokens={shown().tokens} />
            </WalletDetailBody>
          </>
        )}
      </Show>
      <Show when={single()}>
        <PositionsFooter
          total={props.data.positionsTotal}
          expanded={props.expanded}
          onToggle={props.onToggle}
          copy={props.data.positionsFooter}
          shown={account()?.tokens.length ?? 0}
          profileUrl={profileUrl()}
        />
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

function TokenChangeLine(props: { pct: string; negative: boolean }): JSX.Element {
  return (
    <div class={`signal-popover__token-change signal-popover__num ${upDownClass(props.negative)}`}>
      {triangle(props.negative ? 'down' : 'up')}
      <span>{props.pct}</span>
    </div>
  );
}

export function TokenPositionList(props: { tokens: TokenPosition[] }): JSX.Element {
  return (
    <div class="signal-popover__pmlist">
      <div class="signal-popover__pmlist-head">
        <div class="signal-popover__market-head signal-popover__market-head--left">Token</div>
        <div class="signal-popover__market-head signal-popover__market-head--right">Position</div>
      </div>
      <For each={props.tokens}>
        {(t) => (
          <div class="signal-popover__market-cell">
            <MarketIcon url={t.iconUrl} size={24} />
            <div class="signal-popover__market-info">
              <div class="signal-popover__market-title">{t.symbol}</div>
              <span class="signal-popover__pmshares">{t.supply}</span>
            </div>
            <MarketValueCell value={t.value}>
              <Show when={t.changePct !== ''}>
                <TokenChangeLine pct={t.changePct} negative={t.changeNegative} />
              </Show>
            </MarketValueCell>
          </div>
        )}
      </For>
    </div>
  );
}
