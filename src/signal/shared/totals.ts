import type { PopoverTotals } from '../types';

export function hasServedTotals(totals: PopoverTotals | undefined): boolean {
  return totals != null && (totals.accountValue != null || totals.allTimePnl != null);
}
