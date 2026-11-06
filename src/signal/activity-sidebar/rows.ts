import type { ActivityFeedItem, ActivityFeedPost, ActivityFeedTrade } from '@/shared/activity-feed';
import { formatApproxUsd, isHyperliquidSpot } from '@/popup/format/activity';

export type TagTone = 'up' | 'down' | 'neutral';

export interface SidebarRow {
  kind: 'trade';
  key: string;
  platform: string;
  name: string;
  handle: string;
  avatarUrl: string;
  eventTime: string;
  tag: string;
  tone: TagTone;
  subject: string;
}

const UP_OUTCOMES = new Set(['yes', 'up', 'over', 'long']);
const DOWN_OUTCOMES = new Set(['no', 'down', 'under', 'short']);

export function outcomeTone(outcome: string | undefined): TagTone {
  const key = outcome?.trim().toLowerCase() ?? '';
  if (UP_OUTCOMES.has(key)) return 'up';
  if (DOWN_OUTCOMES.has(key)) return 'down';
  return 'neutral';
}

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const POSITION_VERB: Record<string, string> = {
  opened: 'Opened',
  added: 'Added to',
  reduced: 'Reduced',
  closed: 'Closed',
  liquidated: 'Liquidated',
};

function hlTag(trade: ActivityFeedTrade | undefined, fallback: string): string {
  if (!trade) return fallback;
  if (trade.action === 'bought') return 'Bought';
  if (trade.action === 'sold') return 'Sold';
  if (trade.action === 'flipped' && trade.position && trade.toPosition) {
    return `Flipped ${trade.position} → ${trade.toPosition}`;
  }
  const verb = POSITION_VERB[trade.action];
  return verb && trade.position ? `${verb} ${trade.position}` : fallback;
}

export function formatSignedUsd(value: string | null | undefined): string {
  const n = Number(value);
  if (value == null || !Number.isFinite(n) || n === 0) return '';
  const sign = n > 0 ? '+' : '\u2212';
  const abs = Math.abs(n);
  const body =
    abs >= 100_000
      ? abs.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })
      : abs >= 10
        ? Math.round(abs).toLocaleString('en-US')
        : abs.toFixed(2);
  return `${sign}$${body}`;
}

function toRow(item: ActivityFeedItem): SidebarRow {
  const verb = item.side === 'sell' ? 'Sold' : 'Bought';
  const base = {
    kind: 'trade' as const,
    key: item.eventId,
    platform: item.platform,
    name: item.actor.name?.trim() ?? '',
    handle: item.actor.handle,
    avatarUrl: item.actor.avatarUrl,
    eventTime: item.eventTime,
  };
  if (item.platform === 'polymarket') {
    const outcome = item.market.outcome?.trim();
    const label = item.market.label.trim();
    return {
      ...base,
      tag: outcome ? `${verb} ${outcome}` : verb,
      tone: outcomeTone(outcome),
      subject: !label || label === item.market.id ? 'a Polymarket market' : `“${label}”`,
    };
  }
  const parts = [item.market.label || item.market.id, formatApproxUsd(toNumber(item.notional))];
  if (isHyperliquidSpot(item.market.id)) parts.push('Spot');
  parts.push(formatSignedUsd(item.trade?.realizedPnlUsd));
  return {
    ...base,
    tag: hlTag(item.trade, verb),
    tone: item.trade?.action === 'liquidated' ? 'down' : 'neutral',
    subject: parts.filter(Boolean).join(' · '),
  };
}

export function toSidebarRows(items: readonly ActivityFeedItem[]): SidebarRow[] {
  return items.map(toRow);
}

export function formatShortAgo(iso: string, now = Date.now()): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '';
  const minutes = Math.floor((now - time) / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(time).toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

export function fitTagCount(
  tagWidths: number[],
  moreWidth: number,
  gap: number,
  available: number,
): number {
  const n = tagWidths.length;
  let used = 0;
  const prefix = tagWidths.map((width, i) => {
    used += width + (i > 0 ? gap : 0);
    return used;
  });
  for (let k = n; k > 1; k -= 1) {
    const total = prefix[k - 1] + (k < n ? gap + moreWidth : 0);
    if (total <= available) return k;
  }
  return Math.min(n, 1);
}

export interface SidebarPostRow {
  kind: 'post';
  key: string;
  source: string;
  name: string;
  handle: string;
  avatarUrl: string;
  eventTime: string;
  datedTime: boolean;
  href: string;
  external: boolean;
  tags: string[];
  badge: string | null;
  title: string | null;
  summary: string;
}

export type SidebarFeedRow = SidebarRow | SidebarPostRow;

function postHref(post: ActivityFeedPost): { href: string; external: boolean } {
  if (post.source === 'x') {
    const match = /\/status\/(\d+)/.exec(post.url);
    if (match && post.actor.handle)
      return { href: `/${post.actor.handle}/status/${match[1]}`, external: false };
  }
  return { href: post.url, external: true };
}

export function toPostRow(post: ActivityFeedPost): SidebarPostRow {
  const tags = post.tags.map((tag) => tag.text).filter(Boolean);
  return {
    kind: 'post',
    key: `post:${post.eventId}`,
    source: post.source,
    name: post.actor.name?.trim() ?? '',
    handle: post.actor.handle,
    avatarUrl: post.actor.avatarUrl,
    eventTime: post.postedAt,
    datedTime: post.source === 'substack',
    ...postHref(post),
    tags,
    badge: tags.length === 1 ? (post.badge?.text ?? null) : null,
    title: post.title?.trim() || null,
    summary: post.summary.trim(),
  };
}

export function formatPostDate(iso: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '';
  return new Date(time).toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

export interface FeedStream<T> {
  items: readonly T[];
  nextBefore: string | null;
}

export type StreamKey = 'trades' | 'posts';

function timeOf(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function edgeOf<T>(stream: FeedStream<T> | null, time: (item: T) => string): number {
  if (!stream?.nextBefore || stream.items.length === 0) return Number.NEGATIVE_INFINITY;
  return timeOf(time(stream.items[stream.items.length - 1]));
}

export function mergeFeedStreams(
  trades: FeedStream<ActivityFeedItem> | null,
  posts: FeedStream<ActivityFeedPost> | null,
): { rows: SidebarFeedRow[]; loadMore: StreamKey | null } {
  const tradeEdge = edgeOf(trades, (item) => item.eventTime);
  const postEdge = edgeOf(posts, (item) => item.postedAt);
  const cutoff = Math.max(tradeEdge, postEdge);
  const rows: SidebarFeedRow[] = [
    ...toSidebarRows(trades?.items ?? []),
    ...(posts?.items ?? []).map(toPostRow),
  ]
    .filter((row) => timeOf(row.eventTime) >= cutoff)
    .sort((a, b) => timeOf(b.eventTime) - timeOf(a.eventTime));
  const loadMore =
    cutoff === Number.NEGATIVE_INFINITY ? null : tradeEdge >= postEdge ? 'trades' : 'posts';
  return { rows, loadMore };
}
