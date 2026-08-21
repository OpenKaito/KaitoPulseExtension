
import { ACCOUNT_SIZE_FLOOR_USD } from '@/shared/account-size';

export const NO_VALUE = '-';

export function formatCount(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? NO_VALUE : value.toLocaleString('en-US');
}

export function pnlTone(value: number | null | undefined): 'profit' | 'loss' | null {
  if (value == null || !Number.isFinite(value) || value === 0) return null;
  return value < 0 ? 'loss' : 'profit';
}

export function formatSignedUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return NO_VALUE;
  const sign = value < 0 ? '-' : '+';
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString('en-US')}`;
}

export function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return NO_VALUE;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatSignedUsdCents(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return NO_VALUE;
  const sign = value < 0 ? '-' : '+';
  const abs = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}$${abs}`;
}

export function formatSubDollarAccountValue(usd: number | null | undefined): string | null {
  if (usd == null || !Number.isFinite(usd)) return null;
  if (usd < 0 || usd >= ACCOUNT_SIZE_FLOOR_USD) return null;
  if (usd > 0 && usd < 0.01) return '<$0.01';
  return formatUsd(usd);
}

export const FX_APPROXIMATE_TITLE =
  'Converted to USD at a single point-in-time exchange rate. This P&L accumulated over a period, so the dollar figure is approximate.';

export function approxFigure(
  text: string,
  approximate: boolean | undefined,
): { text: string; approx: boolean } {
  const approx = Boolean(approximate) && text !== NO_VALUE;
  return { text: approx ? `≈${text}` : text, approx };
}

export function formatDelta(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value) || value === 0) return null;
  return `${value > 0 ? '+' : ''}${value.toLocaleString('en-US')} today`;
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return '0';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
