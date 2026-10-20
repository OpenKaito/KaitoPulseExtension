import type {
  AttestedWirePosition,
  HyperliquidMarginMode,
  HyperliquidPosition,
  LighterWirePosition,
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

const isFiniteNumber = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n);

export const usd = (n: number | null | undefined, decimals = 2): string =>
  isFiniteNumber(n) ? `${n < 0 ? '-' : ''}$${abs(n, decimals)}` : NO_TOTAL;

export const usdSigned = (n: number | null | undefined, decimals = 2): string =>
  isFiniteNumber(n) ? `${n < 0 ? '-' : '+'}$${abs(n, decimals)}` : NO_TOTAL;

export const pctSigned = (n: number): string => `${n < 0 ? '-' : '+'}${Math.abs(n).toFixed(2)}`;

export const count = (n: number | null | undefined): string =>
  isFiniteNumber(n) ? n.toLocaleString('en-US') : NO_TOTAL;

export const countOrDash = count;

export const points = (n: number): string =>
  n.toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) < 10 ? 2 : 0 });

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

export function dataAsOfLabel(raw: string | number | null | undefined): string | undefined {
  if (raw == null || raw === '') return undefined;
  const date = new Date(typeof raw === 'number' && raw < 1e12 ? raw * 1000 : raw);
  if (Number.isNaN(date.getTime())) return undefined;
  return `as of ${date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`;
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
  return label == null ? `${leverage}×` : `${leverage}× (${label})`;
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

const compactUsd = (n: number): string => `${n < 0 ? '-' : ''}$${compact(Math.abs(n))}`;

const baseAsset = (symbol: string): string => symbol.replace(/^P-/, '').split('-')[0] ?? symbol;

const quantity = (size: number, unit: string): string =>
  `${Math.abs(size).toLocaleString('en-US', { maximumFractionDigits: 4 })} ${unit}`;

function marginDetail(
  margin: number | null,
  leverage: number | null,
  mode?: string,
): string | undefined {
  const parts = [
    margin == null ? null : `Margin ${compactUsd(margin)}`,
    leverage == null ? null : `${Number(leverage.toFixed(2))}×${mode ? ` ${mode}` : ''}`,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

const priceDecimals = (price: number): number => (price < 1 ? 4 : price < 100 ? 2 : 0);

const entryToMark = (entry: number | null, mark: number | null): string | undefined =>
  entry == null
    ? undefined
    : `Avg entry ${usd(entry, priceDecimals(entry))}${mark == null ? '' : ` → ${usd(mark, priceDecimals(mark))}`}`;

export function lighterPositionRow(p: LighterWirePosition): PerpPosition {
  return {
    pair: p.symbol,
    iconUrl: hyperliquidCoinIconUrl(p.symbol),
    leverage: p.leverage == null ? NO_TOTAL : leverageLabel(p.leverage, p.marginMode),
    side: p.side === 'short' ? 'Short' : 'Long',
    pnl: usdSigned(p.unrealizedPnl),
    pnlNegative: p.unrealizedPnl < 0,
    entry: usd(p.entryPx),
    margin: usd(p.allocatedMargin),
    liqPrice: p.liquidationPx == null ? 'N/A' : usd(p.liquidationPx, 0),
    size: usd(p.positionValue),
    mark: p.size > 0 ? usd(p.positionValue / p.size) : NO_TOTAL,
    markNegative: p.unrealizedPnl < 0,
    funding: NO_TOTAL,
    quantity: quantity(p.size, baseAsset(p.symbol)),
    value: compactUsd(p.positionValue),
    detail: marginDetail(p.allocatedMargin, p.leverage, p.marginMode || undefined),
    entryMark: entryToMark(p.entryPx, p.size > 0 ? p.positionValue / p.size : null),
  };
}

export function attestedPositionRow(p: AttestedWirePosition): PerpPosition {
  const pnl = p.unrealizedPnl;
  return {
    pair: p.symbol,
    iconUrl: hyperliquidCoinIconUrl(p.symbol.replace(/-PERP$/i, '')),
    leverage: p.leverage == null ? NO_TOTAL : leverageLabel(p.leverage, undefined),
    side: p.side === 'short' ? 'Short' : 'Long',
    pnl: pnl == null ? NO_TOTAL : usdSigned(pnl),
    pnlNegative: (pnl ?? 0) < 0,
    entry: p.entryPrice == null ? NO_TOTAL : usd(p.entryPrice),
    margin: p.margin == null ? NO_TOTAL : usd(p.margin),
    liqPrice: p.liquidationPrice == null ? 'N/A' : usd(p.liquidationPrice, 0),
    size: p.positionValue == null ? NO_TOTAL : usd(p.positionValue),
    mark: p.markPrice == null ? NO_TOTAL : usd(p.markPrice),
    markNegative: (pnl ?? 0) < 0,
    funding: p.funding == null ? NO_TOTAL : usdSigned(p.funding),
    quantity: quantity(p.size, p.instrumentType === 'option' ? 'contracts' : baseAsset(p.symbol)),
    ...(p.positionValue == null ? {} : { value: compactUsd(p.positionValue) }),
    detail:
      p.instrumentType === 'option'
        ? p.entryPrice == null
          ? undefined
          : `Premium paid ${usd(Math.abs(p.size) * p.entryPrice, 0)}`
        : marginDetail(p.margin, p.leverage),
    entryMark: entryToMark(p.entryPrice, p.markPrice),
  };
}

export const tierLabel = (tier: { name: string; pointsRate: number }): string =>
  `${tier.name} · ${Number(tier.pointsRate.toFixed(3))}× points`;

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
