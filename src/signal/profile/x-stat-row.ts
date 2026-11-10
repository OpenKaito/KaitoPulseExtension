import type { PopoverTotals, SmartFollowerStat, UserInfoData } from '../types';
import { NO_TOTAL } from '../shared/format';
import {
  ACTIVE_FOLLOWERS_LABEL,
  HOME_TIMELINE_IMPRESSIONS_LABEL,
  TOTAL_SMART_FOLLOWERS_LABEL,
  VERIFIED_FOLLOWERS_LABEL,
} from '../social-card-map';

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

  /**
   * `both` only: the two trading cells (Account Value · All-Time P&L) drop to their own second row
   * under the three socials cells (Total · Verified · Home Timeline Impressions) — the Aura V2 design,
   * "一行 socials 一行 trading". Every other mode keeps the single four-column row, so `totals`
   * (when present) renders inline as the last two cells.
   */
  tradingOwnRow: boolean;
}

const isStat = (stat: SmartFollowerStat | undefined): stat is SmartFollowerStat => stat != null;

/** A cell that keeps its slot in the fixed grid under its own label, reading the no-data dash. */
const dash = (label: string): SmartFollowerStat => ({ label, value: NO_TOTAL });

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
  const total = data.smartFollowerTotal ?? dash(TOTAL_SMART_FOLLOWERS_LABEL);
  const categories = orderedCategories(data);

  // The X-verified modes carry the dedicated Home Timeline Impressions cell (the Aura V2 design). Both
  // keep a FIXED socials layout — a missing figure reads the dash in its own slot rather than being
  // replaced by a sector segment — because HTI now owns the cell a segment used to fill. The sector
  // segments still list behind the Total cell's caret, where their ranks are legible.
  if (data.profileCardMode === 'both') {
    // socials row: Total · Verified followers · Home Timeline Impressions. Trading drops to row two.
    const stats = [
      data.verifiedFollowers ?? dash(VERIFIED_FOLLOWERS_LABEL),
      data.homeTimelineImpressions ?? dash(HOME_TIMELINE_IMPRESSIONS_LABEL),
    ];
    // Active is not a cell in `both`, so it stays a candidate behind the caret, as it always has.
    const leftover = [data.activeFollowers].filter(isStat);
    return {
      total,
      stats,
      panel: [...categories, ...leftover],
      hasHidden: categories.length + leftover.length > 0,
      totals,
      tradingOwnRow: true,
    };
  }

  if (data.profileCardMode === 'x_only') {
    // single four-column row: Total · Verified · Active · Home Timeline Impressions.
    const stats = [
      data.verifiedFollowers ?? dash(VERIFIED_FOLLOWERS_LABEL),
      data.activeFollowers ?? dash(ACTIVE_FOLLOWERS_LABEL),
      data.homeTimelineImpressions ?? dash(HOME_TIMELINE_IMPRESSIONS_LABEL),
    ];
    return {
      total,
      stats,
      panel: categories,
      hasHidden: categories.length > 0,
      // x_only has no public trading record, so there are no trailing trading cells.
      totals: undefined,
      tradingOwnRow: false,
    };
  }

  // trading_only / none / undefined: the original sector-segment layout, unchanged. No Home Timeline
  // Impressions here — it only exists for an X-verified account, which these modes are not.
  const slots = Math.max(0, X_STAT_CELLS - 1 - (totals ? 2 : 0));

  const priority = [data.verifiedFollowers, data.activeFollowers].filter(isStat);

  const picked = (modeFollowers(data) ?? priority).filter(isStat).slice(0, slots);

  const leftover = priority.filter((stat) => !picked.includes(stat));

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
    tradingOwnRow: false,
  };
}
