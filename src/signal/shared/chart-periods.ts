import type { ChartPoint } from '../types';

export function hasChartPoints(charts: Record<string, ChartPoint[]>): boolean {
  return Object.values(charts).some((points) => points.some((point) => point.v !== 0));
}

export function servedPeriod(charts: Record<string, ChartPoint[]>, period: string): string {
  const keys = Object.keys(charts).filter((key) => charts[key].length > 0);
  return keys.includes(period) ? period : (keys[keys.length - 1] ?? period);
}
