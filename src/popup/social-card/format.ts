
export const exact = (value: number): string => Math.round(value).toLocaleString('en-US');

const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export const compact = (value: number): string => COMPACT.format(value);

export function rankPercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0%';
  if (value < 0.0003) return '0.0003%';
  if (value < 0.01) return `${Number(value.toPrecision(1))}%`;
  return `${Number(value.toPrecision(2))}%`;
}

export const rankOrNA = (rank: number): string => (rank > 0 ? `#${exact(rank)}` : 'N/A');

export const todayIso = (): string => new Date().toISOString().slice(0, 10);
