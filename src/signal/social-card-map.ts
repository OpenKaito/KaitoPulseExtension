
import type {
  BadgeItem,
  HoverCardResult,
  HoverCardSmartFollowers,
  HyperliquidBlock,
  PolymarketBlock,
} from '@/shared/social-card';
import type {
  HyperliquidSummary,
  NameTagEntry,
  PerpPosition,
  PredictionMarket,
  PopoverTotals,
  PredictionSummary,
  SignalPopoverData,
  SmartFollowerStat,
  UserInfoData,
} from './types';
import { accountSizeTierFromBucket, formatAccountSize } from '@/shared/account-size';
import { hyperliquidCoinIconUrl } from './shared/links';

export function badgeToNameTagEntries(badge: BadgeItem | null): NameTagEntry[] {
  if (!badge) return [];
  const entries: NameTagEntry[] = [];
  if (badge.platforms.hl) {
    const n = badge.platforms.hlPositions ?? 0;
    entries.push({ protocol: 'hyperliquid', positionsCount: n > 0 ? n : null });
  }
  if (badge.platforms.pm) {
    const n = badge.platforms.pmPositions ?? 0;
    entries.push({ protocol: 'polymarket', positionsCount: n > 0 ? n : null });
  }

  return entries;
}

const abs = (n: number, decimals: number) =>
  Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const usd = (n: number, decimals = 2) => `${n < 0 ? '-' : ''}$${abs(n, decimals)}`;

const usdSigned = (n: number, decimals = 2) => `${n < 0 ? '-' : '+'}$${abs(n, decimals)}`;

const pctSigned = (n: number) => `${n < 0 ? '-' : '+'}${Math.abs(n).toFixed(2)}`;

const NO_TOTAL = '-';

const count = (n: number) => n.toLocaleString('en-US');

const cents = (n: number) => `${(n * 100).toFixed(1)}¢`;

const shares = (n: number | undefined) =>
  typeof n === 'number' && Number.isFinite(n)
    ? `${n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} shares`
    : '';

const truncateAddress = (addr: string): string =>
  addr.length <= 11 ? addr : `${addr.slice(0, 6)}…${addr.slice(-4)}`;

function formatJoined(raw?: string): string | null {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function compact(n: number): string {
  return n.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
}

function chartTime(t: number, period: string): string {
  const date = new Date(t < 1e12 ? t * 1000 : t);
  if (Number.isNaN(date.getTime())) return '';
  return period === '1D'
    ? date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function mapHyperliquid(hl: HyperliquidBlock): HyperliquidSummary {
  const positions: PerpPosition[] = hl.positions.map((p) => ({
    pair: p.coin,
    iconUrl: hyperliquidCoinIconUrl(p.coin),
    leverage: `${p.leverage}X`,
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
  }));

  return {
    address: hl.wallet,
    addressShort: truncateAddress(hl.wallet),
    accountValue: usd(hl.accountValue),
    profitLoss: usd(hl.pnlAllTime),
    profitLossNegative: hl.pnlAllTime < 0,
    upnl: usd(hl.uPnl),
    upnlNegative: hl.uPnl < 0,

    charts: {
      "1D": (hl.pnlSeries["1D"] ?? []).map((p) => ({ v: p.v, label: usd(p.v), time: chartTime(p.t, "1D") })),
      "1W": (hl.pnlSeries["1W"] ?? []).map((p) => ({ v: p.v, label: usd(p.v), time: chartTime(p.t, "1W") })),
      "1M": (hl.pnlSeries["1M"] ?? []).map((p) => ({ v: p.v, label: usd(p.v), time: chartTime(p.t, "1M") })),
      ALL: (hl.pnlSeries.ALL ?? []).map((p) => ({ v: p.v, label: usd(p.v), time: chartTime(p.t, "ALL") })),
    },

    positionsTotal: hl.positionsCount,
    positions,
  };
}

function mapPolymarket(pm: PolymarketBlock): PredictionSummary {
  const joined = formatJoined(pm.profile.joinedAt);
  const metaParts: string[] = [];
  if (joined) metaParts.push(`Joined ${joined}`);
  if (pm.profile.views != null) metaParts.push(`${compact(pm.profile.views)} views`);

  const markets: PredictionMarket[] = pm.markets.map((m) => ({
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
  }));

  return {
    name: pm.profile.name ?? pm.profile.pseudonym ?? '',
    avatarUrl: pm.profile.avatar,
    meta: metaParts.join('·'),
    bio: pm.profile.bio ?? '',
    positionsValue: usd(pm.positionsValue),
    profitLoss: usd(pm.pnlAllTime),
    profitLossNegative: pm.pnlAllTime < 0,
    predictions: count(pm.predictions),

    charts: {
      "1D": (pm.pnlSeries["1d"] ?? []).map((p) => ({ v: p.p, label: usd(p.p), time: chartTime(p.t, "1D") })),
      "1W": (pm.pnlSeries["1w"] ?? []).map((p) => ({ v: p.p, label: usd(p.p), time: chartTime(p.t, "1W") })),
      "1M": (pm.pnlSeries["1m"] ?? []).map((p) => ({ v: p.p, label: usd(p.p), time: chartTime(p.t, "1M") })),
      ALL: (pm.pnlSeries.all ?? []).map((p) => ({ v: p.p, label: usd(p.p), time: chartTime(p.t, "ALL") })),
    },

    positionsTotal: pm.positionsCount,
    markets,
  };
}

function mapFollowerCategories(
  categories: HoverCardSmartFollowers['categories'],
): SmartFollowerStat[] {
  return categories.map((c) => ({
    label: c.label,
    value: count(c.count),
    rank: `#${c.rank}`,
  }));
}

export const TOTAL_SMART_FOLLOWERS_LABEL = 'Total Smart followers';

function mapTotals(result: HoverCardResult): PopoverTotals | undefined {
  const bucket = result.accountValue?.bucket;
  const pnl = result.allTimePnl?.value;

  const platforms = result.tradingPlatforms ?? [];

  if (bucket == null && pnl == null && platforms.length === 0) return undefined;

  const tier = accountSizeTierFromBucket(bucket);
  const coverage = result.allTimePnl
    ? { covered: result.allTimePnl.coveredAccounts, total: result.allTimePnl.totalAccounts }
    : undefined;

  return {
    accountSizeTier: tier,
    accountSizeLabel: tier == null ? NO_TOTAL : formatAccountSize(tier),

    allTimePnl:
      pnl == null
        ? NO_TOTAL
        : `${result.allTimePnl?.fxApproximate ? '≈' : ''}${pnl < 0 ? '-' : '+'}$${abs(pnl, 0)}`,
    allTimePnlDirection: pnl == null ? null : pnl === 0 ? 'flat' : pnl < 0 ? 'loss' : 'gain',
    coverage,

    accountValuePlatforms: result.accountValue?.platforms ?? platforms,
    allTimePnlPlatforms: result.allTimePnl?.platforms ?? platforms,
  };
}

export function hoverCardToPopoverData(result: HoverCardResult): SignalPopoverData {
  const sf = result.smartFollowers;
  const smartFollowers: SmartFollowerStat[] = sf
    ? [{ label: TOTAL_SMART_FOLLOWERS_LABEL, value: count(sf.total) }, ...mapFollowerCategories(sf.categories)]
    : [];

  return {
    smartFollowers,
    bio: result.profile?.bio,
    hyperliquid: result.hyperliquid ? mapHyperliquid(result.hyperliquid) : undefined,
    polymarket: result.polymarket ? mapPolymarket(result.polymarket) : undefined,

    compareValues: {
      hyperliquid: result.hyperliquid?.accountValue,
      polymarket: result.polymarket?.positionsValue,
    },
    totals: mapTotals(result),
  };
}

export function hoverCardToFollowerStats(result: HoverCardResult): SmartFollowerStat[] {
  if (!result.smartFollowers) return [];
  return mapFollowerCategories(result.smartFollowers.categories).map(({ label, value }) => ({ label, value }));
}

export function hoverCardToUserInfoData(result: HoverCardResult): UserInfoData {
  return {
    ...hoverCardToPopoverData(result),
    topSmartFollowers: (result.smartFollowers?.topFollowers ?? []).map((f) => ({
      avatarUrl: f.avatarUrl,
      username: f.username,
      name: f.name,
    })),
  };
}
