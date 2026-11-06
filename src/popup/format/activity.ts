import type { ActivityFeedItem } from '@/shared/activity-feed';

export interface ActivityRow {
  key: string;
  platform: string;
  handle: string;
  avatarUrl: string;
  eventTime: string;
  action: string;
  amount: string;
}

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function isHyperliquidSpot(marketId: string): boolean {
  return marketId.startsWith('@') || marketId.includes('/');
}

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  const digits = value >= 1000 ? 0 : value >= 1 ? 2 : 4;
  return value.toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function formatApproxUsd(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (value < 1000) return `~$${Math.round(value).toLocaleString('en-US')}`;
  return `~$${value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })}`;
}

function actionText(item: ActivityFeedItem, quantity: number): string {
  const verb = item.side === 'sell' ? 'Sold' : 'Bought';
  if (item.platform === 'polymarket') {
    const outcome = item.market.outcome?.trim();
    const traded = `${verb}${outcome ? ` ${outcome}` : ''}`;
    const label = item.market.label.trim();
    if (!label || label === item.market.id) return `${traded} · a Polymarket market`;
    return `${traded} · “${label}”`;
  }
  const symbol = item.market.label || item.market.id;
  const spot = isHyperliquidSpot(item.market.id) ? ' · Spot' : '';
  return `${verb} · ${formatQuantity(quantity)} ${symbol}${spot}`;
}

export function toActivityRows(items: readonly ActivityFeedItem[]): ActivityRow[] {
  return items.map((item) => ({
    key: item.eventId,
    platform: item.platform,
    handle: item.actor.handle,
    avatarUrl: item.actor.avatarUrl,
    eventTime: item.eventTime,
    action: actionText(item, toNumber(item.quantity)),
    amount: formatApproxUsd(toNumber(item.notional)),
  }));
}

export function appendPage<T extends { eventId: string }>(
  shown: readonly T[],
  older: readonly T[],
): T[] {
  const seen = new Set(shown.map((item) => item.eventId));
  return [...shown, ...older.filter((item) => !seen.has(item.eventId))];
}

export function mergeRefresh<T extends { eventId: string }>(
  shown: readonly T[],
  fresh: readonly T[],
): T[] {
  const freshIds = new Set(fresh.map((item) => item.eventId));
  return [...fresh, ...shown.filter((item) => !freshIds.has(item.eventId))];
}
