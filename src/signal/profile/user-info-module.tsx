import {
  createMemo,
  createSignal,
  Show,
  Switch,
  Match,
  For,
  onMount,
  onCleanup,
  type JSX,
} from 'solid-js';
import { render } from 'solid-js/web';
import type {
  HyperliquidSummary,
  PopoverTotals,
  PredictionSummary,
  SmartFollowerStat,
  TopSmartFollower,
  UserInfoData,
} from '../types';
import { PROFILE_ATTRS } from './profile-dom';
import { buildXStatRow } from './x-stat-row';
import { PROTOCOL_ICON_DATA_URI } from '../protocol-icons';
import { PROTOCOL_LABEL } from '../protocol-labels';
import { AccountSizeDots } from '@/shared/AccountSizeDots';
import { buildPlatformCluster } from '@/shared/platform-cluster';

import {
  kaitoLockup,
  triangle,
  VERIFIED_BADGE_COLOR,
  VERIFIED_BADGE_PATH,
  VERIFIED_BADGE_VIEWBOX,
} from '../shared/icons';
import { hostPrefersDark } from '../host-theme';
import { ChartGroup } from '../shared/chart';
import {
  AccountChipRow,
  WalletDetailBody,
  hyperliquidChips,
  HyperliquidPositionsTable,
  MarketTable,
  polymarketChips,
  polymarketProfileUrl,
} from '../shared/cards';
import {
  createWalletDetail,
  withHyperliquidDetail,
  withPolymarketDetail,
} from '../shared/wallet-detail-view';
import { hyperliquidAddressUrl } from '../shared/links';
import { RemoteImg } from '../shared/images';
import { attachDismissWatcher } from '../shared/dismiss';
import { NO_TOTAL } from '../shared/format';
import {
  ACCOUNT_VALUE_LABEL,
  GROUP_ACCOUNT_VALUE_LABEL,
  GROUP_PROFIT_LOSS_ALL_TIME_LABEL,
  GROUP_UPNL_LABEL,
  POSITIONS_VALUE_LABEL,
  PREDICTIONS_LABEL,
  PROFIT_LOSS_ALL_TIME_LABEL,
  TOTAL_ACCOUNT_VALUE_LABEL,
  TOTAL_ALL_TIME_PNL_LABEL,
  VIEW_IN_PROFILE_LABEL,
} from '../shared/stat-labels';

import popoverCss from '../name-tag-popover.css?inline';
import uinfoCss from './user-info-module.css?inline';
import { createShadowHost } from '../shared/shadow-host';

type Tab = 'x' | 'hyperliquid' | 'polymarket';

const TAB_ICON: Record<Exclude<Tab, 'x'>, string> = {
  hyperliquid: PROTOCOL_ICON_DATA_URI.hyperliquid,
  polymarket: PROTOCOL_ICON_DATA_URI.polymarket,
};
const TAB_LABEL: Record<Exclude<Tab, 'x'>, string> = {
  hyperliquid: PROTOCOL_LABEL.hyperliquid,
  polymarket: PROTOCOL_LABEL.polymarket,
};

const X_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">' +
  '<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68' +
  'l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';

export interface UserInfoHandle {
  root: HTMLElement;
  destroy: () => void;
}

function TabButton(props: {
  tab: Tab;
  active: boolean;

  count?: number;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      class={`signal-uinfo__tab${props.active ? ' signal-uinfo__tab--active' : ''}`}
      onClick={props.onClick}
      aria-label={props.tab === 'x' ? 'X' : undefined}
    >
      <Show
        when={props.tab !== 'x'}
        fallback={<span class="signal-uinfo__tab-x" innerHTML={X_ICON} />}
      >
        <img
          class="signal-uinfo__tab-icon"
          src={TAB_ICON[props.tab as Exclude<Tab, 'x'>]}
          alt=""
          width={14}
          height={14}
          draggable={false}
        />
        <span>{TAB_LABEL[props.tab as Exclude<Tab, 'x'>]}</span>
        <Show when={props.count && props.count > 0}>
          <span class="signal-uinfo__tab-count signal-popover__num">
            {(props.count as number).toLocaleString('en-US')}
          </span>
        </Show>
      </Show>
      {}
      <Show when={props.active}>
        <span class="signal-uinfo__tab-tick" aria-hidden="true" />
      </Show>
    </button>
  );
}

function TopFollowerAvatar(props: {
  follower: TopSmartFollower;
  onHover: (follower: TopSmartFollower, anchor: HTMLElement) => void;
  onLeave: () => void;
}): JSX.Element {
  const avatar = () => (
    <RemoteImg
      url={props.follower.avatarUrl}
      wrapCls="signal-uinfo__follower"
      imgCls="signal-uinfo__follower-img"
      defaultCls="signal-uinfo__follower--default"
      cssPx={20}
    />
  );
  return (
    <Show when={props.follower.username} fallback={avatar()}>
      {(username) => (
        <a
          class="signal-uinfo__follower-link"
          href={`https://x.com/${username()}`}
          aria-label={props.follower.name ?? `@${username()}`}
          onMouseEnter={(e) => props.onHover(props.follower, e.currentTarget)}
          onMouseLeave={props.onLeave}
        >
          {avatar()}
        </a>
      )}
    </Show>
  );
}

function VerifiedBadge(): JSX.Element {
  return (
    <svg
      class="signal-uinfo__xstat-badge"
      viewBox={VERIFIED_BADGE_VIEWBOX}
      fill="none"
      aria-hidden="true"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d={VERIFIED_BADGE_PATH}
        fill={VERIFIED_BADGE_COLOR}
      />
    </svg>
  );
}

function SmartFollowerCell(props: { stat: SmartFollowerStat }): JSX.Element {
  return (
    <div class="signal-uinfo__xstat">
      <div class="signal-uinfo__xstat-label">
        <span>{props.stat.label}</span>
        <Show when={props.stat.verifiedBadge}>
          <VerifiedBadge />
        </Show>
      </div>
      <div class="signal-uinfo__xstat-value">
        <span class="signal-uinfo__xstat-num signal-popover__num">{props.stat.value}</span>
        <Show when={props.stat.rank}>
          {(rank) => <span class="signal-uinfo__xstat-rank signal-popover__num">{rank()}</span>}
        </Show>
      </div>
    </div>
  );
}

function TotalSmartFollowersCell(props: {
  stat: SmartFollowerStat;
  panel: SmartFollowerStat[];
  hasHidden: boolean;
}): JSX.Element {
  let cell: HTMLDivElement | undefined;
  const [hovered, setHovered] = createSignal(false);
  const [pinned, setPinned] = createSignal(false);
  const collapsible = (): boolean => props.hasHidden && props.panel.length > 0;
  const open = (): boolean => collapsible() && (hovered() || pinned());

  onMount(() => {
    const stop = attachDismissWatcher(window, document, () => cell, {
      onOutsideClick: () => setPinned(false),
    });
    onCleanup(stop);
  });

  return (
    <div
      class="signal-uinfo__xstat signal-uinfo__xstat--total"
      ref={cell}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div class="signal-uinfo__xstat-label">
        <span>{props.stat.label}</span>
      </div>
      <div
        class="signal-uinfo__xstat-value"
        role={collapsible() ? 'button' : undefined}
        aria-expanded={collapsible() ? open() : undefined}
        onClick={(e) => {
          if (!collapsible()) return;
          e.stopPropagation();
          setPinned((prev) => !prev);
        }}
      >
        <span class="signal-uinfo__xstat-num signal-popover__num">{props.stat.value}</span>
        <Show when={collapsible()}>
          <span class="signal-uinfo__xstat-caret" aria-hidden="true">
            {triangle('down')}
          </span>
        </Show>
      </div>
      <Show when={open()}>
        <div class="signal-uinfo__xranks">
          <For each={props.panel}>
            {(stat) => (
              <>
                <span class="signal-uinfo__xranks-label">
                  {stat.label}
                  <Show when={stat.verifiedBadge}>
                    <VerifiedBadge />
                  </Show>
                </span>
                <span class="signal-uinfo__xranks-value signal-popover__num">{stat.value}</span>

                <span class="signal-uinfo__xranks-rank signal-popover__num">{stat.rank}</span>
              </>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

function XTotalMarks(props: { platforms: string[] }): JSX.Element {
  const cluster = () => buildPlatformCluster(props.platforms, X_TOTAL_MAX_MARKS);
  return (
    <Show when={cluster().icons.length > 0}>
      <span class="signal-uinfo__xmarks" aria-hidden="true">
        <For each={cluster().icons}>{(icon) => <img src={icon.src} alt="" />}</For>
        <Show when={cluster().overflow > 0}>
          <span class="signal-uinfo__xmarks-more">+{cluster().overflow}</span>
        </Show>
      </span>
    </Show>
  );
}

const X_TOTAL_MAX_MARKS = 3;

function TradingTotalCells(props: { totals: PopoverTotals }): JSX.Element {
  const direction = () => props.totals.allTimePnl?.direction;

  const account = () => props.totals.accountValue;
  const accountPlatforms = () => props.totals.accountValue?.platforms ?? props.totals.platforms;
  const pnlPlatforms = () => props.totals.allTimePnl?.platforms ?? props.totals.platforms;

  const arrow = () =>
    direction() === 'loss'
      ? ('down' as const)
      : direction() === 'gain'
        ? ('up' as const)
        : undefined;
  return (
    <>
      <div class="signal-uinfo__xstat">
        <div class="signal-uinfo__xstat-label">
          <span>{TOTAL_ACCOUNT_VALUE_LABEL}</span>
          <XTotalMarks platforms={accountPlatforms()} />
        </div>
        <div class="signal-uinfo__xstat-value">
          <Show when={account()} keyed>
            {(value) => <AccountSizeDots tier={value.tier} size={16} />}
          </Show>
          <span class="signal-uinfo__xstat-num signal-uinfo__xstat-num--plain signal-popover__num">
            {account()?.label ?? NO_TOTAL}
          </span>
        </div>
      </div>
      <div class="signal-uinfo__xstat">
        <div class="signal-uinfo__xstat-label">
          <span>{TOTAL_ALL_TIME_PNL_LABEL}</span>
          <XTotalMarks platforms={pnlPlatforms()} />
        </div>
        <div class="signal-uinfo__xstat-value">
          <Show when={arrow()} keyed>
            {(dir) => triangle(dir)}
          </Show>
          <span
            class="signal-uinfo__xstat-num signal-popover__num"
            classList={{
              'signal-uinfo__xstat-num--gain': direction() === 'gain',
              'signal-uinfo__xstat-num--loss': direction() === 'loss',
            }}
          >
            {props.totals.allTimePnl?.text ?? NO_TOTAL}
          </span>
        </div>
      </div>
    </>
  );
}

function XTab(props: { data: UserInfoData }): JSX.Element {
  let xtabEl: HTMLDivElement | undefined;

  const row = createMemo(() => buildXStatRow(props.data));

  const [tip, setTip] = createSignal<{
    name?: string;
    handle: string;
    left: number;
    top: number;
  } | null>(null);
  const showTip = (follower: TopSmartFollower, anchor: HTMLElement): void => {
    if (!xtabEl || !follower.username) return;
    const a = anchor.getBoundingClientRect();
    const root = xtabEl.getBoundingClientRect();
    setTip({
      name: follower.name,
      handle: follower.username,
      left: a.left - root.left + a.width / 2,
      top: a.top - root.top,
    });
  };
  const hideTip = (): void => {
    setTip(null);
  };
  return (
    <div class="signal-uinfo__xtab" ref={xtabEl}>
      <div class="signal-uinfo__xstats">
        <TotalSmartFollowersCell
          stat={row().total}
          panel={row().panel}
          hasHidden={row().hasHidden}
        />
        <For each={row().stats}>{(stat) => <SmartFollowerCell stat={stat} />}</For>
        <Show when={row().totals}>{(totals) => <TradingTotalCells totals={totals()} />}</Show>
      </div>
      <Show when={props.data.topSmartFollowers.length > 0}>
        <div class="signal-uinfo__xfollowers">
          {}
          <div class="signal-uinfo__xfollowers-label">Top Smart Followers</div>
          <div class="signal-uinfo__followers">
            <For each={props.data.topSmartFollowers}>
              {(follower) => (
                <TopFollowerAvatar follower={follower} onHover={showTip} onLeave={hideTip} />
              )}
            </For>
          </div>
        </div>
      </Show>
      <Show when={tip()}>
        {(t) => (
          <div
            class="signal-uinfo__follower-tip"
            style={{ left: `${t().left}px`, top: `${t().top}px` }}
          >
            <Show when={t().name}>
              <span class="signal-uinfo__follower-tip-name">{t().name}</span>
            </Show>
            <span class="signal-uinfo__follower-tip-handle">@{t().handle}</span>
          </div>
        )}
      </Show>
    </div>
  );
}

function Stat(props: { label: string; value: string; modifier?: 'loss' | 'gain' }): JSX.Element {
  return (
    <div class="signal-uinfo__stat">
      <div class="signal-uinfo__stat-label">{props.label}</div>
      <div
        class={`signal-uinfo__stat-value signal-popover__num${props.modifier ? ` signal-popover__value--${props.modifier}` : ''}`}
      >
        {props.value}
      </div>
    </div>
  );
}

function PositionsPanel(props: {
  open: boolean;
  count: number;
  platformLabel: string;
  platformUrl?: string;
  onClose: () => void;

  top?: JSX.Element;
  children: JSX.Element;

  headerDivider?: boolean;
}): JSX.Element {
  let panel: HTMLDivElement | undefined;
  onMount(() => {
    const stop = attachDismissWatcher(window, document, () => panel, {
      onOutsideClick: (event) => {
        if (!props.open) return;

        if (
          event
            .composedPath()
            .some(
              (n) =>
                n instanceof HTMLElement &&
                (n.classList.contains('signal-uinfo__postrigger') ||
                  n.classList.contains('signal-popover__chiprow')),
            )
        )
          return;
        props.onClose();
      },
    });
    onCleanup(stop);
  });
  return (
    <Show when={props.open}>
      <div class="signal-uinfo__pospop" ref={panel}>
        <div
          class={`signal-uinfo__pospop-head signal-popover__num${
            props.headerDivider ? ' signal-uinfo__pospop-head--divider' : ''
          }`}
        >
          <span>
            {props.platformLabel} <span class="signal-uinfo__pospop-count">{props.count}</span>
          </span>
          <button
            type="button"
            class="signal-uinfo__pospop-close"
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation();
              props.onClose();
            }}
          >
            <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M3.5 3.5l7 7M10.5 3.5l-7 7"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>

        {props.top}
        <a
          class="signal-uinfo__pospop-body"
          href={props.platformUrl}
          target={props.platformUrl ? '_blank' : undefined}
          rel={props.platformUrl ? 'noopener noreferrer' : undefined}
        >
          {props.children}
        </a>
        <a
          class="signal-uinfo__pospop-foot"
          href={props.platformUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {VIEW_IN_PROFILE_LABEL}
        </a>
      </div>
    </Show>
  );
}

function HyperliquidCompact(props: {
  data: HyperliquidSummary;
  expanded: boolean;
  period: string;
  selected: number;
  onSelect: (index: number) => void;
  onToggle: () => void;
  onClose: () => void;
  onSelectPeriod: (period: string) => void;
}): JSX.Element {
  const selectedChip = () =>
    props.data.accounts[Math.min(props.selected, props.data.accounts.length - 1)];

  const single = (): boolean => !props.data.aggregate && props.data.accounts.length === 1;

  const detail = createWalletDetail('hyperliquid', () =>
    props.expanded ? (selectedChip()?.address ?? null) : null,
  );
  const account = () => {
    const chip = selectedChip();
    return chip && withHyperliquidDetail(chip, detail());
  };
  const accountUrl = () => hyperliquidAddressUrl(account()?.address ?? null);
  return (
    <div class="signal-uinfo__cardwrap">
      <div class="signal-uinfo__card signal-uinfo__card--hyperliquid">
        <div class="signal-uinfo__cardtop">
          <div class="signal-uinfo__left">
            <div class="signal-uinfo__metrics-row signal-uinfo__metrics-row--stacked">
              <Stat
                label={props.data.aggregate ? GROUP_ACCOUNT_VALUE_LABEL : ACCOUNT_VALUE_LABEL}
                value={props.data.accountValue}
              />
              <Stat
                label={GROUP_UPNL_LABEL}
                value={props.data.upnl}
                modifier={props.data.upnlNegative ? 'loss' : 'gain'}
              />
            </div>
          </div>
          <div class="signal-uinfo__right">
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
              chartTone={props.data.profitLossNegative ? 'loss' : 'gain'}
              onSelectPeriod={props.onSelectPeriod}
            />
          </div>
        </div>
        <Show when={props.data.accounts.length > 0}>
          <AccountChipRow
            chips={hyperliquidChips(props.data.accounts)}
            selected={props.selected}
            expanded={props.expanded}
            onSelect={props.onSelect}
            onToggle={props.onToggle}
            toggleStyle="details"
          />
        </Show>
      </div>
      <PositionsPanel
        open={props.expanded && account() != null}
        count={account()?.positionsTotal ?? props.data.positionsTotal}
        platformLabel={PROTOCOL_LABEL.hyperliquid}
        platformUrl={accountUrl()}
        onClose={props.onClose}
        headerDivider
        top={
          <Show when={!single()}>
            <AccountChipRow
              chips={hyperliquidChips(props.data.accounts)}
              selected={props.selected}
              expanded
              onSelect={props.onSelect}
            />
            <div class="signal-uinfo__metrics-row signal-uinfo__metrics-row--wide">
              <Stat label={ACCOUNT_VALUE_LABEL} value={account()?.accountValue ?? NO_TOTAL} />
              <Stat
                label={GROUP_UPNL_LABEL}
                value={account()?.upnl ?? NO_TOTAL}
                modifier={account()?.upnlNegative ? 'loss' : 'gain'}
              />
              <Stat
                label={GROUP_PROFIT_LOSS_ALL_TIME_LABEL}
                value={account()?.profitLoss ?? NO_TOTAL}
                modifier={account()?.profitLossNegative ? 'loss' : 'gain'}
              />
            </div>
          </Show>
        }
      >
        <WalletDetailBody
          status={detail().status}
          hasDetail={account()?.hasDetail === true}
          rows={account()?.positions.length ?? 0}
          skeleton="hyperliquid-profile"
        >
          <HyperliquidPositionsTable positions={account()?.positions ?? []} />
        </WalletDetailBody>
      </PositionsPanel>
    </div>
  );
}

function PolymarketCompact(props: {
  data: PredictionSummary;
  expanded: boolean;
  selected: number;
  onSelect: (index: number) => void;
  onToggle: () => void;
  onClose: () => void;
}): JSX.Element {
  const selectedChip = () =>
    props.data.accounts[Math.min(props.selected, props.data.accounts.length - 1)];

  const single = (): boolean => !props.data.aggregate && props.data.accounts.length === 1;

  const detail = createWalletDetail('polymarket', () =>
    props.expanded ? (selectedChip()?.address ?? null) : null,
  );
  const account = () => {
    const chip = selectedChip();
    return chip && withPolymarketDetail(chip, detail());
  };
  const accountUrl = () => {
    const handle = account()?.profileHandle;
    return handle == null ? undefined : polymarketProfileUrl(handle);
  };
  return (
    <div class="signal-uinfo__cardwrap">
      <div class="signal-uinfo__card">
        <div class="signal-uinfo__metrics-row signal-uinfo__metrics-row--wide">
          <Stat label={POSITIONS_VALUE_LABEL} value={props.data.positionsValue} />
          <Stat
            label={PROFIT_LOSS_ALL_TIME_LABEL}
            value={props.data.profitLoss}
            modifier={props.data.profitLossNegative ? 'loss' : 'gain'}
          />
          <Stat label={PREDICTIONS_LABEL} value={props.data.predictions} />
        </div>
        <Show when={props.data.accounts.length > 0}>
          <AccountChipRow
            chips={polymarketChips(props.data.accounts)}
            selected={props.selected}
            expanded={props.expanded}
            onSelect={props.onSelect}
            onToggle={props.onToggle}
            toggleStyle="details"
          />
        </Show>
      </div>
      <PositionsPanel
        open={props.expanded && account() != null}
        count={account()?.positionsTotal ?? props.data.positionsTotal}
        platformLabel={PROTOCOL_LABEL.polymarket}
        platformUrl={accountUrl()}
        onClose={props.onClose}
        top={
          <Show when={!single()}>
            <AccountChipRow
              chips={polymarketChips(props.data.accounts)}
              selected={props.selected}
              expanded
              onSelect={props.onSelect}
            />
            <div class="signal-uinfo__metrics-row signal-uinfo__metrics-row--wide">
              <Stat label={POSITIONS_VALUE_LABEL} value={account()?.positionsValue ?? NO_TOTAL} />
              <Stat
                label={PROFIT_LOSS_ALL_TIME_LABEL}
                value={account()?.profitLoss ?? NO_TOTAL}
                modifier={account()?.profitLossNegative ? 'loss' : 'gain'}
              />
              <Stat label={PREDICTIONS_LABEL} value={account()?.predictions ?? NO_TOTAL} />
            </div>
          </Show>
        }
      >
        <WalletDetailBody
          status={detail().status}
          hasDetail={account()?.hasDetail === true}
          rows={account()?.markets.length ?? 0}
          skeleton="polymarket-profile"
        >
          <MarketTable markets={account()?.markets ?? []} />
        </WalletDetailBody>
      </PositionsPanel>
    </div>
  );
}

function UserInfoModule(props: { data: UserInfoData }): JSX.Element {
  const tabs = (): Tab[] => {
    const list: Tab[] = ['x'];
    if (props.data.hyperliquid) list.push('hyperliquid');
    if (props.data.polymarket) list.push('polymarket');
    return list;
  };

  const tabCount = (tab: Tab): number | undefined => {
    if (tab === 'x') return undefined;
    return props.data[tab]?.positionsTotal;
  };
  const [activeTab, setActiveTab] = createSignal<Tab>(tabs()[0] ?? 'x');
  const [expanded, setExpanded] = createSignal(false);

  const [selected, setSelected] = createSignal<Record<'hyperliquid' | 'polymarket', number>>({
    hyperliquid: 0,
    polymarket: 0,
  });
  const [periods, setPeriods] = createSignal<{
    hyperliquid: string;
    polymarket: string;
  }>({
    hyperliquid: 'ALL',
    polymarket: 'ALL',
  });

  const selectTab = (tab: Tab): void => {
    if (tab === activeTab()) return;
    setActiveTab(tab);
    setExpanded(false);
  };
  const selectPeriod = (card: 'hyperliquid' | 'polymarket', period: string): void => {
    setPeriods((prev) => (prev[card] === period ? prev : { ...prev, [card]: period }));
  };
  const toggleExpanded = (): void => {
    setExpanded((prev) => !prev);
  };

  const selectAccount = (card: 'hyperliquid' | 'polymarket', index: number): void => {
    setSelected((prev) => ({ ...prev, [card]: index }));
    setExpanded(true);
  };

  return (
    <>
      {}
      <div class="signal-uinfo__tabbar">
        <div class="signal-uinfo__tabs">
          <For each={tabs()}>
            {(tab) => (
              <TabButton
                tab={tab}
                active={tab === activeTab()}
                count={tabCount(tab)}
                onClick={() => selectTab(tab)}
              />
            )}
          </For>
        </div>
        <span class="signal-uinfo__logo">{kaitoLockup()}</span>
      </div>
      <div class="signal-uinfo__body">
        <Switch fallback={<XTab data={props.data} />}>
          <Match when={activeTab() === 'hyperliquid' && props.data.hyperliquid}>
            {(hl) => (
              <HyperliquidCompact
                data={hl()}
                expanded={expanded()}
                period={periods().hyperliquid}
                selected={selected().hyperliquid}
                onSelect={(i) => selectAccount('hyperliquid', i)}
                onToggle={toggleExpanded}
                onClose={() => setExpanded(false)}
                onSelectPeriod={(p) => selectPeriod('hyperliquid', p)}
              />
            )}
          </Match>
          <Match when={activeTab() === 'polymarket' && props.data.polymarket}>
            {(pm) => (
              <PolymarketCompact
                data={pm()}
                expanded={expanded()}
                selected={selected().polymarket}
                onSelect={(i) => selectAccount('polymarket', i)}
                onToggle={toggleExpanded}
                onClose={() => setExpanded(false)}
              />
            )}
          </Match>
        </Switch>
      </div>
    </>
  );
}

export function createUserInfoModule(data: UserInfoData): UserInfoHandle {
  const { host, shadow } = createShadowHost([popoverCss, uinfoCss], 'signal-uinfo-host');
  host.setAttribute(PROFILE_ATTRS.USER_INFO_FLAG, '');

  const root = document.createElement('div');
  root.className = 'signal-uinfo';

  if (hostPrefersDark(document)) root.classList.add('signal-uinfo--dark');

  const dispose = render(() => <UserInfoModule data={data} />, root);
  shadow.appendChild(root);

  return {
    root: host,
    destroy: () => {
      dispose();
      host.remove();
    },
  };
}
