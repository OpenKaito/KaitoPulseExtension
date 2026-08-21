import { createSignal, Show, Switch, Match, For, onMount, onCleanup, type JSX } from "solid-js";
import { render } from "solid-js/web";
import type {
  HyperliquidSummary,
  PredictionSummary,
  SmartFollowerStat,
  TopSmartFollower,
  UserInfoData,
} from "../types";
import { PROFILE_ATTRS } from "./profile-dom";
import { TOTAL_SMART_FOLLOWERS_LABEL } from "../social-card-map";
import { PROTOCOL_ICON_DATA_URI, PROTOCOL_LABEL } from "../protocol-icons";
import { checkIcon, kaitoLockup, chevron } from "../shared/icons";
import { hostPrefersDark } from "../host-theme";
import { ChartGroup } from "../shared/chart";
import {
  formatPositionsCount,
  HyperliquidPositionsTable,
  MarketTable,
  POSITIONS_DISPLAY_CAP,
} from "../shared/cards";
import { hyperliquidAddressUrl } from "../shared/links";
import { AvatarImage, RemoteImg } from "../shared/images";
import { ScrollShadowRegion } from "../shared/scroll-shadow";
import { attachDismissWatcher } from "../shared/dismiss";
import {
  ACCOUNT_VALUE_LABEL,
  POSITIONS_VALUE_LABEL,
  PREDICTIONS_LABEL,
  PROFIT_LOSS_ALL_TIME_LABEL,
  UPNL_LABEL,
  VIEW_IN_PROFILE_LABEL,
} from "../shared/stat-labels";

const EXPANDED_LIST_MAX_HEIGHT = 170;
import popoverCss from "../name-tag-popover.css?inline";
import uinfoCss from "./user-info-module.css?inline";
import { createShadowHost } from "../shared/shadow-host";

type Tab = "x" | "hyperliquid" | "polymarket";

const TAB_ICON: Record<Exclude<Tab, "x">, string> = {
  hyperliquid: PROTOCOL_ICON_DATA_URI.hyperliquid,
  polymarket: PROTOCOL_ICON_DATA_URI.polymarket,
};
const TAB_LABEL: Record<Exclude<Tab, "x">, string> = {
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
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      class={`signal-uinfo__tab${props.active ? " signal-uinfo__tab--active" : ""}`}
      onClick={props.onClick}
      aria-label={props.tab === "x" ? "X" : undefined}
    >
      <Show
        when={props.tab !== "x"}
        fallback={<span class="signal-uinfo__tab-x" innerHTML={X_ICON} />}
      >
        <img
          class="signal-uinfo__tab-icon"
          src={TAB_ICON[props.tab as Exclude<Tab, "x">]}
          alt=""
          width={14}
          height={14}
          draggable={false}
        />
        <span>{TAB_LABEL[props.tab as Exclude<Tab, "x">]}</span>
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

function SmartFollowerCell(props: { stat: SmartFollowerStat }): JSX.Element {
  return (
    <div class="signal-uinfo__xstat">
      <div class="signal-uinfo__xstat-label">{props.stat.label}</div>
      <div class="signal-uinfo__xstat-value">
        <span class="signal-uinfo__xstat-num signal-popover__num">
          {props.stat.value}
        </span>
        <Show when={props.stat.rank}>
          {(rank) => (
            <span class="signal-uinfo__xstat-rank signal-popover__num">
              {rank()}
            </span>
          )}
        </Show>
      </div>
    </div>
  );
}

function XTab(props: { data: UserInfoData }): JSX.Element {
  let xtabEl: HTMLDivElement | undefined;

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
        <Show
          when={props.data.smartFollowers.length > 0}
          fallback={
            <SmartFollowerCell
              stat={{ label: TOTAL_SMART_FOLLOWERS_LABEL, value: "N/A" }}
            />
          }
        >
          <For each={props.data.smartFollowers}>
            {(stat) => <SmartFollowerCell stat={stat} />}
          </For>
        </Show>
      </div>
      <Show when={props.data.topSmartFollowers.length > 0}>
        <div class="signal-uinfo__xfollowers">
          {}
          <div class="signal-uinfo__xfollowers-label">Recent Smart Followers</div>
          <div class="signal-uinfo__followers">
            <For each={props.data.topSmartFollowers}>
              {(follower) => (
                <TopFollowerAvatar
                  follower={follower}
                  onHover={showTip}
                  onLeave={hideTip}
                />
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

function Stat(props: {
  label: string;
  value: string;
  modifier?: "loss" | "gain";
}): JSX.Element {
  return (
    <div class="signal-uinfo__stat">
      <div class="signal-uinfo__stat-label">{props.label}</div>
      <div
        class={`signal-uinfo__stat-value signal-popover__num${props.modifier ? ` signal-popover__value--${props.modifier}` : ""}`}
      >
        {props.value}
      </div>
    </div>
  );
}

function PositionsTrigger(props: {
  count: number;
  open: boolean;
  onToggle: () => void;
}): JSX.Element | null {
  if (props.count <= 0) return null;
  return (
    <div
      class={`signal-uinfo__postrigger${props.open ? " signal-uinfo__postrigger--open" : ""}`}
      role="button"
      aria-expanded={props.open}
      onClick={(e) => {
        e.stopPropagation();
        props.onToggle();
      }}
    >
      <span class="signal-uinfo__postrigger-dot" />
      <span class="signal-uinfo__postrigger-count signal-popover__num">
        {props.count > POSITIONS_DISPLAY_CAP ? "Showing " : ""}
        {formatPositionsCount(props.count)}{" "}
        <span>positions</span>
      </span>
      {chevron("right")}
    </div>
  );
}

function PositionsPanel(props: {
  open: boolean;
  count: number;
  platformLabel: string;
  platformUrl?: string;
  onClose: () => void;
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
            .some((n) => n instanceof HTMLElement && n.classList.contains("signal-uinfo__postrigger"))
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
            props.headerDivider ? " signal-uinfo__pospop-head--divider" : ""
          }`}
        >
          <span>
            {formatPositionsCount(props.count)}{" "}
            {props.platformLabel} Positions
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
        <a
          class="signal-uinfo__pospop-body"
          href={props.platformUrl}
          target={props.platformUrl ? "_blank" : undefined}
          rel={props.platformUrl ? "noopener noreferrer" : undefined}
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
  onToggle: () => void;
  onClose: () => void;
  onSelectPeriod: (period: string) => void;
}): JSX.Element {
  return (
    <div class="signal-uinfo__cardwrap">
      <ScrollShadowRegion
        maxHeight={EXPANDED_LIST_MAX_HEIGHT}
        class="signal-uinfo__card"
      >
        <div class="signal-uinfo__cardtop">
          <div class="signal-uinfo__left">
            <div class="signal-uinfo__cardhead">
              <div class="signal-uinfo__cardhead-label">Portfolio</div>
              <div class="signal-uinfo__addr-row">
                <a
                  class="signal-uinfo__addr"
                  href={hyperliquidAddressUrl(props.data.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {props.data.addressShort}
                </a>
                <span
                  class="signal-uinfo__verified"
                  aria-label="On-chain confirmed"
                >
                  {checkIcon()}
                </span>
              </div>
            </div>
            <div class="signal-uinfo__metrics-row">
              <Stat label={ACCOUNT_VALUE_LABEL} value={props.data.accountValue} />
              <Stat
                label={UPNL_LABEL}
                value={props.data.upnl}
                modifier={props.data.upnlNegative ? "loss" : "gain"}
              />
            </div>
          </div>
          <div class="signal-uinfo__right">
            <ChartGroup
              charts={props.data.charts}
              selected={props.period}
              card="hyperliquid"
              wide
              pnlLabel={PROFIT_LOSS_ALL_TIME_LABEL}
              pnlValue={props.data.profitLoss}
              pnlValueModifier={props.data.profitLossNegative ? "loss" : "gain"}
              onSelectPeriod={props.onSelectPeriod}
            />
          </div>
        </div>
        <PositionsTrigger
          count={props.data.positionsTotal}
          open={props.expanded}
          onToggle={props.onToggle}
        />
      </ScrollShadowRegion>
      <PositionsPanel
        open={props.expanded}
        count={props.data.positionsTotal}
        platformLabel="Hyperliquid"
        platformUrl={hyperliquidAddressUrl(props.data.address)}
        onClose={props.onClose}
        headerDivider
      >
        <HyperliquidPositionsTable positions={props.data.positions.slice(0, POSITIONS_DISPLAY_CAP)} />
      </PositionsPanel>
    </div>
  );
}

function PolymarketCompact(props: {
  data: PredictionSummary;
  expanded: boolean;
  period: string;
  onToggle: () => void;
  onClose: () => void;
  onSelectPeriod: (period: string) => void;
}): JSX.Element {
  return (
    <div class="signal-uinfo__cardwrap">
      <ScrollShadowRegion
        maxHeight={EXPANDED_LIST_MAX_HEIGHT}
        class="signal-uinfo__card"
      >
        <div class="signal-uinfo__cardtop">
          <div class="signal-uinfo__left">
            <div class="signal-uinfo__cardhead">
              <div class="signal-uinfo__profile-row">
                <AvatarImage url={props.data.avatarUrl} />
                <div class="signal-uinfo__profile-text">
                  <Show
                    when={props.data.name}
                    fallback={
                      <div class="signal-uinfo__profile-name">
                        {props.data.name}
                      </div>
                    }
                  >
                    {(name) => (
                      <a
                        class="signal-uinfo__profile-name signal-uinfo__profile-name--link"
                        href={`https://polymarket.com/@${encodeURIComponent(name())}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {name()}
                      </a>
                    )}
                  </Show>
                  <div class="signal-uinfo__profile-meta">
                    {props.data.meta}
                  </div>
                </div>
              </div>
              <div class="signal-uinfo__bio-line">{props.data.bio}</div>
            </div>
            <div class="signal-uinfo__metrics-row">
              <Stat label={POSITIONS_VALUE_LABEL} value={props.data.positionsValue} />
              <Stat label={PREDICTIONS_LABEL} value={props.data.predictions} />
            </div>
          </div>
          <div class="signal-uinfo__right">
            <ChartGroup
              charts={props.data.charts}
              selected={props.period}
              card="polymarket"
              wide
              pnlLabel={PROFIT_LOSS_ALL_TIME_LABEL}
              pnlValue={props.data.profitLoss}
              pnlValueModifier={props.data.profitLossNegative ? "loss" : "gain"}
              onSelectPeriod={props.onSelectPeriod}
            />
          </div>
        </div>
        <PositionsTrigger
          count={props.data.positionsTotal}
          open={props.expanded}
          onToggle={props.onToggle}
        />
      </ScrollShadowRegion>
      <PositionsPanel
        open={props.expanded}
        count={props.data.positionsTotal}
        platformLabel="Polymarket"
        platformUrl={
          props.data.name
            ? `https://polymarket.com/@${encodeURIComponent(props.data.name)}`
            : undefined
        }
        onClose={props.onClose}
      >
        <MarketTable markets={props.data.markets.slice(0, POSITIONS_DISPLAY_CAP)} />
      </PositionsPanel>
    </div>
  );
}

function UserInfoModule(props: { data: UserInfoData }): JSX.Element {
  const tabs = (): Tab[] => {
    const list: Tab[] = ["x"];
    if (props.data.hyperliquid) list.push("hyperliquid");
    if (props.data.polymarket) list.push("polymarket");
    return list;
  };
  const [activeTab, setActiveTab] = createSignal<Tab>(tabs()[0] ?? "x");
  const [expanded, setExpanded] = createSignal(false);
  const [periods, setPeriods] = createSignal<{
    hyperliquid: string;
    polymarket: string;
  }>({
    hyperliquid: "ALL",
    polymarket: "ALL",
  });

  const selectTab = (tab: Tab): void => {
    if (tab === activeTab()) return;
    setActiveTab(tab);
    setExpanded(false);
  };
  const selectPeriod = (
    card: "hyperliquid" | "polymarket",
    period: string,
  ): void => {
    setPeriods((prev) =>
      prev[card] === period ? prev : { ...prev, [card]: period },
    );
  };
  const toggleExpanded = (): void => {
    setExpanded((prev) => !prev);
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
                onClick={() => selectTab(tab)}
              />
            )}
          </For>
        </div>
        <span class="signal-uinfo__logo">{kaitoLockup()}</span>
      </div>
      <div class="signal-uinfo__body">
        <Switch fallback={<XTab data={props.data} />}>
          <Match when={activeTab() === "hyperliquid" && props.data.hyperliquid}>
            {(hl) => (
              <HyperliquidCompact
                data={hl()}
                expanded={expanded()}
                period={periods().hyperliquid}
                onToggle={toggleExpanded}
                onClose={() => setExpanded(false)}
                onSelectPeriod={(p) => selectPeriod("hyperliquid", p)}
              />
            )}
          </Match>
          <Match when={activeTab() === "polymarket" && props.data.polymarket}>
            {(pm) => (
              <PolymarketCompact
                data={pm()}
                expanded={expanded()}
                period={periods().polymarket}
                onToggle={toggleExpanded}
                onClose={() => setExpanded(false)}
                onSelectPeriod={(p) => selectPeriod("polymarket", p)}
              />
            )}
          </Match>
        </Switch>
      </div>
    </>
  );
}

export function createUserInfoModule(data: UserInfoData): UserInfoHandle {
  const { host, shadow } = createShadowHost(
    [popoverCss, uinfoCss],
    "signal-uinfo-host",
  );
  host.setAttribute(PROFILE_ATTRS.USER_INFO_FLAG, "");

  const root = document.createElement("div");
  root.className = "signal-uinfo";

  if (hostPrefersDark(document)) root.classList.add("signal-uinfo--dark");

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
