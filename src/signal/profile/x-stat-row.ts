import type { PopoverTotals, SmartFollowerStat, UserInfoData } from '../types';
import { NO_TOTAL } from '../shared/format';
import { TOTAL_SMART_FOLLOWERS_LABEL } from '../social-card-map';

const X_STAT_CELLS = 4;

/*
 * `smartFollowers: null` on the wire = the SF hop missed or errored, so there is
 * no `topSegment` to name the segment cell after. The row is a fixed 4-column
 * grid, so the cell keeps its slot under a neutral label and reads the same
 * no-data dash the trading cells use, rather than leaving a hole at the end.
 */
const SEGMENT_PLACEHOLDER_LABEL = 'Smart followers';

export interface XStatRow {
  total: SmartFollowerStat;

  stats: SmartFollowerStat[];

  panel: SmartFollowerStat[];

  hasHidden: boolean;

  totals?: PopoverTotals;
}

function modeFollowers(data: UserInfoData): Array<SmartFollowerStat | undefined> | null {
  switch (data.profileCardMode) {
    case 'both':
      return [data.verifiedFollowers];
    case 'x_only':
      return [data.verifiedFollowers, data.activeFollowers];
    case 'trading_only':
    case 'none':
      return [];
    default:
      return null;
  }
}

function orderedCategories(data: UserInfoData): SmartFollowerStat[] {
  const categories = data.smartFollowerCategories ?? [];
  const top = data.topSegment;
  if (!top) return categories;
  return [top, ...categories.filter((c) => c.label !== top.label)];
}

export function buildXStatRow(data: UserInfoData): XStatRow {
  const totals = data.totals;
  const total = data.smartFollowerTotal ?? {
    label: TOTAL_SMART_FOLLOWERS_LABEL,
    value: NO_TOTAL,
  };
  const slots = Math.max(0, X_STAT_CELLS - 1 - (totals ? 2 : 0));

  const priority = [data.verifiedFollowers, data.activeFollowers].filter(
    (stat): stat is SmartFollowerStat => stat != null,
  );

  const picked = (modeFollowers(data) ?? priority)
    .filter((stat): stat is SmartFollowerStat => stat != null)
    .slice(0, slots);

  const leftover = priority.filter((stat) => !picked.includes(stat));

  const categories = orderedCategories(data);
  const shown = categories.slice(0, Math.max(0, slots - picked.length));
  const hiddenCategories = categories.slice(shown.length);

  const holes = Math.max(0, slots - shown.length - picked.length);

  return {
    total,
    stats: [
      ...shown.map((stat) =>
        hiddenCategories.length > 0 ? { ...stat, label: `${stat.label} Smart followers` } : stat,
      ),

      ...Array.from({ length: holes }, () => ({
        label: SEGMENT_PLACEHOLDER_LABEL,
        value: NO_TOTAL,
      })),
      ...picked,
    ],

    panel: [...categories, ...leftover],
    hasHidden: hiddenCategories.length + leftover.length > 0,
    totals,
  };
}
