import type {
  HyperliquidMarginMode,
  HyperliquidPosition,
  PolymarketMarket,
} from '@/shared/social-card';
import type { ChartPoint, PerpPosition, PredictionMarket } from '../types';
import { hyperliquidCoinIconUrl } from './links';

export const NO_TOTAL = '-';

export const abs = (n: number, decimals: number): string =>
  Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export const usd = (n: number, decimals = 2): string => `${n < 0 ? '-' : ''}$${abs(n, decimals)}`;

export const usdSigned = (n: number, decimals = 2): string =>
  `${n < 0 ? '-' : '+'}$${abs(n, decimals)}`;

export const pctSigned = (n: number): string => `${n < 0 ? '-' : '+'}${Math.abs(n).toFixed(2)}`;

export const count = (n: number): string => n.toLocaleString('en-US');

export const countOrDash = (n: number | null | undefined): string =>
  typeof n === 'number' && Number.isFinite(n) ? count(n) : NO_TOTAL;

export const cents = (n: number): string => `${(n * 100).toFixed(1)}¢`;

export const shares = (n: number | undefined): string =>
  typeof n === 'number' && Number.isFinite(n)
    ? `${n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} shares`
    : '';

export const compact = (n: number): string =>
  n.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export const truncateAddress = (addr: string): string =>
  addr.length <= 11 ? addr : `${addr.slice(0, 6)}…${addr.slice(-4)}`;

export function formatJoined(raw?: string): string | null {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function chartTime(t: number, period: string): string {
  const date = new Date(t < 1e12 ? t * 1000 : t);
  if (Number.isNaN(date.getTime())) return '';
  return period === '1D'
    ? date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const MARGIN_MODE_LABELS: Record<'cross' | 'isolated', string> = {
  cross: 'Cross',
  isolated: 'Isolated',
};

export function leverageLabel(
  leverage: number,
  marginMode: HyperliquidMarginMode | undefined,
): string {
  const label =
    marginMode === 'cross' || marginMode === 'isolated' ? MARGIN_MODE_LABELS[marginMode] : null;
  return label == null ? `${leverage}X` : `${leverage}X (${label})`;
}

export function perpPositionRow(p: HyperliquidPosition): PerpPosition {
  return {
    pair: p.coin,
    iconUrl: hyperliquidCoinIconUrl(p.coin),
    leverage: leverageLabel(p.leverage, p.marginMode),
    side: p.side === 'short' ? 'Short' : 'Long',
    pnl: usdSigned(p.unrealizedPnl),
    pnlNegative: p.unrealizedPnl < 0,
    entry: usd(p.entryPx),
    margin: usd(p.marginUsed),
    liqPrice: p.liquidationPx == null ? 'N/A' : usd(p.liquidationPx, 0),
    size: usd(p.positionValue),
    mark: usd(p.markPx),
    markNegative: p.unrealizedPnl < 0,
    funding: usd(p.funding),
  };
}

export function predictionMarketRow(m: PolymarketMarket): PredictionMarket {
  return {
    title: m.market,
    outcome: `${m.outcome} ${cents(m.avg)}`,
    outcomeYes: m.outcome.trim().toLowerCase() === 'yes',
    avg: cents(m.avg),
    current: cents(m.current),
    shares: shares(m.size),
    value: usd(m.value),
    change: `${usdSigned(m.pnl)} (${pctSigned(m.pnlPct)}%)`,
    changeNegative: m.pnl < 0,
    iconUrl: m.icon,
  };
}

export function chartPoints(
  points: Array<{ t: number; v: number }> | undefined,
  period: string,
): ChartPoint[] {
  return (points ?? []).map((p) => ({ v: p.v, label: usd(p.v), time: chartTime(p.t, period) }));
}
