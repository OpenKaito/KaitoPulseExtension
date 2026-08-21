import { For, Show, type Component } from 'solid-js';
import { compact, exact, rankOrNA, rankPercent, todayIso } from './format';
import { buildHeatmapLayout } from './heatmap';
import { Sparkline, type SparklineVariant } from './Sparkline';
import { SCOPE_COPY, TEAL_HEATMAP_COLORS } from './theme';
import type { MindshareStats, SharePoint, SmartFollowersStats, SocialCardData } from './view-model';

const SPARKLINE_VARIANT: Record<SocialCardData['scope'], SparklineVariant> = {
  crypto: 'gray',
  ai: 'color',
  trading: 'blue',
};

const KpiCell: Component<{ label: string; value: string; highlighted?: boolean }> = (props) => (
  <div class="sc-kpi__cell" classList={{ 'sc-kpi__cell--hi': props.highlighted }}>
    <div class="sc-kpi__label">{props.label}</div>
    <div class="sc-kpi__value">{props.value}</div>
  </div>
);

const KpiRow: Component<{ data: SocialCardData }> = (props) => (
  <div class="sc-kpi">
    <KpiCell label="Total followers" value={compact(props.data.totalFollowers)} highlighted />
    <KpiCell label="total smart followers" value={exact(props.data.smartFollowers)} />
    <KpiCell label="Impressions" value={compact(props.data.impressions)} highlighted />
    <KpiCell label="Smart engagements" value={compact(props.data.smartEngagements)} />
  </div>
);

const ActivityHeatmap: Component<{ data: SocialCardData }> = (props) => {
  const layout = () => buildHeatmapLayout(props.data.dailyEngagements);
  const title = () => `${SCOPE_COPY[props.data.scope].label} Smart Engagement Activity`;

  return (
    <div class="sc-heat">
      <div class="sc-heat__head">
        <span class="sc-heat__title">{title()}</span>
        <div class="sc-heat__legend">
          <span>Less</span>
          <div class="sc-heat__swatches">
            <For each={TEAL_HEATMAP_COLORS}>
              {(color) => <span style={{ background: color, width: '8px', height: '8px' }} />}
            </For>
          </div>
          <span>More</span>
        </div>
      </div>
      <div class="sc-heat__grid">
        <For each={layout().grid}>
          {(col, w) => (
            <For each={col}>
              {(cell, r) => (
                <div
                  style={{
                    'grid-column': String(w() + 1),
                    'grid-row': String(r() + 1),

                    background: TEAL_HEATMAP_COLORS[cell?.intensity ?? 0],
                  }}
                />
              )}
            </For>
          )}
        </For>
      </div>
      <div class="sc-heat__months">
        <For each={layout().months}>
          {(month) => (
            <span style={{ 'grid-column': `${month.startCol + 1} / ${month.endCol + 1}` }}>{month.label}</span>
          )}
        </For>
      </div>
    </div>
  );
};

interface StatBlockProps {
  idPrefix: string;
  variant: SparklineVariant;
  primaryLabel: string;

  primaryBoldPart: string;

  primaryLabelSmall?: boolean;
  primaryValue: string;
  primarySub?: string;
  rankValue: string;

  rankBadge?: string;
  rankSub?: string;
  topValue: string;
  topSub: string;
  series: SharePoint[];
}

function splitBold(label: string, boldPart: string): [string, string, string] {
  const at = label.toLowerCase().indexOf(boldPart.toLowerCase());
  if (at < 0) return [label, '', ''];
  return [label.slice(0, at), label.slice(at, at + boldPart.length), label.slice(at + boldPart.length)];
}

const StatBlock: Component<StatBlockProps> = (props) => {
  const parts = () => splitBold(props.primaryLabel, props.primaryBoldPart);

  return (
    <div class="sc-stat">
      <div class="sc-stat__left">
        <div class="sc-stat__cell">
          <p class="sc-stat__label" classList={{ 'sc-stat__label--sm': props.primaryLabelSmall }}>
            {parts()[0]}
            <b>{parts()[1]}</b>
            {parts()[2]}
          </p>
          <p class="sc-stat__value">{props.primaryValue}</p>
          <Show when={props.primarySub}>
            <p class="sc-stat__sub">{props.primarySub}</p>
          </Show>
        </div>
        <div class="sc-stat__spark">
          <Sparkline data={props.series} variant={props.variant} idPrefix={props.idPrefix} />
        </div>
      </div>

      <div class="sc-stat__right">
        <div class="sc-stat__cell">
          <p class="sc-stat__label">historical highest rank</p>
          <div class="sc-stat__valueRow">
            <p class="sc-stat__value">{props.rankValue}</p>
            <Show when={props.rankBadge}>
              <span class="sc-stat__badge">{props.rankBadge}</span>
            </Show>
          </div>
          <Show when={props.rankSub}>
            <p class="sc-stat__sub">{props.rankSub}</p>
          </Show>
        </div>
        <div class="sc-stat__divider" aria-hidden="true" style={{ width: '137px', height: '1px' }} />
        <div class="sc-stat__cell sc-stat__cell--top">
          <p class="sc-stat__label">Top</p>
          <p class="sc-stat__value">{props.topValue}</p>
          <p class="sc-stat__sub">{props.topSub}</p>
        </div>
      </div>
    </div>
  );
};

const SmartFollowersStatBlock: Component<{
  scope: SocialCardData['scope'];
  total: number;
  stats: SmartFollowersStats;
}> = (props) => {
  const word = () => SCOPE_COPY[props.scope].labelWord;
  const hasRank = () => props.stats.highestRank > 0;
  return (
    <StatBlock
      idPrefix="sf"
      variant={SPARKLINE_VARIANT[props.scope]}
      primaryLabel={`${word()} smart followers`}
      primaryBoldPart="smart followers"
      primaryLabelSmall={props.scope === 'trading'}
      primaryValue={exact(props.total)}
      rankValue={rankOrNA(props.stats.highestRank)}
      rankBadge={hasRank() && props.stats.highestRankDate === todayIso() ? 'reached today' : undefined}
      topValue={rankPercent(props.stats.topPct)}
      topSub={`of ${word()} Twitter`}
      series={props.stats.line}
    />
  );
};

const MindshareStatBlock: Component<{ scope: SocialCardData['scope']; stats: MindshareStats }> = (props) => {
  const copy = () => SCOPE_COPY[props.scope];
  return (
    <StatBlock
      idPrefix="ms"
      variant={SPARKLINE_VARIANT[props.scope]}
      primaryLabel={`${copy().label} Mindshare`}
      primaryBoldPart="Mindshare"
      primaryValue={rankOrNA(props.stats.current)}
      primarySub="Last 3M"
      rankValue={rankOrNA(props.stats.highestRank)}
      rankSub="Last 12M"
      topValue={rankPercent(props.stats.topPct)}
      topSub={`of ${copy().labelWord} Twitter`}
      series={props.stats.line}
    />
  );
};

const TopFollowersRow: Component<{ data: SocialCardData }> = (props) => (
  <div class="sc-tops">
    <div class="sc-tops__label">Top {SCOPE_COPY[props.data.scope].labelWord} Smart followers</div>
    <div class="sc-tops__row">
      <For each={props.data.topSmartFollowers.slice(0, 12)}>
        {(follower) => (
          <div class="sc-tops__tile">
            <div class="sc-tops__img">
              <img src={follower.avatarUrl} alt="" crossorigin="anonymous" />
            </div>
            {}
            <span class="sc-tick sc-tick--tl" style={{ width: '3px', height: '1px' }} />
            <span class="sc-tick sc-tick--tl2" style={{ width: '1px', height: '3px' }} />
            <span class="sc-tick sc-tick--br" style={{ width: '3px', height: '1px' }} />
            <span class="sc-tick sc-tick--br2" style={{ width: '1px', height: '3px' }} />
          </div>
        )}
      </For>
    </div>
  </div>
);

export const DataColumn: Component<{ data: SocialCardData }> = (props) => (
  <div class="sc-data">
    {}
    <KpiRow data={props.data} />
    <ActivityHeatmap data={props.data} />
    {}
    <Show when={props.data.hasDetails}>
      <div class="sc-stats">
        <SmartFollowersStatBlock
          scope={props.data.scope}
          total={props.data.segmentSmartFollowers}
          stats={props.data.smartFollowersStats}
        />
        <MindshareStatBlock scope={props.data.scope} stats={props.data.mindshareStats} />
      </div>
      <Show when={props.data.topSmartFollowers.length > 0}>
        <TopFollowersRow data={props.data} />
      </Show>
    </Show>
  </div>
);
