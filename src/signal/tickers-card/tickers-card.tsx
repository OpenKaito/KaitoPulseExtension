import { createSignal, For, Show, onMount, type JSX } from 'solid-js';
import { render } from 'solid-js/web';
import { resolveImageSrc, sendKaitoMessage } from '../messaging';
import { createShadowHost } from '../shared/shadow-host';
import { closeIcon, kaitoLockup } from '../shared/icons';
import type { TickerRecommendationItem } from '@/shared/ticker-recommendations';
import type { ScreenerRow } from '@/shared/ticker-screener';
import type { TokenChartPoint } from '@/shared/token-chart';
import ktcCss from './tickers-card.css?inline';

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; items: TickerRecommendationItem[]; source: 'personal' | 'fallback' };

function displaySymbol(ticker: string): string {
  return ticker.replace(/^STOCK_ENTITY_/, '');
}
function initials(ticker: string): string {
  return displaySymbol(ticker).slice(0, 2).toUpperCase();
}
function isPreTge(type: string): boolean {
  return type === 'pretge';
}
function tgeBadge(type: string): string {
  return isPreTge(type) ? 'Pre-TGE' : 'Post-TGE';
}
function logoColor(ticker: string): string {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 55% 45%)`;
}
function fmtPrice(p: number): string {
  if (p >= 1) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `$${p.toPrecision(2)}`;
}
function fmtPct(n: number): string {
  return `${Math.abs(n).toFixed(1)}%`;
}
function fmtMindshare(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}
function fmtBullish(n: number): string {
  return `${Math.round(n * 100)}% Bullish`;
}
function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function postUrl(post: { authorHandle: string; tweetId: string }): string {
  return `https://x.com/${post.authorHandle}/status/${post.tweetId}`;
}

function Sparkline(props: { points: Array<{ t: number; price: number }> }): JSX.Element {
  const W = 300;
  const H = 34;
  const prices = (): number[] => props.points.map((p) => p.price);
  const min = (): number => Math.min(...prices());
  const max = (): number => Math.max(...prices());
  const range = (): number => max() - min() || 1;
  const n = (): number => props.points.length;
  const xy = (): Array<readonly [number, number]> =>
    props.points.map(
      (p, i) => [(i * W) / (n() - 1), H - 1 - ((p.price - min()) / range()) * (H - 2)] as const,
    );
  const line = (): string =>
    `M ${xy()
      .map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
      .join(' L ')}`;
  const area = (): string => `${line()} L ${W} ${H} L 0 ${H} Z`;
  const up = (): boolean => prices()[n() - 1] >= prices()[0];
  const stroke = (): string => (up() ? '#2ecc70' : '#eb5757');

  const [hover, setHover] = createSignal<number | null>(null);
  let box!: HTMLDivElement;
  const onMove = (e: PointerEvent): void => {
    const r = box.getBoundingClientRect();
    if (r.width === 0 || n() < 2) return;
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setHover(Math.round(ratio * (n() - 1)));
  };
  const pct = (i: number): number => (i / (n() - 1)) * 100;

  return (
    <div class="ktc-spark" ref={box} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <path d={area()} fill={stroke()} fill-opacity="0.12" stroke="none" />
        <path d={line()} fill="none" stroke={stroke()} stroke-width="1.5" stroke-linejoin="round" />
      </svg>
      <Show when={hover() != null}>
        {(() => {
          const i = (): number => hover()!;
          return (
            <>
              <div class="ktc-spark__cross" style={{ left: `${pct(i())}%` }} />
              <div
                class="ktc-spark__dot"
                style={{ left: `${pct(i())}%`, top: `${xy()[i()][1]}px` }}
              />
              <div class="ktc-spark__tip" style={{ left: `${pct(i())}%` }}>
                <span class="ktc-spark__tip-price">{fmtPrice(props.points[i()].price)}</span>
                <span class="ktc-spark__tip-date">{fmtDate(props.points[i()].t)}</span>
              </div>
            </>
          );
        })()}
      </Show>
    </div>
  );
}

function Delta(props: { value: number; suffix: string }): JSX.Element {
  const up = () => props.value >= 0;
  return (
    <span class="ktc-stat__delta">
      <span class={up() ? 'up' : 'down'}>
        {up() ? '▲' : '▼'} {Math.abs(props.value).toFixed(2)}
      </span>
      {` · ${props.suffix}`}
    </span>
  );
}

function RowDetail(props: { item: TickerRecommendationItem; screener?: ScreenerRow }): JSX.Element {
  const [chart, setChart] = createSignal<Array<{ t: number; price: number }> | null>(null);
  const s = () => props.screener;

  onMount(async () => {
    if (isPreTge(props.item.type)) return;
    try {
      const resp = await sendKaitoMessage({
        target: 'kaitoExtension',
        action: 'fetchTokenChart',
        symbol: props.item.ticker,
        period: '7D',
      });
      const pts = resp.result?.points;
      if (pts && resp.result?.meta.priceAvailable) {
        const clean = pts
          .filter(
            (p: TokenChartPoint): p is TokenChartPoint & { price: number } =>
              typeof p.price === 'number',
          )
          .map((p) => ({ t: p.t, price: p.price }));
        if (clean.length >= 2) setChart(clean);
      }
    } catch {
      return;
    }
  });

  return (
    <div class="ktc-detail">
      <div class="ktc-stats">
        <div class="ktc-stat ktc-stat--fixed">
          <div class="ktc-stat__label">Mindshare</div>
          <div class="ktc-stat__value">
            {s()?.mindshare != null ? fmtMindshare(s()!.mindshare!) : '—'}
          </div>
          <Show when={s()?.mindshare_7d != null}>
            <Delta value={s()!.mindshare_7d! * 100} suffix="7D" />
          </Show>
        </div>
        <div class="ktc-stat ktc-stat--grow">
          <div class="ktc-stat__label">Sentiment</div>
          <Show
            when={s()?.bullish_ratio != null}
            fallback={
              <Show when={s()?.sentiment != null} fallback={<div class="ktc-stat__value">—</div>}>
                <div
                  class={`ktc-stat__value ${s()!.sentiment! > 0 ? 'ktc-sent--bull' : s()!.sentiment! < 0 ? 'ktc-sent--bear' : ''}`}
                >
                  {s()!.sentiment! > 0
                    ? '▲ Bullish'
                    : s()!.sentiment! < 0
                      ? '▼ Bearish'
                      : 'Neutral'}
                </div>
              </Show>
            }
          >
            <div class="ktc-stat__value">{fmtBullish(s()!.bullish_ratio!)}</div>
            <div class="ktc-sentbar-row">
              <div class="ktc-sentbar">
                <div class="ktc-sentbar__pos" style={{ width: `${s()!.bullish_ratio! * 100}%` }} />
                <div
                  class="ktc-sentbar__neu"
                  style={{
                    width: `${Math.max(0, (1 - s()!.bullish_ratio! - (s()!.bearish_ratio! ?? 0)) * 100)}%`,
                  }}
                />
                <div
                  class="ktc-sentbar__neg"
                  style={{ width: `${(s()!.bearish_ratio! ?? 0) * 100}%` }}
                />
              </div>
            </div>
          </Show>
        </div>
        <div class="ktc-stat ktc-stat--fixed">
          <div class="ktc-stat__label">Mentions</div>
          <div class="ktc-stat__value">{s()?.mention != null ? String(s()!.mention) : '—'}</div>
          <Show when={s()?.mention_1d != null}>
            <Delta value={s()!.mention_1d!} suffix="24h" />
          </Show>
        </div>
      </div>

      <Show when={chart()}>
        <div class="ktc-price7d">
          <div class="ktc-stat__label">Price · 7D</div>
          <Sparkline points={chart()!} />
        </div>
      </Show>

      <Show when={props.item.topPost}>
        {(post) => (
          <div class="ktc-toppost">
            <div class="ktc-toppost__label">Top post in 24h</div>
            <a class="ktc-post" href={postUrl(post())} target="_blank" rel="noopener noreferrer">
              <div class="ktc-post__h">
                <Show when={post().authorAvatar}>
                  <img class="ktc-post__avatar" src={post().authorAvatar} alt="" />
                </Show>
                <span class="ktc-post__name">{post().authorName || post().authorHandle}</span>
                <span class="ktc-post__handle">@{post().authorHandle}</span>
              </div>
              <p class="ktc-post__text">{post().text}</p>
              <div class="ktc-post__stats">
                {post().likeCount.toLocaleString()} likes · {post().retweetCount.toLocaleString()}{' '}
                reposts
              </div>
            </a>
          </div>
        )}
      </Show>
    </div>
  );
}

function Row(props: {
  item: TickerRecommendationItem;
  screener?: ScreenerRow;
  logo?: string;
}): JSX.Element {
  const price = () => props.screener?.price;
  const showMarket = () => !isPreTge(props.item.type) && price() != null;
  return (
    <div class="ktc-row">
      <span class="ktc-rank">{props.item.rank}</span>
      <span
        class="ktc-logo"
        style={props.logo ? undefined : { background: logoColor(props.item.ticker) }}
      >
        <Show when={props.logo} fallback={initials(props.item.ticker)}>
          {(src) => <img src={src()} alt="" draggable={false} />}
        </Show>
      </span>
      <span class="ktc-info">
        <span class="ktc-line1">
          <span class="ktc-sym">{displaySymbol(props.item.ticker)}</span>
          <span class="ktc-badge">{tgeBadge(props.item.type)}</span>
        </span>
        <Show when={props.item.interactions > 0}>
          <span class="ktc-interactions">{props.item.interactions} interactions</span>
        </Show>
      </span>
      <Show when={showMarket()}>
        <span class="ktc-market">
          <span class="ktc-price">{fmtPrice(price()!)}</span>
          <Show when={props.screener?.price_1d != null}>
            <span
              class={
                props.screener!.price_1d! >= 0 ? 'ktc-chg ktc-chg--up' : 'ktc-chg ktc-chg--down'
              }
            >
              {props.screener!.price_1d! >= 0 ? '▲' : '▼'} {fmtPct(props.screener!.price_1d!)}
            </span>
          </Show>
        </span>
      </Show>
    </div>
  );
}

function TickersCard(): JSX.Element {
  const [state, setState] = createSignal<State>({ kind: 'loading' });
  const [expanded, setExpanded] = createSignal<string | null>(null);
  const [screener, setScreener] = createSignal<Map<string, ScreenerRow>>(new Map());
  const [logos, setLogos] = createSignal<Map<string, string>>(new Map());

  onMount(async () => {
    try {
      const resp = await sendKaitoMessage({
        target: 'kaitoExtension',
        action: 'getTickerRecommendations',
      });
      if (resp.result && resp.result.items.length > 0) {
        setState({ kind: 'ready', items: resp.result.items, source: resp.result.source });
        setExpanded(resp.result.items[0].ticker);
        void loadScreener(resp.result.items.map((i) => i.ticker));
        void loadLogos(resp.result.items);
      } else {
        setState({ kind: 'error' });
      }
    } catch {
      setState({ kind: 'error' });
    }
  });

  async function loadScreener(tickers: string[]): Promise<void> {
    try {
      const resp = await sendKaitoMessage({
        target: 'kaitoExtension',
        action: 'getTickerScreener',
        tickers,
      });
      const map = new Map<string, ScreenerRow>();
      for (const row of resp.result?.data ?? []) {
        if (row?.ticker) map.set(row.ticker, row);
      }
      setScreener(map);
    } catch {
      return;
    }
  }

  async function loadLogos(items: TickerRecommendationItem[]): Promise<void> {
    await Promise.all(
      items.map(async (i) => {
        try {
          const resp = await sendKaitoMessage({
            target: 'kaitoExtension',
            action: 'fetchTokenChart',
            symbol: i.ticker,
            period: '7D',
          });
          const logo = resp.result?.meta.logo;
          if (!logo) return;
          const src = await resolveImageSrc(logo, 28);
          setLogos((prev) => new Map(prev).set(i.ticker, src));
        } catch {
          return;
        }
      }),
    );
  }

  const toggle = (ticker: string): void => {
    setExpanded((cur) => (cur === ticker ? null : ticker));
  };
  const rowOf = (ticker: string): ScreenerRow | undefined => screener().get(ticker);
  const logoOf = (ticker: string): string | undefined => logos().get(ticker);

  return (
    <div class="ktc-card">
      <div class="ktc-head">
        <div class="ktc-head__title">
          <div class="ktc-title">Tickers for you</div>
          <div class="ktc-sub">
            {state().kind === 'ready' && (state() as { source: string }).source === 'fallback'
              ? 'Trending on Kaito'
              : 'Based on posts you viewed on X'}
          </div>
        </div>
        <button
          class="ktc-close"
          type="button"
          aria-label="Hide"
          onClick={() => setState({ kind: 'error' })}
        >
          {closeIcon()}
        </button>
      </div>

      <Show
        when={state().kind === 'ready'}
        fallback={<div class="ktc-state">{state().kind === 'loading' ? 'Loading…' : ''}</div>}
      >
        <div class="ktc-scroll">
          <div class="ktc-list">
            <For each={(state() as { items: TickerRecommendationItem[] }).items}>
              {(item) => (
                <Show
                  when={expanded() === item.ticker}
                  fallback={
                    <div onClick={() => toggle(item.ticker)}>
                      <Row item={item} screener={rowOf(item.ticker)} logo={logoOf(item.ticker)} />
                    </div>
                  }
                >
                  <div class="ktc-rowwrap--expanded">
                    <div onClick={() => toggle(item.ticker)}>
                      <Row item={item} screener={rowOf(item.ticker)} logo={logoOf(item.ticker)} />
                    </div>
                    <RowDetail item={item} screener={rowOf(item.ticker)} />
                  </div>
                </Show>
              )}
            </For>
          </div>
        </div>
      </Show>

      <div class="ktc-foot">
        <span class="ktc-foot__label">Powered by</span>
        <span class="ktc-foot__logo">{kaitoLockup()}</span>
      </div>
    </div>
  );
}

export interface TickersCardHandle {
  root: HTMLElement;
  setDark(dark: boolean): void;
  destroy(): void;
}

export function createTickersCard(options: { dark: boolean }): TickersCardHandle {
  const { host, shadow } = createShadowHost(ktcCss, 'signal-tickers-card-host');
  const root = document.createElement('div');
  let dark = options.dark;
  const applyTheme = (): void => {
    root.className = dark ? 'kas-theme kas-theme--dark' : 'kas-theme';
  };
  applyTheme();
  shadow.appendChild(root);
  const dispose = render(() => <TickersCard />, root);
  return {
    root: host,
    setDark(next) {
      if (next === dark) return;
      dark = next;
      applyTheme();
    },
    destroy() {
      dispose();
      host.remove();
    },
  };
}

export { TickersCard };
