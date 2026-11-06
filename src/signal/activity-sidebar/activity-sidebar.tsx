import { For, Match, Show, Switch, createSignal, onCleanup, onMount, type JSX } from 'solid-js';
import { render } from 'solid-js/web';
import type { ActivityFeedItem, ActivityFeedPost } from '@/shared/activity-feed';
import { platformMarkSrc } from '@/shared/platform-brand';
import { appendPage, mergeRefresh } from '@/popup/format/activity';
import { sendKaitoMessage } from '../messaging';
import { closeIcon, kaitoLockup } from '../shared/icons';
import { RemoteImg } from '../shared/images';
import { positionFloating } from '../shared/floating-position';
import { createShadowHost } from '../shared/shadow-host';
import {
  type FeedStream,
  formatPostDate,
  fitTagCount,
  formatShortAgo,
  mergeFeedStreams,
  type SidebarFeedRow,
  type SidebarPostRow,
  type SidebarRow,
  type StreamKey,
} from './rows';
import sidebarCss from './activity-sidebar.css?inline';
import substackMark from '../assets/substack.png?inline';
import xMark from '../assets/x.png?inline';

const POST_SOURCE_MARKS: Record<string, string> = { x: xMark, substack: substackMark };

type FeedState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | {
      kind: 'ready';
      trades: FeedStream<ActivityFeedItem> | null;
      posts: FeedStream<ActivityFeedPost> | null;
      generatedAt: string;
    };

const LOAD_MORE_THRESHOLD_PX = 120;
const CLOCK_TICK_MS = 30_000;

type Page<T> = { items: T[]; nextBefore: string | null; generatedAt: string };

async function fetchStream(
  stream: 'trades',
  before?: string,
): Promise<Page<ActivityFeedItem> | null>;
async function fetchStream(
  stream: 'posts',
  before?: string,
): Promise<Page<ActivityFeedPost> | null>;
async function fetchStream(
  stream: StreamKey,
  before?: string,
): Promise<Page<ActivityFeedItem> | Page<ActivityFeedPost> | null> {
  try {
    const response = await sendKaitoMessage({
      target: 'kaitoExtension',
      action: stream === 'trades' ? 'getActivityFeed' : 'getActivityFeedPosts',
      ...(before ? { before } : {}),
    });
    return response.result ?? null;
  } catch {
    return null;
  }
}

const BADGE_MIN_PX = 60;
const MORE_TAGS_CLOSE_MS = 120;

function MoreTagsPopover(props: {
  tags: string[];
  anchor: HTMLElement;
  onEnter: () => void;
  onLeave: () => void;
}): JSX.Element {
  let panel: HTMLDivElement | undefined;
  onMount(() => {
    if (!panel) return;
    const { left, top } = positionFloating(
      props.anchor.getBoundingClientRect(),
      { width: panel.offsetWidth, height: panel.offsetHeight },
      window,
    );
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    panel.style.visibility = 'visible';
  });
  return (
    <div
      class="kas-more-pop"
      ref={panel}
      role="tooltip"
      onMouseEnter={() => props.onEnter()}
      onMouseLeave={() => props.onLeave()}
    >
      <For each={props.tags}>
        {(tag) => (
          <span class="kas-tag kas-tag--view" title={tag}>
            {tag}
          </span>
        )}
      </For>
    </div>
  );
}

function PostTags(props: { tags: string[]; badge: string | null }): JSX.Element {
  const [visible, setVisible] = createSignal(props.tags.length);
  const [badgeFits, setBadgeFits] = createSignal(true);
  let body: HTMLDivElement | undefined;
  let measure: HTMLDivElement | undefined;
  const fit = () => {
    if (!body || !measure) return;
    const widths = [...measure.children].map((el) => el.getBoundingClientRect().width);
    const count = props.tags.length;
    const tagWidths = widths.slice(0, count);
    const moreWidth = count > 1 ? (widths[count] ?? 0) : 0;
    const gap = Number.parseFloat(getComputedStyle(body).columnGap) || 0;
    const available = body.clientWidth;
    setVisible(fitTagCount(tagWidths, moreWidth, gap, available));
    setBadgeFits(available - Math.min(tagWidths[0] ?? 0, available) - gap >= BADGE_MIN_PX);
  };
  onMount(() => {
    fit();
    const observer = new ResizeObserver(fit);
    if (body) observer.observe(body);
    onCleanup(() => observer.disconnect());
  });
  const hidden = () => props.tags.slice(visible());
  const [moreAnchor, setMoreAnchor] = createSignal<HTMLElement | null>(null);
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const keepOpen = () => clearTimeout(closeTimer);
  const closeSoon = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => setMoreAnchor(null), MORE_TAGS_CLOSE_MS);
  };
  const closeNow = () => {
    clearTimeout(closeTimer);
    setMoreAnchor(null);
  };
  window.addEventListener('scroll', closeNow, true);
  onCleanup(() => {
    clearTimeout(closeTimer);
    window.removeEventListener('scroll', closeNow, true);
  });
  return (
    <div class="kas-row__body kas-row__body--post" ref={body}>
      <For each={props.tags.slice(0, visible())}>
        {(tag) => (
          <span class="kas-tag kas-tag--view" title={tag}>
            {tag}
          </span>
        )}
      </For>
      <Show when={hidden().length > 0}>
        <span
          class="kas-tag kas-tag--view kas-tag--more"
          onMouseEnter={(event) => {
            keepOpen();
            setMoreAnchor(event.currentTarget);
          }}
          onMouseLeave={closeSoon}
        >
          +{hidden().length}
        </span>
      </Show>
      <Show when={hidden().length > 0 ? moreAnchor() : null}>
        {(anchor) => (
          <MoreTagsPopover
            tags={hidden()}
            anchor={anchor()}
            onEnter={keepOpen}
            onLeave={closeSoon}
          />
        )}
      </Show>
      <Show when={badgeFits() ? props.badge : null}>
        {(badge) => (
          <span class="kas-badge" title={badge()}>
            {badge()}
          </span>
        )}
      </Show>
      <div class="kas-tag-measure" ref={measure} aria-hidden="true">
        <For each={props.tags}>{(tag) => <span class="kas-tag kas-tag--view">{tag}</span>}</For>
        <span class="kas-tag kas-tag--view">+{props.tags.length}</span>
      </div>
    </div>
  );
}

function PostRow(props: { row: SidebarPostRow; now: number }): JSX.Element {
  return (
    <a
      class="kas-row"
      href={props.row.href}
      {...(props.row.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      <div class="kas-row__head">
        <RemoteImg
          url={props.row.avatarUrl || undefined}
          wrapCls="kas-avatar"
          imgCls="kas-avatar__img"
          defaultCls="kas-avatar--default"
          cssPx={18}
        />
        <Show when={props.row.name}>
          <span class="kas-name">{props.row.name}</span>
        </Show>
        <Show when={props.row.handle}>
          <span class={props.row.name ? 'kas-handle' : 'kas-name'}>@{props.row.handle}</span>
        </Show>
        <span class="kas-meta">·</span>
        <span class="kas-meta">
          {props.row.datedTime
            ? formatPostDate(props.row.eventTime)
            : formatShortAgo(props.row.eventTime, props.now)}
        </span>
        <span class="kas-spacer" />
        <img
          class="kas-platform kas-platform--post"
          src={POST_SOURCE_MARKS[props.row.source] ?? platformMarkSrc(props.row.source)}
          alt=""
        />
      </div>
      <PostTags tags={props.row.tags} badge={props.row.badge} />
      <Show when={props.row.title}>{(title) => <p class="kas-post-title">“{title()}”</p>}</Show>
      <Show when={props.row.summary}>
        <p class="kas-summary">{props.row.summary}</p>
      </Show>
    </a>
  );
}

function FeedRow(props: { row: SidebarFeedRow; now: number }): JSX.Element {
  return (
    <Show
      when={props.row.kind === 'post' ? (props.row as SidebarPostRow) : null}
      fallback={<Row row={props.row as SidebarRow} now={props.now} />}
    >
      {(post) => <PostRow row={post()} now={props.now} />}
    </Show>
  );
}

function Row(props: { row: SidebarRow; now: number }): JSX.Element {
  return (
    <a class="kas-row" href={`/${props.row.handle}`}>
      <div class="kas-row__head">
        <RemoteImg
          url={props.row.avatarUrl || undefined}
          wrapCls="kas-avatar"
          imgCls="kas-avatar__img"
          defaultCls="kas-avatar--default"
          cssPx={18}
        />
        <Show when={props.row.name}>
          <span class="kas-name">{props.row.name}</span>
        </Show>
        <span class={props.row.name ? 'kas-handle' : 'kas-name'}>@{props.row.handle}</span>
        <span class="kas-meta">·</span>
        <span class="kas-meta">{formatShortAgo(props.row.eventTime, props.now)}</span>
        <span class="kas-spacer" />
        <img class="kas-platform" src={platformMarkSrc(props.row.platform)} alt="" />
      </div>
      <div class="kas-row__body">
        <span class={`kas-tag kas-tag--${props.row.tone}`}>{props.row.tag}</span>
        <span class="kas-subject">{props.row.subject}</span>
      </div>
    </a>
  );
}

function ActivitySidebar(props: { refreshSeconds: number; onClose: () => void }): JSX.Element {
  const [state, setState] = createSignal<FeedState>({ kind: 'loading' });
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [now, setNow] = createSignal(Date.now());
  const [atBottom, setAtBottom] = createSignal(true);
  let scroller: HTMLDivElement | undefined;
  const loadedMore: Record<StreamKey, boolean> = { trades: false, posts: false };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastLoadAt = 0;
  let disposed = false;

  const refreshMs = (): number => Math.max(props.refreshSeconds, 15) * 1000;

  const schedule = (): void => {
    clearTimeout(timer);
    if (document.hidden) return;
    const base = refreshMs();
    timer = setTimeout(() => void load(false), base + Math.random() * base * 0.2);
  };

  const refreshStream = <T extends { eventId: string }>(
    key: StreamKey,
    current: FeedStream<T> | null,
    fresh: Page<T> | null,
  ): FeedStream<T> | null => {
    if (!fresh) return current;
    if (current && loadedMore[key]) {
      return { items: mergeRefresh(current.items, fresh.items), nextBefore: current.nextBefore };
    }
    return { items: fresh.items, nextBefore: fresh.nextBefore };
  };

  const load = async (showLoading: boolean): Promise<void> => {
    clearTimeout(timer);
    if (showLoading) {
      loadedMore.trades = false;
      loadedMore.posts = false;
      setState({ kind: 'loading' });
    }
    lastLoadAt = Date.now();
    const [freshTrades, freshPosts] = await Promise.all([
      fetchStream('trades'),
      fetchStream('posts'),
    ]);
    if (disposed) return;
    const current = state();
    const prior = current.kind === 'ready' ? current : null;
    const trades = refreshStream('trades', prior?.trades ?? null, freshTrades);
    const posts = refreshStream('posts', prior?.posts ?? null, freshPosts);
    if (trades || posts) {
      setState({
        kind: 'ready',
        trades,
        posts,
        generatedAt:
          freshTrades?.generatedAt ?? freshPosts?.generatedAt ?? prior?.generatedAt ?? '',
      });
      setNow(Date.now());
    } else if (!prior) setState({ kind: 'error' });
    schedule();
  };

  const loadMore = async (): Promise<void> => {
    const current = state();
    if (current.kind !== 'ready' || loadingMore()) return;
    const key = mergeFeedStreams(current.trades, current.posts).loadMore;
    const before = key ? current[key]?.nextBefore : null;
    if (!key || !before) return;
    setLoadingMore(true);
    try {
      const older =
        key === 'trades' ? await fetchStream('trades', before) : await fetchStream('posts', before);
      const latest = state();
      if (!disposed && older && latest.kind === 'ready') {
        loadedMore[key] = true;
        if (key === 'trades' && latest.trades) {
          setState({
            ...latest,
            trades: {
              items: appendPage(latest.trades.items, older.items as ActivityFeedItem[]),
              nextBefore: older.nextBefore,
            },
          });
        } else if (key === 'posts' && latest.posts) {
          setState({
            ...latest,
            posts: {
              items: appendPage(latest.posts.items, older.items as ActivityFeedPost[]),
              nextBefore: older.nextBefore,
            },
          });
        }
      }
    } finally {
      if (!disposed) setLoadingMore(false);
    }
  };

  const onScroll = (): void => {
    if (!scroller) return;
    const remaining = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    setAtBottom(remaining <= 1);
    if (remaining < LOAD_MORE_THRESHOLD_PX) void loadMore();
  };

  const onVisibility = (): void => {
    if (document.hidden) {
      clearTimeout(timer);
      return;
    }
    if (Date.now() - lastLoadAt >= refreshMs()) void load(false);
    else schedule();
  };

  onMount(() => {
    void load(true);
    document.addEventListener('visibilitychange', onVisibility);
    const clock = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    onCleanup(() => {
      disposed = true;
      clearTimeout(timer);
      clearInterval(clock);
      document.removeEventListener('visibilitychange', onVisibility);
    });
  });

  const page = () => {
    const current = state();
    return current.kind === 'ready' ? current : null;
  };
  const rows = () => {
    const current = page();
    return current ? mergeFeedStreams(current.trades, current.posts).rows : [];
  };

  const measure = (el: HTMLDivElement): void => {
    scroller = el;
    new ResizeObserver(onScroll).observe(el);
  };

  return (
    <div class="kas-card" classList={{ 'kas-card--list': rows().length > 0 }}>
      <div class="kas-head">
        <div class="kas-head__text">
          <p class="kas-title">Activity Feeds</p>
          <Show when={page()}>
            {(current) => (
              <p class="kas-updated">
                {(() => {
                  const ago = formatShortAgo(current().generatedAt, now());
                  return ago === 'now' ? 'Updated just now' : `Updated ${ago} ago`;
                })()}
              </p>
            )}
          </Show>
        </div>
        <button
          type="button"
          class="kas-close"
          aria-label="Hide Activity feed"
          onClick={props.onClose}
        >
          {closeIcon()}
        </button>
      </div>

      <Switch>
        <Match when={state().kind === 'loading'}>
          <div class="kas-skeleton">
            <For each={[0, 1, 2]}>{() => <div class="kas-skeleton__row" />}</For>
          </div>
        </Match>
        <Match when={state().kind === 'error'}>
          <div class="kas-empty">
            <p class="kas-empty__title">Couldn't load activity</p>
            <button type="button" class="kas-retry" onClick={() => void load(true)}>
              Try again
            </button>
          </div>
        </Match>
        <Match when={rows().length === 0}>
          <div class="kas-empty">
            <p class="kas-empty__title">No activity yet</p>
            <p class="kas-empty__body">
              Calls from X and Substack, and trades from people you follow, will show up here.
            </p>
          </div>
        </Match>
        <Match when={rows().length > 0}>
          <div class="kas-scroll-wrap">
            <div class="kas-scroll" ref={measure} onScroll={onScroll}>
              <For each={rows()}>{(row) => <FeedRow row={row} now={now()} />}</For>
            </div>
            <Show when={!atBottom()}>
              <div class="kas-fade" />
            </Show>
          </div>
        </Match>
      </Switch>

      <div class="kas-foot">
        <span class="kas-foot__label">Powered by</span>
        {kaitoLockup()}
      </div>
    </div>
  );
}

function HideConfirm(props: { onHide: () => void; onCancel: () => void }): JSX.Element {
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') props.onCancel();
  };
  onMount(() => {
    document.addEventListener('keydown', onKey);
    onCleanup(() => document.removeEventListener('keydown', onKey));
  });
  return (
    <div
      class="kas-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && props.onCancel()}
    >
      <div class="kas-dialog" role="dialog" aria-modal="true" aria-labelledby="kas-dialog-title">
        <div class="kas-dialog__content">
          <p class="kas-dialog__title" id="kas-dialog-title">
            Hide Activity feed?
          </p>
          <p class="kas-dialog__body">
            You’ll stop seeing calls from X and Substack and trades from people you follow. Turn it
            back on in Kaito Pulse settings.
          </p>
        </div>
        <div class="kas-dialog__foot">
          <button type="button" class="kas-btn kas-btn--secondary" onClick={props.onHide}>
            Hide
          </button>
          <button type="button" class="kas-btn kas-btn--primary" onClick={props.onCancel} autofocus>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export interface ActivitySidebarHandle {
  root: HTMLElement;
  setDark(dark: boolean): void;
  destroy(): void;
}

function openHideConfirm(dark: boolean, onHide: () => void): void {
  const { host, shadow } = createShadowHost(sidebarCss, 'signal-activity-dialog-host');
  const root = document.createElement('div');
  root.className = dark ? 'kas-theme kas-theme--dark' : 'kas-theme';
  shadow.appendChild(root);
  document.body.appendChild(host);
  const close = (): void => {
    dispose();
    host.remove();
  };
  const dispose = render(
    () => (
      <HideConfirm
        onCancel={close}
        onHide={() => {
          close();
          onHide();
        }}
      />
    ),
    root,
  );
}

export function createActivitySidebar(options: {
  refreshSeconds: number;
  dark: boolean;
  onHide: () => void;
}): ActivitySidebarHandle {
  const { host, shadow } = createShadowHost(sidebarCss, 'signal-activity-sidebar-host');
  const root = document.createElement('div');
  let dark = options.dark;
  const applyTheme = (): void => {
    root.className = dark ? 'kas-theme kas-theme--dark' : 'kas-theme';
  };
  applyTheme();
  shadow.appendChild(root);
  const dispose = render(
    () => (
      <ActivitySidebar
        refreshSeconds={options.refreshSeconds}
        onClose={() => openHideConfirm(dark, options.onHide)}
      />
    ),
    root,
  );
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
