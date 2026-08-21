
import type { VoicesHeatmapCell } from '@/shared/voices-social-card';

export const HEATMAP_WEEKS = 53;
export const HEATMAP_ROWS = 7;

const MIN_MONTH_LABEL_COLS = 3;

const toIsoDate = (d: Date): string => d.toISOString().slice(0, 10);

export interface HeatmapLayout {

  grid: (VoicesHeatmapCell | null)[][];
  months: { label: string; startCol: number; endCol: number }[];
}

export function buildHeatmapLayout(
  data: VoicesHeatmapCell[],
  now: Date = new Date(),
): HeatmapLayout {
  const byDate = new Map<string, VoicesHeatmapCell>();
  for (const cell of data) byDate.set(cell.date, cell);

  const endUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const startUtc = new Date(endUtc);
  startUtc.setUTCDate(endUtc.getUTCDate() - endUtc.getUTCDay() - (HEATMAP_WEEKS - 1) * 7);

  const grid: (VoicesHeatmapCell | null)[][] = [];
  for (let w = 0; w < HEATMAP_WEEKS; w += 1) {
    const col: (VoicesHeatmapCell | null)[] = [];
    for (let r = 0; r < HEATMAP_ROWS; r += 1) {
      const cellDate = new Date(startUtc);
      cellDate.setUTCDate(startUtc.getUTCDate() + w * 7 + r);

      col.push(cellDate > endUtc ? null : (byDate.get(toIsoDate(cellDate)) ?? null));
    }
    grid.push(col);
  }

  const months: { label: string; startCol: number; endCol: number }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < HEATMAP_WEEKS; w += 1) {
    const probe = new Date(startUtc);
    probe.setUTCDate(startUtc.getUTCDate() + w * 7);
    const month = probe.getUTCMonth();
    if (month === lastMonth) continue;
    if (months.length > 0) months[months.length - 1].endCol = w;
    months.push({
      label: probe.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
      startCol: w,
      endCol: HEATMAP_WEEKS,
    });
    lastMonth = month;
  }

  return {
    grid,
    months: months.filter(({ startCol, endCol }) => endCol - startCol >= MIN_MONTH_LABEL_COLS),
  };
}
