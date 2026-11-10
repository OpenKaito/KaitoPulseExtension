import type {
  FomoBlock,
  FomoPnlPeriod,
  FomoWirePosition,
  FomoWireProfile,
  BadgeItem,
  HoverCardCategory,
  HoverCardPlatformTotal,
  HoverCardResult,
  HoverCardSocialFollowers,
  HoverCardSmartFollowers,
  HoverCardWallet,
  HyperliquidBlock,
  HyperliquidPnlPeriod,
  PumpfunBlock,
  PumpfunWireHolding,
  PumpfunWireProfile,
  PumpfunWireWindowPnl,
  HyperliquidPosition,
  PolymarketBlock,
  PolymarketMarket,
  PolymarketPnlPeriod,
  PolymarketProfile,
  ProfileCardMode,
} from '@/shared/social-card';
import type {
  WalletDetailOutcome,
  WalletDetailRequest,
  WalletDetailResult,
} from '@/shared/wallet-detail';
import { mockConfig, watchMockConfig, type MockConfig } from './settings';

const MOCK_BUCKET = '10M+';
const MOCK_PNL = 9_097_494;

const MOCK_PLATFORMS = ['hyperliquid', 'polymarket'];

const MOCK_VERIFIED_FOLLOWERS = 880;
const MOCK_ACTIVE_FOLLOWERS = 1_200;
const MOCK_HOME_TIMELINE_IMPRESSIONS = 2_456;
const MOCK_X_FOLLOWERS_TOTAL = 48_200;
const MOCK_FOLLOWERS_VERIFIED_AT = '2026-08-13T00:00:00.000Z';

const PROFILE_CARD_SMART_FOLLOWERS: HoverCardSmartFollowers = {
  total: 12_456,
  categories: [
    { key: 'crypto', label: 'Crypto', count: 880, rank: 1 },
    { key: 'ai', label: 'AI', count: 6_324, rank: 1 },
    { key: 'equity_trading', label: 'Equity Trading', count: 4_500, rank: 45 },
  ],
  topSegment: { key: 'ai', label: 'AI', count: 6_324, rank: 1 },
  topFollowers: [],
};

const HL_WALLET = '0x8def7c1b4e0a6f3d9c85a2b71f4e0d3c6a9b2dae';
const HL_ACCOUNT_VALUE = 455_426.97;
const HL_PNL_ALL_TIME = -14_023.09;
const HL_POSITIONS_TOTAL = 7;
const HL_SMART_FOLLOWERS = 1_284;

const HL_POSITIONS: HyperliquidPosition[] = [
  {
    coin: 'BTC/USDC',
    side: 'long',
    leverage: 10,
    marginMode: 'cross',
    entryPx: 61_240.5,
    marginUsed: 28_400,
    liquidationPx: 55_120,
    positionValue: 284_000,
    markPx: 63_180.25,
    funding: -412.86,
    unrealizedPnl: 8_994.12,
  },
  {
    coin: 'ETH/USDC',
    side: 'short',
    leverage: 5,
    marginMode: 'isolated',
    entryPx: 3_120.8,
    marginUsed: 12_600,
    liquidationPx: 3_610.4,
    positionValue: 63_000,
    markPx: 3_268.15,
    funding: 128.44,
    unrealizedPnl: -2_975.6,
  },
  {
    coin: 'HYPE/USDC',
    side: 'long',
    leverage: 3,
    marginMode: '',
    entryPx: 28.4,
    marginUsed: 9_400,
    liquidationPx: null,
    positionValue: 28_200,
    markPx: 31.05,
    funding: -63.2,
    unrealizedPnl: 2_631.5,
  },
];

const HL_U_PNL = HL_POSITIONS.reduce((n, p) => n + p.unrealizedPnl, 0);

const HL_SERIES: Record<
  HyperliquidPnlPeriod,
  { points: number; stepMs: number; end: number; swing: number }
> = {
  '1D': { points: 24, stepMs: 60 * 60 * 1000, end: 1_842.55, swing: 900 },
  '1W': { points: 28, stepMs: 6 * 60 * 60 * 1000, end: -3_517.4, swing: 2_600 },
  '1M': { points: 30, stepMs: 24 * 60 * 60 * 1000, end: 6_204.18, swing: 4_100 },
  ALL: { points: 36, stepMs: 30 * 24 * 60 * 60 * 1000, end: HL_PNL_ALL_TIME, swing: 21_000 },
};

const PM_PROXY_WALLET = '0x7737bf5f66d0ba7e1c1ac1b1a2a0d5c3e9f4b5a6';
const PM_POSITIONS_VALUE = 9_113.22;
const PM_PNL_ALL_TIME = 14_023.09;
const PM_PREDICTIONS = 590;
const PM_POSITIONS_TOTAL = 5;

const PM_AVATAR_URL =
  'https://pbs.twimg.com/profile_images/1878000000000000000/kaito-fixture_400x400.jpg';

const PM_PROFILE: PolymarketProfile = {
  name: 'Marlowe',
  pseudonym: 'Marlowe',
  avatar: PM_AVATAR_URL,
  bio: 'Trading elections and rate decisions. Not financial advice.',
  joinedAt: '2024-03-11T00:00:00.000Z',
  takerTier: 'Tier 2',
  verifiedBadge: true,
  views: 128_400,
};

const PM_MARKETS: PolymarketMarket[] = [
  {
    market: 'Will Bitcoin close above $150k in 2026?',
    outcome: 'Yes',
    avg: 0.42,
    current: 0.55,
    value: 5_500,
    invested: 4_200,
    size: 10_000,
    pnl: 1_300,
    pnlPct: 30.95,
  },
  {
    market: 'US recession declared before 2027?',
    outcome: 'No',
    avg: 0.71,
    current: 0.63,
    value: 2_520,
    invested: 2_840,
    size: 4_000,
    pnl: -320,
    pnlPct: -11.27,
  },
  {
    market: 'Fed cuts rates in September?',
    outcome: 'Yes',
    avg: 0.28,
    current: 0.38,
    value: 1_093.22,
    invested: 806,
    size: 2_877,
    pnl: 287.22,
    pnlPct: 35.64,
  },
];

const PM_SERIES: Record<
  PolymarketPnlPeriod,
  { points: number; stepMs: number; end: number; swing: number }
> = {
  '1d': { points: 24, stepMs: 60 * 60 * 1000, end: 412.6, swing: 260 },
  '1w': { points: 28, stepMs: 6 * 60 * 60 * 1000, end: 1_904.11, swing: 1_100 },
  '1m': { points: 30, stepMs: 24 * 60 * 60 * 1000, end: 4_612.4, swing: 2_800 },
  '1y': { points: 24, stepMs: 15 * 24 * 60 * 60 * 1000, end: 11_308.5, swing: 6_400 },
  ytd: { points: 32, stepMs: 7 * 24 * 60 * 60 * 1000, end: 9_770.3, swing: 5_200 },
  all: { points: 36, stepMs: 30 * 24 * 60 * 60 * 1000, end: PM_PNL_ALL_TIME, swing: 9_000 },
};

const PUMPFUN_VALUE_USD = 21_408.9;
const PUMPFUN_ACCOUNTS = 3;

const PUMPFUN_ADDRESSES = [
  '7xKXtg2CW3xJmQrPfLDqVnG4sBkTrEo9aZbNcHuY1pRs',
  'BQ9mT4vXeLpAz2RdKfYw8NcGh3JsUuVoW5xErTyPqZ1k',
  'Ed4nWpRqL7yUvBz3TgXmKsFh9JcAa2DoN6xYtEuQ8rMv',
];

const PUMPFUN_PROFILE: PumpfunWireProfile = {
  name: 'Bramblegoat',
  twitterHandle: 'fx_bramblegoat',
  avatar: 'https://pbs.twimg.com/profile_images/1878000000000000002/pump-fixture_400x400.jpg',
  bio: 'Main Alpha On Runnr, Find Me On X. The Horns Stay On 🐐',
};

const PUMPFUN_HOLDINGS: PumpfunWireHolding[] = [
  {
    tokenAddress: 'ANSEmYt4pGqvLxRw9KcUdZ3NbFhJs7TaVo1XyEuQ2rBd',
    symbol: 'ANSEM',
    amount: 3_800_000,
    value: 64_856.73,
    costBasis: 3_002.12,
    currentMarketCap: 41_200_000,
    unrealizedPnl: 61_854.61,
  },
  {
    tokenAddress: 'RETrDq8WvNzXm2LpKfYc5BhGa3JsUoTeR7xAd1QyEu9k',
    symbol: 'RETARD',
    amount: 21_500_000,
    value: 18_053.48,
    costBasis: 133_888.4,
    currentMarketCap: 8_900_000,
    unrealizedPnl: -115_834.92,
  },
  {
    tokenAddress: 'CHAnCe5TvWqLmY2XpRdKfBz9NcGh4JsUo8xAtEuQ1rYv',
    symbol: 'CHANCE',
    amount: 8_000_000,
    value: 15_293.43,
    costBasis: 4_722.31,
    currentMarketCap: 6_400_000,
    unrealizedPnl: 10_571.12,
  },
];

const PUMPFUN_WINDOWS: PumpfunWireWindowPnl[] = [
  {
    window: '1d',
    profit: 812.44,
    realizedPnl: 120.5,
    unrealizedPnl: 691.94,
    profitPct: 3.94,
    totalBuyVolume: 20_596.46,
  },
  {
    window: '1w',
    profit: -2_310.88,
    realizedPnl: -980.2,
    unrealizedPnl: -1_330.68,
    profitPct: -9.74,
    totalBuyVolume: 23_719.78,
  },
  {
    window: '1m',
    profit: 6_204.19,
    realizedPnl: 2_118.6,
    unrealizedPnl: 4_085.59,
    profitPct: 40.83,
    totalBuyVolume: 15_204.71,
  },
];

const FOMO_EQUITY = 48_215.67;
const FOMO_PNL_ALL_TIME = 12_904.55;
const FOMO_TRADES = 1_284;
const FOMO_POSITIONS_TOTAL = 9;

const FOMO_PROFILE: FomoWireProfile = {
  name: 'sol fixture',
  handle: 'fx_solfixture',
  twitterHandle: 'fx_solfixture',
  avatar: 'https://pbs.twimg.com/profile_images/1878000000000000001/fomo-fixture_400x400.jpg',
  bio: 'Spot only. Size matters.',
};

const FOMO_POSITIONS: FomoWirePosition[] = [
  {
    symbol: 'WIF',
    amount: 42_500,
    avgEntryPrice: 0.8124,
    avgTransferInPrice: null,
    costBasis: 34_527,
    value: 41_012.5,
    unrealizedPnl: 6_485.5,
  },
  {
    symbol: 'BONK',
    amount: 180_000_000,
    avgEntryPrice: null,
    avgTransferInPrice: null,
    costBasis: 3_852,
    value: 5_103.17,
    unrealizedPnl: 1_251.17,
  },
  {
    symbol: 'PNUT',
    amount: 6_240,
    avgEntryPrice: 0.3711,
    avgTransferInPrice: null,
    costBasis: 2_315.66,
    value: 2_100,
    unrealizedPnl: -215.66,
  },
];

const FOMO_SERIES: Record<
  FomoPnlPeriod,
  { points: number; stepMs: number; end: number; swing: number }
> = {
  '24H': { points: 24, stepMs: 60 * 60 * 1000, end: 812.4, swing: 540 },
  '7D': { points: 28, stepMs: 6 * 60 * 60 * 1000, end: -1_240.8, swing: 1_900 },
  '30D': { points: 30, stepMs: 24 * 60 * 60 * 1000, end: 7_521.01, swing: 4_600 },
};

const WALLET_ORDINALS = [1, 2, 5];

const SECOND_WALLET_ADDRESS: Record<string, string> = {
  hyperliquid: '0x2b91ff40c7d5a6e83f1c0d9b7a4e26c58d031f7a',
  polymarket: '0x51ac0d3e6b8f92471da5c0e7b3f18d64a92c7e05',
};

const HL_TOTAL_ACCOUNTS = 6;
const PM_TOTAL_ACCOUNTS = 4;

const WALLET_PM_NAMES = ['Marlowe', 'Quillon', 'Tessaly'];

const WALLET_PM_AVATARS: Array<string | null> = [PM_AVATAR_URL, '', null];

const WALLET_HL_UPNL_USD = 8_650.02;
const WALLET_PM_PREDICTIONS = 590;

const PLATFORM_SERIES_SPREAD = 2.4;

const WALLET_HL_VALUE_USD = 455_426.97;
const WALLET_HL_PNL_USD = -14_023.09;
const WALLET_PM_VALUE_USD = 9_113.22;
const WALLET_PM_PNL_USD = 14_023.09;

function scopeOf(raw: string): Set<string> | 'all' {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'all') return 'all';
  return new Set(
    trimmed
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s)),
  );
}

const ready: Promise<void> = new Promise((resolve) => {
  watchMockConfig(() => resolve());
});

function inScope(config: MockConfig, twitterId: string): boolean {
  const ids = scopeOf(config.hoverCardScope);
  return ids === 'all' || ids.has(twitterId);
}

function describe(config: MockConfig): string | undefined {
  const scope = scopeOf(config.hoverCardScope);
  const where = scope === 'all' ? 'all' : Array.from(scope).join(',') || 'none';
  const layers = [
    config.hoverCardTotals !== 'off' ? `totals=${config.hoverCardTotals}` : null,
    config.hoverCardFollowers !== 'off' ? `followers=${config.hoverCardFollowers}` : null,
    config.hoverCardHyperliquid !== 'off' ? `hyperliquid=${config.hoverCardHyperliquid}` : null,
    config.hoverCardPolymarket !== 'off' ? `polymarket=${config.hoverCardPolymarket}` : null,
    config.hoverCardWalletDetail !== 'off' ? `walletDetail=${config.hoverCardWalletDetail}` : null,
    config.hoverCardWallets !== 'off' ? `wallets=${config.hoverCardWallets}` : null,
    config.hoverCardScenario !== 'live' ? `scenario=${config.hoverCardScenario}` : null,
    config.hoverCardProfileMode !== 'off' ? `profileMode=${config.hoverCardProfileMode}` : null,
  ].filter(Boolean);
  if (layers.length === 0) return undefined;
  return `${layers.join(' ')} scope=${where}`;
}

export function watchHoverCardMock(cb: (description: string) => void): () => void {
  return watchMockConfig((config) => {
    const description = describe(config);
    if (description) cb(description);
  });
}

function withFilledTotals(result: HoverCardResult): HoverCardResult {
  return {
    ...result,
    accountValue: {
      bucket: MOCK_BUCKET,
      currency: 'USD',
      coveredAccounts: 1,
      totalAccounts: 1,
      coveredPlatforms: 1,
    },
    allTimePnl: {
      value: MOCK_PNL,
      currency: 'USD',
      coveredAccounts: 1,
      totalAccounts: 1,
      coveredPlatforms: 1,
      basis: 'platform_all_time',
      completeness: 'complete',
      coversFrom: '2026-01-01T00:00:00.000Z',
      coversTo: '2026-08-13T00:00:00.000Z',
    },
    tradingPlatforms: MOCK_PLATFORMS,
  };
}

function applyTotalsMock(config: MockConfig, result: HoverCardResult): HoverCardResult {
  const mode = config.hoverCardTotals;
  if (mode === 'off') return result;

  if (mode === 'hidden') {
    return { ...result, accountValue: null, allTimePnl: null, tradingPlatforms: MOCK_PLATFORMS };
  }

  return withFilledTotals(result);
}

function syntheticSocialFollowers(twitterId: string, zero: boolean): HoverCardSocialFollowers {
  return {
    twitterId,
    total: MOCK_X_FOLLOWERS_TOTAL,
    verified: zero ? 0 : MOCK_VERIFIED_FOLLOWERS,
    active: zero ? 0 : MOCK_ACTIVE_FOLLOWERS,
    homeTimelineImpressions: zero ? 0 : MOCK_HOME_TIMELINE_IMPRESSIONS,
    verifiedAt: MOCK_FOLLOWERS_VERIFIED_AT,
  };
}

function applyFollowersMock(config: MockConfig, result: HoverCardResult): HoverCardResult {
  const mode = config.hoverCardFollowers;
  if (mode === 'off') return result;

  return {
    ...result,
    socialFollowers: syntheticSocialFollowers(result.twitterId, mode === 'zero'),
  };
}

function hyperliquidSeries(now: number): HyperliquidBlock['pnlSeries'] {
  return Object.fromEntries(
    (Object.keys(HL_SERIES) as HyperliquidPnlPeriod[]).map((period) => {
      const { points, stepMs, end, swing } = HL_SERIES[period];
      const last = points - 1;
      return [
        period,
        Array.from({ length: points }, (_, i) => ({
          t: now - (last - i) * stepMs,
          v: end * (i / last) + swing * Math.sin(i * 0.8) * (1 - i / last),
        })),
      ];
    }),
  ) as HyperliquidBlock['pnlSeries'];
}

function syntheticHyperliquidBlock(): HyperliquidBlock {
  return {
    wallet: HL_WALLET,
    accountValue: HL_ACCOUNT_VALUE,
    pnlAllTime: HL_PNL_ALL_TIME,
    uPnl: HL_U_PNL,
    positionsCount: HL_POSITIONS_TOTAL,
    positions: HL_POSITIONS,
    pnlSeries: hyperliquidSeries(Date.now()),

    selectedFrom: 1,
  };
}

function applyHyperliquidMock(config: MockConfig, result: HoverCardResult): HoverCardResult {
  const mode = config.hoverCardHyperliquid;
  if (mode === 'off') return result;
  if (mode === 'fill' && result.hyperliquid) return result;

  return { ...result, hyperliquid: syntheticHyperliquidBlock() };
}

function polymarketSeries(now: number): PolymarketBlock['pnlSeries'] {
  return Object.fromEntries(
    (Object.keys(PM_SERIES) as PolymarketPnlPeriod[]).map((period) => {
      const { points, stepMs, end, swing } = PM_SERIES[period];
      const last = points - 1;
      return [
        period,
        Array.from({ length: points }, (_, i) => ({
          t: now - (last - i) * stepMs,
          p: end * (i / last) + swing * Math.sin(i * 0.8) * (1 - i / last),
        })),
      ];
    }),
  ) as PolymarketBlock['pnlSeries'];
}

function syntheticPolymarketBlock(): PolymarketBlock {
  return {
    profile: PM_PROFILE,
    positionsValue: PM_POSITIONS_VALUE,
    pnlAllTime: PM_PNL_ALL_TIME,
    predictions: PM_PREDICTIONS,
    positionsCount: PM_POSITIONS_TOTAL,
    markets: PM_MARKETS,
    pnlSeries: polymarketSeries(Date.now()),
    selectedFrom: 1,
  };
}

function fomoSeries(now: number): FomoBlock['pnlSeries'] {
  return Object.fromEntries(
    (Object.keys(FOMO_SERIES) as FomoPnlPeriod[]).map((period) => {
      const { points, stepMs, end, swing } = FOMO_SERIES[period];
      const last = points - 1;
      return [
        period,
        Array.from({ length: points }, (_, i) => ({
          t: now - (last - i) * stepMs,
          v: end * (i / last) + swing * Math.sin(i * 0.8) * (1 - i / last),
        })),
      ];
    }),
  ) as FomoBlock['pnlSeries'];
}

function syntheticFomoBlock(): FomoBlock {
  return {
    profile: FOMO_PROFILE,
    equity: FOMO_EQUITY,
    trades: FOMO_TRADES,
    positionsCount: FOMO_POSITIONS_TOTAL,

    positions: FOMO_POSITIONS,
    pnlSeries: fomoSeries(Date.now()),
  };
}

function withFomoPlatformTotal(result: HoverCardResult): HoverCardPlatformTotal[] {
  const served = result.tradingPlatformTotals ?? [];
  if (served.some((t) => t.platform === 'fomo')) return served;
  return [
    ...served,
    {
      platform: 'fomo',
      valueLabel: 'Account Value',
      totalAccounts: 1,
      publicAccounts: 1,
      valueUsd: FOMO_EQUITY,
      pnlUsd: FOMO_PNL_ALL_TIME,
      upnlUsd: null,
      predictionsCount: null,
    },
  ];
}

function pumpfunWallets(): HoverCardWallet[] {
  return ['CrayonComet', 'Bramblegoat', 'DopamineDrift'].map((name, i) => ({
    platform: 'pumpfun',
    address: PUMPFUN_ADDRESSES[i],
    ordinal: i + 1,
    addressRevealed: true,
    hasPositions: i < 2,
    displayName: name,
    scraped: true,
  }));
}

function syntheticPumpfunBlock(): PumpfunBlock {
  return {
    address: PUMPFUN_ADDRESSES[1],
    profile: PUMPFUN_PROFILE,
    accountValue: 9_113.22,
    positionsCount: 10,
    positionsScope: 'top10_by_current_position_value',
    positions: PUMPFUN_HOLDINGS,
    pnlWindows: PUMPFUN_WINDOWS,
  };
}

function applyPumpfunMock(config: MockConfig, result: HoverCardResult): HoverCardResult {
  const mode = config.hoverCardPumpfun;
  if (mode === 'off') return result;

  const served = result.tradingPlatformTotals ?? [];
  if (mode === 'fill' && served.some((t) => t.platform === 'pumpfun')) return result;

  return {
    ...result,
    pumpfun: syntheticPumpfunBlock(),
    tradingWallets: [...(result.tradingWallets ?? []), ...pumpfunWallets()],
    tradingPlatformTotals: [
      ...served.filter((t) => t.platform !== 'pumpfun'),
      {
        platform: 'pumpfun',
        valueLabel: 'Account Value',
        totalAccounts: PUMPFUN_ACCOUNTS,
        publicAccounts: PUMPFUN_ACCOUNTS,
        valueUsd: PUMPFUN_VALUE_USD,
        pnlUsd: null,
        upnlUsd: null,
        predictionsCount: null,
      },
    ],
    tradingPlatforms: [...new Set([...(result.tradingPlatforms ?? []), 'pumpfun'])],
  };
}

function applyFomoMock(config: MockConfig, result: HoverCardResult): HoverCardResult {
  const mode = config.hoverCardFomo;
  if (mode === 'off') return result;
  if (mode === 'fill' && result.fomo) return result;

  return {
    ...result,
    fomo: syntheticFomoBlock(),
    tradingPlatformTotals: withFomoPlatformTotal(result),
    tradingPlatforms: [...new Set([...(result.tradingPlatforms ?? []), 'fomo'])],
  };
}

function applyPolymarketMock(config: MockConfig, result: HoverCardResult): HoverCardResult {
  const mode = config.hoverCardPolymarket;
  if (mode === 'off') return result;
  if (mode === 'fill' && result.polymarket) return result;

  return { ...result, polymarket: syntheticPolymarketBlock() };
}

function walletsFor(
  variant: MockConfig['hoverCardWallets'],
  platform: string,
  firstAddress: string | null,
  firstHasPositions: boolean,
): HoverCardWallet[] {
  const revealed = variant !== 'anon' && firstAddress !== null;

  const secondAddress = variant === 'anon' ? null : (SECOND_WALLET_ADDRESS[platform] ?? null);
  const identity = (index: number): Pick<HoverCardWallet, 'displayName' | 'avatarUrl'> =>
    platform === 'polymarket'
      ? { displayName: WALLET_PM_NAMES[index], avatarUrl: WALLET_PM_AVATARS[index] }
      : { displayName: null, avatarUrl: null };

  return [
    {
      platform,
      address: revealed ? firstAddress : null,
      ordinal: WALLET_ORDINALS[0],
      addressRevealed: revealed,
      hasPositions: firstHasPositions,
      ...identity(0),
      scraped: false,
    },
    {
      platform,
      address: secondAddress,
      ordinal: WALLET_ORDINALS[1],
      addressRevealed: secondAddress !== null,
      hasPositions: true,
      ...identity(1),
      scraped: false,
    },
    {
      platform,
      address: null,
      ordinal: WALLET_ORDINALS[2],
      addressRevealed: false,
      hasPositions: false,
      ...identity(2),
      scraped: false,
    },
  ];
}

function platformSeries(
  platform: string,
  pnlUsd: number,
  now: number,
): Record<string, Array<{ t: number; v: number }>> {
  const spec: Record<string, { points: number; stepMs: number; end: number; swing: number }> =
    platform === 'hyperliquid' ? HL_SERIES : PM_SERIES;
  const allWindow = platform === 'hyperliquid' ? 'ALL' : 'all';

  return Object.fromEntries(
    Object.entries(spec).map(([window, { points, stepMs, end, swing }]) => {
      const last = points - 1;

      const target = window === allWindow ? pnlUsd : end * PLATFORM_SERIES_SPREAD;
      return [
        window,
        Array.from({ length: points }, (_, i) => ({
          t: now - (last - i) * stepMs,
          v:
            target * (i / last) +
            swing * PLATFORM_SERIES_SPREAD * Math.sin(i * 0.6) * (1 - i / last),
        })),
      ];
    }),
  );
}

function totalFor(
  variant: MockConfig['hoverCardWallets'],
  platform: string,
  valueLabel: string,
  totalAccounts: number,
  valueUsd: number,
  pnlUsd: number,
): HoverCardPlatformTotal {
  return {
    platform,
    valueLabel,
    totalAccounts,
    publicAccounts: WALLET_ORDINALS.length,
    valueUsd: variant === 'pnl-only' ? null : valueUsd,
    pnlUsd: variant === 'av-only' ? null : pnlUsd,
    upnlUsd: platform === 'hyperliquid' ? WALLET_HL_UPNL_USD : null,
    predictionsCount: platform === 'polymarket' ? WALLET_PM_PREDICTIONS : null,
    ...(variant === 'no-series' ? {} : { pnlSeries: platformSeries(platform, pnlUsd, Date.now()) }),
  };
}

function applyWalletVisibilityMock(config: MockConfig, result: HoverCardResult): HoverCardResult {
  const variant = config.hoverCardWallets;
  if (variant === 'off') return result;

  const hl = result.hyperliquid;
  const pm = result.polymarket;

  const wallets: HoverCardWallet[] = [];
  const totals: HoverCardPlatformTotal[] = [];

  if (hl) {
    wallets.push(...walletsFor(variant, 'hyperliquid', hl.wallet, hl.positionsCount > 0));
    totals.push(
      totalFor(
        variant,
        'hyperliquid',
        'Account Value',
        HL_TOTAL_ACCOUNTS,
        WALLET_HL_VALUE_USD,
        WALLET_HL_PNL_USD,
      ),
    );
  }
  if (pm) {
    wallets.push(...walletsFor(variant, 'polymarket', PM_PROXY_WALLET, pm.positionsCount > 0));
    totals.push(
      totalFor(
        variant,
        'polymarket',
        'Positions Value',
        PM_TOTAL_ACCOUNTS,
        WALLET_PM_VALUE_USD,
        WALLET_PM_PNL_USD,
      ),
    );
  }

  if (wallets.length === 0) return result;

  return {
    ...result,
    tradingWallets: wallets,
    ...(variant === 'no-totals' ? {} : { tradingPlatformTotals: totals }),
  };
}

function addressScale(address: string): number {
  const nibble = Number.parseInt(address.slice(2, 3), 16);
  return Number.isNaN(nibble) ? 1 : 0.35 + (nibble % 8) * 0.12;
}

function syntheticHyperliquidDetail(
  address: string,
  offset: number,
  limit: number,
): WalletDetailResult {
  const k = addressScale(address);
  const rows: HyperliquidPosition[] = Array.from({ length: HL_POSITIONS_TOTAL }, (_, i) => {
    const base = HL_POSITIONS[i % HL_POSITIONS.length];
    const drift = 1 + i * 0.11;
    return {
      ...base,
      coin: i < HL_POSITIONS.length ? base.coin : `${base.coin.split('/')[0]}${i}/USDC`,
      marginUsed: base.marginUsed * k * drift,
      positionValue: base.positionValue * k * drift,
      unrealizedPnl: base.unrealizedPnl * k * (i % 2 === 0 ? drift : -drift),
      funding: base.funding * k,
    };
  });
  const page = rows.slice(offset, offset + limit);
  return {
    platform: 'hyperliquid',
    address,
    total: rows.length,
    offset,
    limit,
    hasMore: offset + page.length < rows.length,
    batchId: 1,
    summary: {
      accountValue: HL_ACCOUNT_VALUE * k,
      uPnl: page.reduce((n, p) => n + p.unrealizedPnl, 0),
      pnlAllTime: HL_PNL_ALL_TIME * k,
      positionsCount: rows.length,
    },
    positions: page,
  };
}

function syntheticPolymarketDetail(
  address: string,
  offset: number,
  limit: number,
): WalletDetailResult {
  const k = addressScale(address);
  const rows: PolymarketMarket[] = Array.from({ length: PM_POSITIONS_TOTAL }, (_, i) => {
    const base = PM_MARKETS[i % PM_MARKETS.length];
    const drift = 1 + i * 0.17;
    return {
      ...base,
      market: i < PM_MARKETS.length ? base.market : `${base.market} (${i + 1})`,
      value: base.value * k * drift,
      invested: base.invested * k * drift,
      pnl: base.pnl * k * (i % 2 === 0 ? drift : -drift),
    };
  });
  const page = rows.slice(offset, offset + limit);
  return {
    platform: 'polymarket',
    address,
    total: rows.length,
    offset,
    limit,
    hasMore: offset + page.length < rows.length,
    batchId: 1,
    summary: {
      positionsValue: PM_POSITIONS_VALUE * k,
      pnlAllTime: PM_PNL_ALL_TIME * k,
      predictions: Math.round(PM_PREDICTIONS * k),
      positionsCount: rows.length,
    },
    markets: page,
  };
}

export async function applyWalletDetailMock(
  request: WalletDetailRequest,
): Promise<WalletDetailOutcome | null> {
  await ready;
  const variant = mockConfig().hoverCardWalletDetail;
  if (variant === 'off') return null;
  if (variant === 'withheld') return { outcome: 'withheld' };

  const offset = request.offset ?? 0;
  const limit = request.limit ?? 50;
  return {
    outcome: 'ok',
    detail:
      request.platform === 'polymarket'
        ? syntheticPolymarketDetail(request.address, offset, limit)
        : syntheticHyperliquidDetail(request.address, offset, limit),
  };
}

function pickTopSegment(categories: HoverCardCategory[]): HoverCardCategory | null {
  return (
    [...categories].sort((a, b) => {
      const ac = a.count ?? Number.NEGATIVE_INFINITY;
      const bc = b.count ?? Number.NEGATIVE_INFINITY;
      if (bc !== ac) return bc - ac;

      const ar = a.rank ?? Number.POSITIVE_INFINITY;
      const br = b.rank ?? Number.POSITIVE_INFINITY;
      if (ar !== br) return ar - br;
      return a.key.localeCompare(b.key);
    })[0] ?? null
  );
}

function withTopSegment(result: HoverCardResult): HoverCardResult {
  const sf = result.smartFollowers;
  if (!sf || sf.topSegment !== undefined) return result;
  return { ...result, smartFollowers: { ...sf, topSegment: pickTopSegment(sf.categories) } };
}

function withoutTrading(result: HoverCardResult): HoverCardResult {
  const {
    accountValue: _accountValue,
    allTimePnl: _allTimePnl,
    tradingPlatforms: _tradingPlatforms,
    tradingPlatformTotals: _tradingPlatformTotals,
    tradingWallets: _tradingWallets,
    ...rest
  } = result;
  return { ...rest, hyperliquid: null, polymarket: null };
}

function withoutSocialFollowers(result: HoverCardResult): HoverCardResult {
  const { socialFollowers: _socialFollowers, ...rest } = result;
  return rest;
}

function hasTradingRecord(result: HoverCardResult): boolean {
  return (
    result.accountValue !== undefined ||
    result.allTimePnl !== undefined ||
    (result.tradingPlatforms?.length ?? 0) > 0 ||
    (result.tradingPlatformTotals?.length ?? 0) > 0
  );
}

function resolveProfileCardMode(result: HoverCardResult): ProfileCardMode {
  const xVerified = result.socialFollowers !== undefined;
  const trading = hasTradingRecord(result);
  if (xVerified && trading) return 'both';
  if (trading) return 'trading_only';
  if (xVerified) return 'x_only';
  return 'none';
}

function applyProfileModeMock(config: MockConfig, result: HoverCardResult): HoverCardResult {
  const mode = config.hoverCardProfileMode;
  if (mode === 'off') return result;

  const wantsTrading = mode === 'both' || mode === 'trading_only';
  const wantsX = mode === 'both' || mode === 'x_only';

  const traded = wantsTrading
    ? hasTradingRecord(result)
      ? result
      : withFilledTotals(result)
    : withoutTrading(result);

  return withTopSegment(
    wantsX
      ? {
          ...traded,
          socialFollowers:
            traded.socialFollowers ?? syntheticSocialFollowers(traded.twitterId, false),
        }
      : withoutSocialFollowers(traded),
  );
}

function withProfileCardSmartFollowers(result: HoverCardResult): HoverCardResult {
  return {
    ...result,
    smartFollowers: {
      ...PROFILE_CARD_SMART_FOLLOWERS,
      topFollowers:
        result.smartFollowers?.topFollowers ?? PROFILE_CARD_SMART_FOLLOWERS.topFollowers,
    },
  };
}

function applyProfileCardScenario(config: MockConfig, result: HoverCardResult): HoverCardResult {
  switch (config.hoverCardScenario) {
    case 'live':
      return result;
    case 'both_verified':
      return {
        ...withProfileCardSmartFollowers(withFilledTotals(result)),
        socialFollowers: syntheticSocialFollowers(result.twitterId, false),
        profileCardMode: 'both',
      };
    case 'trading_only':
      return {
        ...withProfileCardSmartFollowers(withFilledTotals(withoutSocialFollowers(result))),
        profileCardMode: 'trading_only',
      };
    case 'x_verified_only':
      return {
        ...withProfileCardSmartFollowers(withoutTrading(result)),
        socialFollowers: syntheticSocialFollowers(result.twitterId, false),
        profileCardMode: 'x_only',
      };
    case 'unverified':
      return {
        ...withProfileCardSmartFollowers(withoutSocialFollowers(withoutTrading(result))),
        profileCardMode: 'none',
      };
  }
}

const MODE_INPUT_LAYERS = [
  'hoverCardTotals',
  'hoverCardFollowers',
  'hoverCardWallets',
  'hoverCardScenario',
  'hoverCardProfileMode',
] as const satisfies ReadonlyArray<keyof MockConfig>;

function touchesProfileCardMode(config: MockConfig): boolean {
  return MODE_INPUT_LAYERS.some((key) => config[key] !== 'off');
}

export async function applyHoverCardMock(
  twitterId: string,
  result: HoverCardResult,
): Promise<HoverCardResult> {
  await ready;
  const config = mockConfig();
  if (!inScope(config, twitterId)) return result;

  const profileModeMocked = applyProfileModeMock(
    config,
    applyWalletVisibilityMock(
      config,
      applyPumpfunMock(
        config,
        applyFomoMock(
          config,
          applyPolymarketMock(
            config,
            applyHyperliquidMock(
              config,
              applyFollowersMock(config, applyTotalsMock(config, result)),
            ),
          ),
        ),
      ),
    ),
  );
  const mocked = applyProfileCardScenario(config, profileModeMocked);

  return touchesProfileCardMode(config)
    ? {
        ...mocked,
        profileCardMode:
          config.hoverCardScenario === 'live'
            ? resolveProfileCardMode(mocked)
            : mocked.profileCardMode,
      }
    : mocked;
}

export async function applyBadgesPlatformMock(
  requestedIds: string[],
  items: Record<string, BadgeItem | null>,
): Promise<Record<string, BadgeItem | null>> {
  await ready;
  const config = mockConfig();
  const hl = config.hoverCardHyperliquid;
  const pm = config.hoverCardPolymarket;
  const fomo = config.hoverCardFomo;
  if (hl === 'off' && pm === 'off' && fomo === 'off') return items;

  const next = { ...items };
  for (const id of requestedIds) {
    if (!inScope(config, id)) continue;
    const real = next[id] ?? null;
    const base: BadgeItem = real ?? {
      smartFollowers: HL_SMART_FOLLOWERS,
      platforms: { hl: false, pm: false },
    };
    const marks = { ...base.platforms };
    if (hl === 'force' || (hl === 'fill' && !real?.platforms.hl)) {
      marks.hl = true;
      marks.hlPositions = HL_POSITIONS_TOTAL;
    }
    if (pm === 'force' || (pm === 'fill' && !real?.platforms.pm)) {
      marks.pm = true;
      marks.pmPositions = PM_POSITIONS_TOTAL;
    }
    if (fomo === 'force' || (fomo === 'fill' && !real?.platforms.fomo)) {
      marks.fomo = true;
      marks.fomoPositions = FOMO_POSITIONS_TOTAL;
    }
    next[id] = { ...base, platforms: marks };
  }
  return next;
}
