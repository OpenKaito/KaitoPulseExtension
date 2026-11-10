import type {
  BadgeItem,
  FomoBlock,
  FomoWirePosition,
  HoverCardCategory,
  HoverCardResult,
  HoverCardSmartFollowers,
  HoverCardPlatformTotal,
  HoverCardWallet,
  HyperliquidBlock,
  HyperliquidPnlPeriod,
  PolymarketBlock,
  PolymarketPnlPeriod,
  PumpfunBlock,
  PumpfunWireHolding,
} from '@/shared/social-card';
import type {
  AccountPlatformSummary,
  AccountProtocol,
  AccountValueTotal,
  AllTimePnlTotal,
  ChartPoint,
  TokenAccount,
  TokenPlatformSummary,
  TokenProtocol,
  HoverCardStatsView,
  HyperliquidAccount,
  HyperliquidSummary,
  NameTagEntry,
  PolymarketAccount,
  PlatformAccountChip,
  PlatformMetrics,
  PopoverTotals,
  PredictionSummary,
  ReferralTotals,
  SignalPopoverData,
  SignalProtocol,
  SmartFollowerStat,
  TokenPosition,
  UserInfoData,
} from './types';
import { accountSizeTierFromBucket, formatAccountSize } from '@/shared/account-size';
import { PROTOCOL_LABEL } from './protocol-labels';
import {
  SIGNAL_PROTOCOLS,
  isSignalProtocol,
  isSnapshotPlatform,
  platformCategory,
} from './platforms';
import { tokenProfileUrl } from './shared/links';
import type { AccountChip } from './shared/cards';
import {
  NO_TOTAL,
  abs,
  chartPoints,
  compact,
  count,
  countOrDash,
  dataAsOfLabel,
  formatJoined,
  attestedPositionRow,
  tierLabel,
  perpPositionRow,
  points,
  predictionMarketRow,
  truncateAddress,
  usdSigned,
  usd,
} from './shared/format';
import {
  ACCOUNT_VALUE_LABEL,
  ANONYMOUS_ACCOUNT_LABEL,
  ANONYMOUS_WALLET_LABEL,
  BUY_VOLUME_LABEL,
  POSITIONS_COUNT_LABEL,
  POSITIONS_VALUE_LABEL,
  accountsHeading,
} from './shared/stat-labels';

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

  if (badge.platforms.fomo) {
    const n = badge.platforms.fomoPositions ?? 0;
    entries.push({ protocol: 'fomo', positionsCount: n > 0 ? n : null });
  }

  if (badge.platforms.pumpfun) {
    const n = badge.platforms.pumpfunPositions ?? 0;
    entries.push({ protocol: 'pumpfun', positionsCount: n > 0 ? n : null });
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
    name:
      profileHandle != null && !isGeneratedAddressName(profileHandle)
        ? profileHandle
        : wallet
          ? walletChipLabel(wallet)
          : '',
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
    charts[label] = chartPoints(served[wire] ?? served[wire.toUpperCase()] ?? served[label], label);
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

export function isGeneratedAddressName(name: string | null | undefined): boolean {
  return name != null && /^0x[0-9a-fA-F]{40}(-\d+)?$/.test(name.trim());
}

function walletDisplayName(wallet: HoverCardWallet): string {
  const served = wallet.address == null ? '' : (wallet.displayName ?? '');
  return served.length > 0 && !isGeneratedAddressName(served) ? served : walletChipLabel(wallet);
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

function chipCount(accounts: unknown[], platformTotal: HoverCardPlatformTotal | undefined): number {
  return Math.max(accounts.length, platformTotal?.totalAccounts ?? 0);
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
      accountCount: accounts.length,
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
  const chips = chipCount(accounts, platformTotal);

  return {
    heading: accountsHeading(chips, PROTOCOL_LABEL.hyperliquid),
    aggregate: true,
    accounts,
    accountCount: chips,
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
      accountCount: accounts.length,
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
  const chips = chipCount(accounts, platformTotal);

  return {
    heading: accountsHeading(chips, PROTOCOL_LABEL.polymarket),
    aggregate: true,
    accounts,
    accountCount: chips,
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
    rank: category.rank == null || category.count === 0 ? undefined : `#${category.rank}`,
  };
}

export function tokenRow(t: FomoWirePosition | PumpfunWireHolding): TokenPosition {
  const basis = t.costBasis ?? 0;
  const unrealized = t.unrealizedPnl;
  const pct = unrealized != null && basis > 0 ? (unrealized / basis) * 100 : null;
  return {
    symbol: t.symbol,
    iconUrl: t.icon,

    supply: `${compact(t.amount)} ${t.symbol}`,
    value: usd(t.value),
    pnl: unrealized == null ? '-' : usdSigned(unrealized),
    changePct: pct == null ? '' : `${Math.abs(pct).toFixed(2)}%`,
    changeNegative: unrealized != null && unrealized < 0,
  };
}

function fomoPreview(fomo: FomoBlock, pnlAllTime: number | null): TokenAccount {
  const handle = fomo.profile.handle ?? '';
  return {
    name: fomo.profile.name ?? handle,
    avatarUrl: fomo.profile.avatar,
    meta: handle ? `@${handle}` : '',
    bio: fomo.profile.bio ?? '',
    profileUrl: tokenProfileUrl('fomo', handle),
    anonymous: false,
    hasDetail: true,
    hasPositions: fomo.positionsCount > 0,
    accountValue: usd(fomo.equity),
    profitLoss: pnlAllTime == null ? NO_TOTAL : usd(pnlAllTime),
    profitLossNegative: pnlAllTime != null && pnlAllTime < 0,
    trades: count(fomo.trades),
    positionsTotal: fomo.positionsCount,
    tokens: fomo.positions.map(tokenRow),
  };
}

function pumpfunPreview(pump: PumpfunBlock): TokenAccount {
  const handle = pump.profile?.twitterHandle ?? '';
  const name = pump.profile?.name ?? '';
  return {
    name: name.length > 0 ? name : truncateAddress(pump.address),
    address: pump.address,
    avatarUrl: pump.profile?.avatar,
    meta: handle ? `@${handle}` : '',
    bio: pump.profile?.bio ?? '',
    profileUrl: tokenProfileUrl('pumpfun', pump.address),
    anonymous: false,
    hasDetail: true,
    hasPositions: pump.positionsCount > 0,
    accountValue: pump.accountValue == null ? NO_TOTAL : usd(pump.accountValue),
    profitLoss: NO_TOTAL,
    profitLossNegative: false,
    trades: NO_TOTAL,
    positionsTotal: pump.positionsCount,
    tokens: pump.positions.map(tokenRow),
  };
}

function chipOnlyTokenAccount(protocol: TokenProtocol, wallet: HoverCardWallet): TokenAccount {
  const served = wallet.address == null ? '' : (wallet.displayName ?? '');
  return {
    name: served.length > 0 ? served : walletChipLabel(wallet),
    address: protocol === 'pumpfun' ? (wallet.address ?? undefined) : undefined,
    avatarUrl: walletAvatarUrl(wallet),
    meta: '',
    bio: '',
    profileUrl: protocol === 'pumpfun' ? tokenProfileUrl(protocol, wallet.address) : undefined,
    anonymous: wallet.address == null,
    hasDetail: false,
    hasPositions: wallet.hasPositions === true,
    accountValue: NO_TOTAL,
    profitLoss: NO_TOTAL,
    profitLossNegative: false,
    trades: NO_TOTAL,
    positionsTotal: 0,
    tokens: [],
  };
}

export function tokenPlatformChips(accounts: TokenAccount[]): AccountChip[] {
  return accounts.map((a) => ({
    label: a.name,
    avatarUrl: a.avatarUrl,
    hasPositions: a.hasPositions,
    profileUrl: a.profileUrl,
  }));
}

function previewIndex(published: HoverCardWallet[], address: string | null): number {
  if (address == null) return 0;
  const found = published.findIndex((w) => w.address === address);
  return found === -1 ? 0 : found;
}

function mapTokenPlatform(
  protocol: TokenProtocol,
  preview: TokenAccount | null,
  previewAddress: string | null,
  wallets: HoverCardWallet[] | undefined,
  platformTotal: HoverCardPlatformTotal | undefined,
): TokenPlatformSummary | undefined {
  const pnl = platformTotal?.pnlUsd ?? null;

  const published = wallets == null ? null : publishedWallets(protocol, wallets);
  const at = published == null ? 0 : previewIndex(published, previewAddress);

  const accounts: TokenAccount[] =
    published == null || published.length === 0
      ? preview
        ? [preview]
        : []
      : published.map((wallet, i) =>
          i === at && preview ? preview : chipOnlyTokenAccount(protocol, wallet),
        );

  if (platformTotal == null && accounts.length === 0) return undefined;

  const totalAccounts = platformTotal?.totalAccounts ?? accounts.length;
  const single = totalAccounts <= 1;
  const chips = chipCount(accounts, platformTotal);
  const value = single
    ? (preview?.accountValue ?? NO_TOTAL)
    : platformFigure(platformTotal?.valueUsd).text;

  return {
    protocol,
    heading: single
      ? (preview?.name ?? accounts[0]?.name ?? PROTOCOL_LABEL[protocol])
      : accountsHeading(chips, PROTOCOL_LABEL[protocol]),
    aggregate: !single,
    accounts,
    accountCount: chips,
    valueLabel: single ? ACCOUNT_VALUE_LABEL : POSITIONS_VALUE_LABEL,
    accountValue: value,
    profitLoss: pnl == null ? NO_TOTAL : usd(pnl),
    profitLossNegative: pnl != null && pnl < 0,
    countLabel: protocol === 'pumpfun' ? BUY_VOLUME_LABEL : POSITIONS_COUNT_LABEL,
    trades:
      protocol === 'pumpfun'
        ? platformTotal?.buyVolume == null
          ? NO_TOTAL
          : usd(platformTotal.buyVolume)
        : fomoPositionsCount(platformTotal, preview),
    positionsTotal: preview?.positionsTotal ?? 0,
    positionsFooter: protocol === 'fomo' ? 'slice' : 'affordance',
  };
}

function fomoPositionsCount(
  platformTotal: HoverCardPlatformTotal | undefined,
  preview: TokenAccount | null,
): string {
  const n = platformTotal?.positionsCount ?? preview?.positionsTotal;
  return n == null ? NO_TOTAL : count(n);
}

function accountPlatformCharts(
  served: HoverCardPlatformTotal['pnlSeries'] | undefined,
): Record<string, ChartPoint[]> {
  if (served == null) return {};
  const charts: Record<string, ChartPoint[]> = {};
  for (const label of HYPERLIQUID_PERIODS) {
    const points = served[label] ?? served[label.toLowerCase()];
    if (points && points.length > 0) charts[label] = chartPoints(points, label);
  }
  return charts;
}

function accountChip(wallet: HoverCardWallet): PlatformAccountChip {
  const anonymous = wallet.address == null;
  const label = anonymous
    ? wallet.maskedAccountId
      ? wallet.maskedAccountId
      : wallet.ordinal == null
        ? ANONYMOUS_ACCOUNT_LABEL
        : `${ANONYMOUS_ACCOUNT_LABEL} ${wallet.ordinal}`
    : walletDisplayName(wallet);
  return {
    label,
    address: wallet.address,
    anonymous,
    hasPositions: wallet.hasPositions === true,
    ...(wallet.positions ? { positions: wallet.positions.map(attestedPositionRow) } : {}),
    ...(wallet.tier ? { tier: tierLabel(wallet.tier) } : {}),
  };
}

export function mapAccountPlatform(
  protocol: AccountProtocol,
  wallets: HoverCardWallet[] | undefined,
  platformTotal: HoverCardPlatformTotal | undefined,
): AccountPlatformSummary | undefined {
  const accounts = publishedWallets(protocol, wallets).map(accountChip);
  if (platformTotal == null && accounts.length === 0) return undefined;

  const chips = chipCount(accounts, platformTotal);
  const aggregate = chips > 1;
  const value = platformFigure(platformTotal?.valueUsd);
  const pnl = platformFigure(platformTotal?.pnlUsd);
  const upnl = platformFigure(platformTotal?.upnlUsd);
  const label = PROTOCOL_LABEL[protocol];

  return {
    protocol,
    heading: aggregate ? accountsHeading(chips, label) : (accounts[0]?.label ?? label),
    aggregate,
    accounts,
    accountCount: chips,
    accountValue: value.text,
    profitLoss: pnl.text,
    profitLossNegative: pnl.negative,
    upnl: upnl.text,
    upnlNegative: upnl.negative,
    charts: accountPlatformCharts(platformTotal?.pnlSeries),
    positionsCount: platformTotal?.positionsCount ?? null,
    ...(platformTotal?.points != null ? { points: points(platformTotal.points) } : {}),
    dataAsOf: isSnapshotPlatform(protocol, platformTotal?.source)
      ? dataAsOfLabel(platformTotal?.dataAsOf)
      : undefined,
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
export const HOME_TIMELINE_IMPRESSIONS_LABEL = 'Home Timeline Impressions';

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

function inDisplayOrder(platforms: readonly string[]): string[] {
  const rank = (platform: string) => {
    const index = (SIGNAL_PROTOCOLS as readonly string[]).indexOf(platform);
    return index === -1 ? SIGNAL_PROTOCOLS.length : index;
  };
  return platforms
    .map((platform, index) => ({ platform, index }))
    .sort((a, b) => rank(a.platform) - rank(b.platform) || a.index - b.index)
    .map((entry) => entry.platform);
}

function totalPnlText(pnl: number): string {
  const magnitude = Math.abs(pnl);
  const money = `$${abs(pnl, magnitude > 0 && magnitude < 1 ? 2 : 0)}`;
  if (pnl === 0) return money;
  return `${pnl < 0 ? '-' : '+'}${money}`;
}

function mapTotals(result: HoverCardResult): PopoverTotals | undefined {
  const platforms = inDisplayOrder(result.tradingPlatforms ?? []);
  const tier = accountSizeTierFromBucket(result.accountValue?.bucket);
  const pnl = result.allTimePnl?.value;

  const accountValue: AccountValueTotal | undefined =
    tier == null
      ? undefined
      : {
          tier,
          label: formatAccountSize(tier),
          platforms: inDisplayOrder(result.accountValue?.platforms ?? platforms),
        };

  const allTimePnl: AllTimePnlTotal | undefined =
    pnl == null
      ? undefined
      : {
          text: `${result.allTimePnl?.fxApproximate ? '≈' : ''}${totalPnlText(pnl)}`,
          direction: pnl === 0 ? 'flat' : pnl < 0 ? 'loss' : 'gain',
          platforms: inDisplayOrder(result.allTimePnl?.platforms ?? platforms),
          coverage: result.allTimePnl
            ? { covered: result.allTimePnl.coveredAccounts, total: result.allTimePnl.totalAccounts }
            : undefined,
        };

  if (accountValue == null && allTimePnl == null && platforms.length === 0) return undefined;
  return { accountValue, allTimePnl, platforms };
}

function mapReferralTotals(result: HoverCardResult): ReferralTotals | undefined {
  const referral = result.referral;
  if (!referral) return undefined;
  const servedBy = (key: 'referredUsers' | 'referredVolume') =>
    inDisplayOrder(
      referral.platforms.filter((entry) => entry[key] != null).map((entry) => entry.platform),
    );
  const out: ReferralTotals = {
    ...(referral.referredUsers != null
      ? {
          referredUsers: {
            text: count(referral.referredUsers),
            platforms: servedBy('referredUsers'),
          },
        }
      : {}),
    ...(referral.referredVolume != null
      ? {
          referredVolume: {
            text: usd(referral.referredVolume, 0),
            platforms: servedBy('referredVolume'),
          },
        }
      : {}),
  };
  return out.referredUsers || out.referredVolume ? out : undefined;
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
    homeTimelineImpressions: mapFollowerCount(
      result.socialFollowers?.homeTimelineImpressions,
      HOME_TIMELINE_IMPRESSIONS_LABEL,
    ),
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
    fomo: mapTokenPlatform(
      'fomo',
      result.fomo ? fomoPreview(result.fomo, platformTotal(result, 'fomo')?.pnlUsd ?? null) : null,
      null,
      result.tradingWallets,
      platformTotal(result, 'fomo'),
    ),
    pumpfun: mapTokenPlatform(
      'pumpfun',
      result.pumpfun ? pumpfunPreview(result.pumpfun) : null,
      result.pumpfun?.address ?? null,
      result.tradingWallets,
      platformTotal(result, 'pumpfun'),
    ),
    binance: mapAccountPlatform('binance', result.tradingWallets, platformTotal(result, 'binance')),
    okx: mapAccountPlatform('okx', result.tradingWallets, platformTotal(result, 'okx')),
    bybit: mapAccountPlatform('bybit', result.tradingWallets, platformTotal(result, 'bybit')),
    variational: mapAccountPlatform(
      'variational',
      result.tradingWallets,
      platformTotal(result, 'variational'),
    ),
    lighter: mapAccountPlatform('lighter', result.tradingWallets, platformTotal(result, 'lighter')),
    platformMetrics: platformMetricsByPlatform(result),
    platformCategories: Object.fromEntries(
      SIGNAL_PROTOCOLS.map((p) => [p, platformCategory(p, platformTotal(result, p)?.category)]),
    ),
    totals: mapTotals(result),
    referralTotals: mapReferralTotals(result),
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

export function platformMetricsByPlatform(
  result: Pick<HoverCardResult, 'referral' | 'points' | 'tradingPlatformTotals'>,
): Partial<Record<SignalProtocol, PlatformMetrics>> | undefined {
  const out: Partial<Record<SignalProtocol, PlatformMetrics>> = {};
  const put = (platform: string, patch: PlatformMetrics) => {
    if (!isSignalProtocol(platform)) return;
    out[platform] = { ...out[platform], ...patch };
  };
  for (const entry of result.referral?.platforms ?? []) {
    put(entry.platform, {
      ...(entry.referredUsers != null ? { referredTraders: count(entry.referredUsers) } : {}),
      ...(entry.referredVolume != null ? { referredVolume: usd(entry.referredVolume, 0) } : {}),
    });
  }
  for (const total of result.tradingPlatformTotals ?? []) {
    if (total.points != null) put(total.platform, { points: points(total.points) });
  }
  for (const entry of result.points ?? []) put(entry.platform, { points: points(entry.points) });
  const filled = Object.entries(out).filter(([, m]) => m && Object.keys(m).length > 0);
  return filled.length > 0 ? Object.fromEntries(filled) : undefined;
}
