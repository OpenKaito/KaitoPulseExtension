import { Show, For, type Accessor, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import type {
  HyperliquidSummary,
  PerpPosition,
  PredictionMarket,
  PredictionSummary,
  SignalProfileSnapshot,
} from "../types";
import { chevron, kaitoLockup, protocolChip } from "./icons";
import { hyperliquidAddressUrl } from "./links";
import { ChartGroup } from "./chart";
import { AvatarImage, MarketIcon, UserAvatarImage } from "./images";
import { StickyShadowCard } from "./scroll-shadow";
import {
  ACCOUNT_VALUE_LABEL,
  POSITIONS_VALUE_LABEL,
  PREDICTIONS_LABEL,
  PROFIT_LOSS_ALL_TIME_LABEL,
  UPNL_LABEL,
  VIEW_IN_PROFILE_LABEL,
} from "./stat-labels";

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

export function Metric(props: { label: string; value: string; modifier?: "loss" | "gain" | "liq" }): JSX.Element {
  return (
    <div class="signal-popover__metric">
      <div class="signal-popover__metric-label">{props.label}</div>
      <div
        class={`signal-popover__metric-value signal-popover__num${
          props.modifier ? ` signal-popover__value--${props.modifier}` : ""
        }`}
      >
        {props.value}
      </div>
    </div>
  );
}

export const POSITIONS_DISPLAY_CAP = 3;

export function formatPositionsCount(total: number, cap: number = POSITIONS_DISPLAY_CAP): string {
  return total > cap ? `${cap} of ${total}` : `${total}`;
}

export function PositionsFooter(props: {
  total: number;
  expanded: boolean;
  platformUrl?: string;
  onToggle: () => void;
}): JSX.Element | null {
  if (props.total <= 0) return null;
  return (
    <Show
      when={props.expanded}
      fallback={
        <div
          class="signal-popover__footer"
          role="button"
          aria-expanded={false}
          onClick={props.onToggle}
        >
          <span class="signal-popover__footer-dot" />
          {}
          <span class="signal-popover__footer-count signal-popover__num">
            <Show when={props.total > POSITIONS_DISPLAY_CAP}>Showing </Show>
            <span class="signal-popover__footer-strong">{formatPositionsCount(props.total)}</span> positions
          </span>
          {chevron("down")}
        </div>
      }
    >
      <div class="signal-popover__footer signal-popover__footer--expanded">
        <span
          class="signal-popover__footer-collapse"
          role="button"
          aria-expanded
          onClick={props.onToggle}
        >
          Collapse {chevron("down")}
        </span>
        <a
          class="signal-popover__footer-viewall"
          href={props.platformUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {VIEW_IN_PROFILE_LABEL}
        </a>
      </div>
    </Show>
  );
}

function lossGainClass(negative: boolean): string {
  return negative ? "signal-popover__value--loss" : "signal-popover__value--gain";
}

function upDownClass(negative: boolean): string {
  return negative ? "signal-popover__change--down" : "signal-popover__change--up";
}

function PerpPositionTokenCell(props: { pos: PerpPosition; cellClass: string }): JSX.Element {
  return (
    <div class={props.cellClass}>
      <MarketIcon url={props.pos.iconUrl} size={16} />
      <span>{props.pos.pair}</span>
    </div>
  );
}

export function PositionsTable(props: { positions: PerpPosition[] }): JSX.Element {
  return (
    <div class="signal-popover__postable-scroll">
      <div class="signal-popover__postable" role="table">
        <For each={["Token", "Side", "Lev.", "Amount", "Entry", "Price", "PnL", "Funding", "Liq."]}>
          {(head) => <div class="signal-popover__postable-head">{head}</div>}
        </For>
        <For each={props.positions}>
          {(pos) => (
            <>
              <PerpPositionTokenCell
                pos={pos}
                cellClass="signal-popover__postable-cell signal-popover__postable-token"
              />
              <div class={`signal-popover__postable-cell ${lossGainClass(pos.side === "Short")}`}>
                {pos.side.toUpperCase()}
              </div>
              <div class="signal-popover__postable-cell">{pos.leverage}</div>
              <div class="signal-popover__postable-cell signal-popover__num">{pos.size}</div>
              <div class="signal-popover__postable-cell signal-popover__num">{pos.entry}</div>
              <div class={`signal-popover__postable-cell signal-popover__num${pos.markNegative ? " signal-popover__value--loss" : ""}`}>
                {pos.mark}
              </div>
              <div class={`signal-popover__postable-cell signal-popover__num ${lossGainClass(pos.pnlNegative)}`}>
                {pos.pnl}
              </div>
              <div class="signal-popover__postable-cell signal-popover__num">{pos.funding}</div>
              <div class="signal-popover__postable-cell signal-popover__num">{pos.liqPrice}</div>
            </>
          )}
        </For>
      </div>
    </div>
  );
}

export function HyperliquidPositionsTable(props: { positions: PerpPosition[] }): JSX.Element {
  return (
    <div class="signal-uinfo__hltable-scroll">
      <div class="signal-uinfo__hltable" role="table">
        <For
          each={[
            { label: "Token", right: false },
            { label: "Side", right: false },
            { label: "Lev.", right: true },
            { label: "Entry", right: true },
            { label: "Margin", right: true },
            { label: "Liq Price", right: true },
            { label: "Size", right: true },
            { label: "Mark", right: true },
            { label: "PnL", right: true },
            { label: "Funding", right: true },
          ]}
        >
          {(col) => (
            <div class={`signal-uinfo__hltable-head${col.right ? " signal-uinfo__hltable-head--right" : ""}`}>
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
              <div class={`signal-uinfo__hltable-cell ${lossGainClass(pos.side === "Short")}`}>
                {pos.side.toUpperCase()}
              </div>
              <div class="signal-uinfo__hltable-cell signal-uinfo__hltable-cell--right">{pos.leverage}</div>
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
  );
}

function CardHeadLink(props: { href?: string; children: JSX.Element }): JSX.Element {
  return (
    <Dynamic
      component={props.href ? "a" : "div"}
      class={`signal-popover__card-head${props.href ? " signal-popover__card-head--link" : ""}`}
      href={props.href}
      target={props.href ? "_blank" : undefined}
      rel={props.href ? "noopener noreferrer" : undefined}
    >
      {props.children}
    </Dynamic>
  );
}

export function HyperliquidCard(props: {
  data: HyperliquidSummary;
  expanded: boolean;
  period: string;
  onToggle: () => void;
  onSelectPeriod: (period: string) => void;
}): JSX.Element {

  const positions = () => (props.expanded ? props.data.positions.slice(0, POSITIONS_DISPLAY_CAP) : []);
  const platformUrl = hyperliquidAddressUrl(props.data.address);
  return (
    <StickyShadowCard class="signal-popover__card signal-popover__card--hyperliquid">
      <div class="signal-popover__card-top">
        {}
        <CardHeadLink href={platformUrl}>
          <div class="signal-popover__addr-row">
            <span class="signal-popover__addr">{props.data.address}</span>
          </div>
          {protocolChip("hyperliquid")}
        </CardHeadLink>
        <div class="signal-popover__summary">
          <div class="signal-popover__metrics">
            <Metric label={ACCOUNT_VALUE_LABEL} value={props.data.accountValue} />
            <Metric label={UPNL_LABEL} value={props.data.upnl} modifier={props.data.upnlNegative ? "loss" : "gain"} />
          </div>
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
      <Show when={positions().length > 0}>
        <PositionsTable positions={positions()} />
      </Show>
      <PositionsFooter
        total={props.data.positionsTotal}
        expanded={props.expanded}
        platformUrl={platformUrl}
        onToggle={props.onToggle}
      />
    </StickyShadowCard>
  );
}

export function PolymarketCard(props: {
  data: PredictionSummary;
  expanded: boolean;
  onToggle: () => void;
}): JSX.Element {
  const platformUrl = props.data.name
    ? `https://polymarket.com/@${encodeURIComponent(props.data.name)}`
    : undefined;
  return (
    <StickyShadowCard class="signal-popover__card signal-popover__card--polymarket">
      <div class="signal-popover__card-top">
        <CardHeadLink href={platformUrl}>
          <div class="signal-popover__profile">
            <AvatarImage url={props.data.avatarUrl} />
            <div class="signal-popover__profile-text">
              <div class="signal-popover__profile-namerow">
                <div class="signal-popover__profile-name">{props.data.name}</div>
                <div class="signal-popover__profile-meta">{props.data.meta}</div>
              </div>
              <div class="signal-popover__bio-line">{props.data.bio}</div>
            </div>
          </div>
          {protocolChip("polymarket")}
        </CardHeadLink>
        {}
        <div class="signal-popover__statrow">
          <Metric label={POSITIONS_VALUE_LABEL} value={props.data.positionsValue} />
          <Metric
            label={PROFIT_LOSS_ALL_TIME_LABEL}
            value={props.data.profitLoss}
            modifier={props.data.profitLossNegative ? "loss" : "gain"}
          />
          <Metric label={PREDICTIONS_LABEL} value={props.data.predictions} />
        </div>
      </div>
      <Show when={props.expanded}>
        <div class="signal-popover__divider-h" />
        <OutcomeMarketList markets={props.data.markets.slice(0, POSITIONS_DISPLAY_CAP)} />
      </Show>
      <PositionsFooter
        total={props.data.positionsTotal}
        expanded={props.expanded}
        platformUrl={platformUrl}
        onToggle={props.onToggle}
      />
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
          <span class={`signal-popover__pmpill signal-popover__pmpill--${props.market.outcomeYes ? "yes" : "no"}`}>
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

function MarketValueCell(props: { value: string; altRow?: boolean; children: JSX.Element }): JSX.Element {
  return (
    <div class={`signal-popover__market-valcell${props.altRow ? " signal-popover__market-cell--alt" : ""}`}>
      <div class="signal-popover__market-value signal-popover__num">{props.value}</div>
      {props.children}
    </div>
  );
}

export function MarketTable(props: { markets: PredictionMarket[] }): JSX.Element {
  return (
    <div class="signal-popover__market">
      <div class="signal-popover__market-col signal-popover__market-col--name">
        <div class="signal-popover__market-head signal-popover__market-head--left">Market</div>
        <For each={props.markets}>
          {(m, i) => (
            <div class={`signal-popover__market-cell${i() % 2 === 1 ? " signal-popover__market-cell--alt" : ""}`}>
              <MarketNameCell market={m} iconSize={24} />
            </div>
          )}
        </For>
      </div>
      <div class="signal-popover__market-col signal-popover__market-col--value">
        <div class="signal-popover__market-head signal-popover__market-head--right">Value</div>
        <For each={props.markets}>
          {(m, i) => (
            <MarketValueCell value={m.value} altRow={i() % 2 === 1}>
              <div class={`signal-popover__market-change signal-popover__num ${upDownClass(m.changeNegative)}`}>
                {m.change}
              </div>
            </MarketValueCell>
          )}
        </For>
      </div>
    </div>
  );
}

export function OutcomeMarketList(props: { markets: PredictionMarket[] }): JSX.Element {
  return (
    <div class="signal-popover__pmlist">
      <div class="signal-popover__pmlist-head">
        <div class="signal-popover__market-head signal-popover__market-head--left">Market</div>
        <div class="signal-popover__market-head signal-popover__market-head--right">Value</div>
      </div>
      <For each={props.markets}>
        {(m, i) => (
          <div class={`signal-popover__market-cell${i() % 2 === 1 ? " signal-popover__market-cell--alt" : ""}`}>
            <MarketNameCell market={m} />
            <MarketValueCell value={m.value}>
              <div class={`signal-popover__market-change signal-popover__num ${upDownClass(m.changeNegative)}`}>
                {m.change}
              </div>
            </MarketValueCell>
          </div>
        )}
      </For>
    </div>
  );
}
