import type {
  BadgeItem,
  HoverCardCategory,
  HoverCardResult,
  HoverCardSmartFollowers,
  HoverCardPlatformTotal,
  HoverCardWallet,
  HyperliquidBlock,
  HyperliquidPnlPeriod,
  PolymarketBlock,
  PolymarketPnlPeriod,
} from '@/shared/social-card';
import type {
  AccountValueTotal,
  AllTimePnlTotal,
  ChartPoint,
  HoverCardStatsView,
  HyperliquidAccount,
  HyperliquidSummary,
  NameTagEntry,
  PolymarketAccount,
  PopoverTotals,
  PredictionSummary,
  SignalPopoverData,
  SmartFollowerStat,
  UserInfoData,
} from './types';
import { accountSizeTierFromBucket, formatAccountSize } from '@/shared/account-size';
import { PROTOCOL_LABEL } from './protocol-labels';
import {
  NO_TOTAL,
  abs,
  chartPoints,
  compact,
  count,
  countOrDash,
  formatJoined,
  perpPositionRow,
  predictionMarketRow,
  truncateAddress,
  usd,
} from './shared/format';
import { ANONYMOUS_WALLET_LABEL, accountsHeading } from './shared/stat-labels';

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

function mapHyperliquidPreview(
  hl: HyperliquidBlock,
  wallet: HoverCardWallet | null,
): HyperliquidAccount {
  return {
    address: hl.wallet,
    addressShort: truncateAddress(hl.wallet),

    anonymous: false,
    hasDetail: true,
    hasPositions: wallet?.hasPositions ?? hl.positionsCount > 0,
    accountValue: usd(hl.accountValue),
    profitLoss: usd(hl.pnlAllTime),
    profitLossNegative: hl.pnlAllTime < 0,
    upnl: usd(hl.uPnl),
    upnlNegative: hl.uPnl < 0,

    charts: hyperliquidCharts(hl),

    positionsTotal: hl.positionsCount,
    positions: hl.positions.map(perpPositionRow),
  };
}

function mapPolymarketPreview(
  pm: PolymarketBlock,
  wallet: HoverCardWallet | null,
): PolymarketAccount {
  const joined = formatJoined(pm.profile.joinedAt);
  const metaParts: string[] = [];
  if (joined) metaParts.push(`Joined ${joined}`);
  if (pm.profile.views != null) metaParts.push(`${compact(pm.profile.views)} views`);

  const profileHandle = pm.profile.name ?? pm.profile.pseudonym ?? null;
  return {
    name: profileHandle ?? (wallet ? walletChipLabel(wallet) : ''),
    address: wallet?.address ?? null,
    profileHandle,
    avatarUrl: pm.profile.avatar,

    anonymous: false,
    hasDetail: true,
    hasPositions: wallet?.hasPositions ?? pm.positionsCount > 0,
    meta: metaParts.join('·'),
    bio: pm.profile.bio ?? '',
    positionsValue: usd(pm.positionsValue),
    profitLoss: usd(pm.pnlAllTime),
    profitLossNegative: pm.pnlAllTime < 0,
    predictions: count(pm.predictions),

    charts: polymarketCharts(pm),

    positionsTotal: pm.positionsCount,
    markets: pm.markets.map(predictionMarketRow),
  };
}

const HYPERLIQUID_PERIODS: HyperliquidPnlPeriod[] = ['1D', '1W', '1M', 'ALL'];

const POLYMARKET_PERIODS: Array<[label: string, wire: PolymarketPnlPeriod]> = [
  ['1D', '1d'],
  ['1W', '1w'],
  ['1M', '1m'],
  ['ALL', 'all'],
];

const HYPERLIQUID_SERIES_WINDOWS: Array<[label: string, wire: string]> = HYPERLIQUID_PERIODS.map(
  (period) => [period, period],
);

const POLYMARKET_SERIES_WINDOWS: Array<[label: string, wire: string]> = POLYMARKET_PERIODS;

function platformCharts(
  windows: Array<[label: string, wire: string]>,
  served: HoverCardPlatformTotal['pnlSeries'] | undefined,
): Record<string, ChartPoint[]> | null {
  if (served == null) return null;
  const charts: Record<string, ChartPoint[]> = {};
  let points = 0;
  for (const [label, wire] of windows) {
    charts[label] = chartPoints(served[wire], label);
    points += charts[label].length;
  }
  return points > 0 ? charts : null;
}

function hyperliquidCharts(hl: HyperliquidBlock): Record<string, ChartPoint[]> {
  return Object.fromEntries(
    HYPERLIQUID_PERIODS.map((period) => [period, chartPoints(hl.pnlSeries[period], period)]),
  );
}

function polymarketCharts(pm: PolymarketBlock): Record<string, ChartPoint[]> {
  return Object.fromEntries(
    POLYMARKET_PERIODS.map(([label, wire]) => [
      label,
      chartPoints(
        (pm.pnlSeries[wire] ?? []).map((p) => ({ t: p.t, v: p.p })),
        label,
      ),
    ]),
  );
}

function publishedWallets(
  platform: string,
  wallets: HoverCardWallet[] | undefined,
): HoverCardWallet[] {
  return (wallets ?? []).filter((w) => w.platform === platform);
}

function walletChipLabel(wallet: HoverCardWallet): string {
  if (wallet.address) return truncateAddress(wallet.address);
  return wallet.ordinal == null
    ? ANONYMOUS_WALLET_LABEL
    : `${ANONYMOUS_WALLET_LABEL} ${wallet.ordinal}`;
}

function walletDisplayName(wallet: HoverCardWallet): string {
  const served = wallet.address == null ? '' : (wallet.displayName ?? '');
  return served.length > 0 ? served : walletChipLabel(wallet);
}

function walletAvatarUrl(wallet: HoverCardWallet): string | undefined {
  const served = wallet.address == null ? '' : (wallet.avatarUrl ?? '');
  return served.length > 0 ? served : undefined;
}

function chipOnlyHyperliquidAccount(wallet: HoverCardWallet): HyperliquidAccount {
  return {
    address: wallet.address,
    addressShort: walletChipLabel(wallet),
    anonymous: wallet.address == null,
    hasDetail: wallet.address != null,
    hasPositions: wallet.hasPositions === true,
    accountValue: NO_TOTAL,
    profitLoss: NO_TOTAL,
    profitLossNegative: false,
    upnl: NO_TOTAL,
    upnlNegative: false,
    charts: {},
    positionsTotal: 0,
    positions: [],
  };
}

function chipOnlyPolymarketAccount(wallet: HoverCardWallet): PolymarketAccount {
  const served = wallet.address == null ? null : (wallet.displayName ?? null);
  return {
    name: walletDisplayName(wallet),
    address: wallet.address,
    profileHandle: served != null && served.length > 0 ? served : null,
    avatarUrl: walletAvatarUrl(wallet),
    anonymous: wallet.address == null,
    hasDetail: wallet.address != null,
    hasPositions: wallet.hasPositions === true,
    meta: '',
    bio: '',
    positionsValue: NO_TOTAL,
    profitLoss: NO_TOTAL,
    profitLossNegative: false,
    predictions: NO_TOTAL,
    charts: {},
    positionsTotal: 0,
    markets: [],
  };
}

function platformFigure(served: number | null | undefined): { text: string; negative: boolean } {
  return served == null
    ? { text: NO_TOTAL, negative: false }
    : { text: usd(served), negative: served < 0 };
}

function attributeHyperliquid(
  block: HyperliquidBlock | null,
  published: HoverCardWallet[],
): HoverCardWallet | null {
  if (!block) return null;
  const key = block.wallet.toLowerCase();
  return published.find((w) => w.address?.toLowerCase() === key) ?? null;
}

function attributePolymarket(
  block: PolymarketBlock | null,
  published: HoverCardWallet[],
): HoverCardWallet | null {
  if (!block || block.selectedFrom !== 1) return null;
  const only = published.length === 1 ? published[0] : null;
  return only?.address != null ? only : null;
}

function claimableCharts(
  charts: Record<string, ChartPoint[]>,
  platformTotal: HoverCardPlatformTotal | undefined,
  attributed: boolean,
): Record<string, ChartPoint[]> {
  if (platformTotal == null) return charts;
  return platformTotal.totalAccounts <= 1 && attributed ? charts : {};
}

function mapHyperliquid(
  block: HyperliquidBlock | null,
  wallets: HoverCardWallet[] | undefined,
  platformTotal: HoverCardPlatformTotal | undefined,
): HyperliquidSummary | undefined {
  const published = wallets == null ? null : publishedWallets('hyperliquid', wallets);
  const attributed = published == null ? null : attributeHyperliquid(block, published);

  const preview =
    block && (attributed != null || published == null)
      ? mapHyperliquidPreview(block, attributed)
      : null;

  const accounts: HyperliquidAccount[] =
    published == null
      ? preview
        ? [preview]
        : []
      : published.map((wallet) =>
          wallet === attributed && preview ? preview : chipOnlyHyperliquidAccount(wallet),
        );

  if (platformTotal == null && accounts.length === 0) return undefined;

  const singleWallet = published != null && published.length === 1 && preview != null;

  const charts =
    platformCharts(HYPERLIQUID_SERIES_WINDOWS, platformTotal?.pnlSeries) ??
    claimableCharts(
      preview?.charts ?? {},
      singleWallet ? undefined : platformTotal,
      preview != null,
    );

  if (platformTotal == null || singleWallet) {
    return {
      heading: preview?.addressShort ?? accounts[0]?.addressShort ?? PROTOCOL_LABEL.hyperliquid,
      aggregate: false,
      accounts,
      accountValue: preview?.accountValue ?? NO_TOTAL,
      profitLoss: preview?.profitLoss ?? NO_TOTAL,
      profitLossNegative: preview?.profitLossNegative ?? false,
      upnl: preview?.upnl ?? NO_TOTAL,
      upnlNegative: preview?.upnlNegative ?? false,
      charts,
      positionsTotal: preview?.positionsTotal ?? 0,
    };
  }

  const value = platformFigure(platformTotal.valueUsd);
  const pnl = platformFigure(platformTotal.pnlUsd);
  const upnl = platformFigure(platformTotal.upnlUsd);

  return {
    heading: accountsHeading(platformTotal.totalAccounts, PROTOCOL_LABEL.hyperliquid),
    aggregate: true,
    accounts,
    accountValue: value.text,
    profitLoss: pnl.text,
    profitLossNegative: pnl.negative,
    upnl: upnl.text,
    upnlNegative: upnl.negative,
    charts,
    positionsTotal: preview?.positionsTotal ?? 0,
  };
}

function mapPolymarket(
  block: PolymarketBlock | null,
  wallets: HoverCardWallet[] | undefined,
  platformTotal: HoverCardPlatformTotal | undefined,
): PredictionSummary | undefined {
  const published = wallets == null ? null : publishedWallets('polymarket', wallets);
  const attributed = published == null ? null : attributePolymarket(block, published);

  const preview =
    block && (attributed != null || published == null)
      ? mapPolymarketPreview(block, attributed)
      : null;

  const accounts: PolymarketAccount[] =
    published == null
      ? preview
        ? [preview]
        : []
      : published.map((wallet) =>
          wallet === attributed && preview ? preview : chipOnlyPolymarketAccount(wallet),
        );

  if (platformTotal == null && accounts.length === 0) return undefined;

  const singleWallet = published != null && published.length === 1 && preview != null;

  const charts =
    platformCharts(POLYMARKET_SERIES_WINDOWS, platformTotal?.pnlSeries) ??
    claimableCharts(
      preview?.charts ?? {},
      singleWallet ? undefined : platformTotal,
      preview != null,
    );

  if (platformTotal == null || singleWallet) {
    return {
      heading: preview?.name || accounts[0]?.name || PROTOCOL_LABEL.polymarket,
      aggregate: false,
      accounts,
      positionsValue: preview?.positionsValue ?? NO_TOTAL,
      profitLoss: preview?.profitLoss ?? NO_TOTAL,
      profitLossNegative: preview?.profitLossNegative ?? false,
      predictions: preview?.predictions ?? NO_TOTAL,
      charts,
      positionsTotal: preview?.positionsTotal ?? 0,
    };
  }

  const value = platformFigure(platformTotal.valueUsd);
  const pnl = platformFigure(platformTotal.pnlUsd);

  return {
    heading: accountsHeading(platformTotal.totalAccounts, PROTOCOL_LABEL.polymarket),
    aggregate: true,
    accounts,
    positionsValue: value.text,
    profitLoss: pnl.text,
    profitLossNegative: pnl.negative,
    predictions: countOrDash(platformTotal.predictionsCount),
    charts,
    positionsTotal: preview?.positionsTotal ?? 0,
  };
}

function mapFollowerCategory(category: HoverCardCategory): SmartFollowerStat {
  return {
    label: category.label,
    value: countOrDash(category.count),
    rank: category.rank == null ? undefined : `#${category.rank}`,
  };
}

function mapFollowerCategories(
  categories: HoverCardSmartFollowers['categories'],
): SmartFollowerStat[] {
  return categories.map(mapFollowerCategory);
}

export const TOTAL_SMART_FOLLOWERS_LABEL = 'Total Smart followers';

export const VERIFIED_FOLLOWERS_LABEL = 'Verified followers';
export const ACTIVE_FOLLOWERS_LABEL = 'Active followers';

function mapFollowerCount(
  raw: number | null | undefined,
  label: string,
  verifiedBadge?: boolean,
): SmartFollowerStat | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  return verifiedBadge
    ? { label, value: count(raw), verifiedBadge: true }
    : { label, value: count(raw) };
}

function mapTotals(result: HoverCardResult): PopoverTotals | undefined {
  const platforms = result.tradingPlatforms ?? [];
  const tier = accountSizeTierFromBucket(result.accountValue?.bucket);
  const pnl = result.allTimePnl?.value;

  const accountValue: AccountValueTotal | undefined =
    tier == null
      ? undefined
      : {
          tier,
          label: formatAccountSize(tier),
          platforms: result.accountValue?.platforms ?? platforms,
        };

  const allTimePnl: AllTimePnlTotal | undefined =
    pnl == null
      ? undefined
      : {
          text: `${result.allTimePnl?.fxApproximate ? '≈' : ''}${pnl < 0 ? '-' : '+'}$${abs(pnl, 0)}`,
          direction: pnl === 0 ? 'flat' : pnl < 0 ? 'loss' : 'gain',
          platforms: result.allTimePnl?.platforms ?? platforms,
          coverage: result.allTimePnl
            ? { covered: result.allTimePnl.coveredAccounts, total: result.allTimePnl.totalAccounts }
            : undefined,
        };

  if (accountValue == null && allTimePnl == null && platforms.length === 0) return undefined;
  return { accountValue, allTimePnl, platforms };
}

function platformTotal(
  result: HoverCardResult,
  platform: string,
): HoverCardPlatformTotal | undefined {
  return result.tradingPlatformTotals?.find((p) => p.platform === platform);
}

export function hoverCardToPopoverData(result: HoverCardResult): SignalPopoverData {
  const sf = result.smartFollowers;
  const smartFollowerTotal: SmartFollowerStat | undefined = sf
    ? { label: TOTAL_SMART_FOLLOWERS_LABEL, value: countOrDash(sf.total) }
    : undefined;
  const smartFollowerCategories = sf ? mapFollowerCategories(sf.categories) : [];

  const smartFollowers: SmartFollowerStat[] = smartFollowerTotal
    ? [smartFollowerTotal, ...smartFollowerCategories]
    : [];

  return {
    smartFollowers,
    smartFollowerTotal,
    smartFollowerCategories,
    topSegment: sf?.topSegment ? mapFollowerCategory(sf.topSegment) : undefined,
    verifiedFollowers: mapFollowerCount(
      result.socialFollowers?.verified,
      VERIFIED_FOLLOWERS_LABEL,
      true,
    ),
    activeFollowers: mapFollowerCount(result.socialFollowers?.active, ACTIVE_FOLLOWERS_LABEL),
    profileCardMode: result.profileCardMode,
    bio: result.profile?.bio,
    hyperliquid: mapHyperliquid(
      result.hyperliquid,
      result.tradingWallets,
      platformTotal(result, 'hyperliquid'),
    ),
    polymarket: mapPolymarket(
      result.polymarket,
      result.tradingWallets,
      platformTotal(result, 'polymarket'),
    ),
    totals: mapTotals(result),
  };
}

export function hoverCardToFollowerStats(result: HoverCardResult): HoverCardStatsView {
  const social = result.socialFollowers;
  const categories = result.smartFollowers?.categories ?? [];
  return {
    verified: mapFollowerCount(social?.verified, VERIFIED_FOLLOWERS_LABEL, true),
    active: mapFollowerCount(social?.active, ACTIVE_FOLLOWERS_LABEL),
    categories: mapFollowerCategories(categories).map(({ label, value }) => ({ label, value })),
  };
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
