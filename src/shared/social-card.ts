import type {
  TradingAccountValue,
  TradingPlatformSubtotal,
  TradingPnlTotal,
} from './trading-summary';

export interface BadgeItem {
  smartFollowers: number | null;
  platforms: {
    hl: boolean;
    pm: boolean;

    hlPositions?: number | null;
    pmPositions?: number | null;

    fomo?: boolean;
    fomoPositions?: number | null;

    pumpfun?: boolean;
    pumpfunPositions?: number | null;
  };

  trading?: BadgeTrading;
}

export interface BadgeTrading {
  bucket: string | null;

  platforms: string[];
}

export interface BadgesResponse {
  items: Record<string, BadgeItem | null>;
}

export type HyperliquidPnlPeriod = '1D' | '1W' | '1M' | 'ALL';
export type PolymarketPnlPeriod = '1d' | '1w' | '1m' | '1y' | 'ytd' | 'all';

export type HyperliquidMarginMode = 'cross' | 'isolated' | '';

export interface HyperliquidPosition {
  coin: string;
  side: 'long' | 'short';
  leverage: number;

  marginMode?: HyperliquidMarginMode;

  entryPx: number;
  marginUsed: number;
  liquidationPx: number | null;
  positionValue: number;
  markPx: number;
  funding: number;
  unrealizedPnl: number;
}

export interface HyperliquidBlock {
  wallet: string;
  accountValue: number;
  pnlAllTime: number;
  uPnl: number;
  positionsCount: number;
  positions: HyperliquidPosition[];
  pnlSeries: Record<HyperliquidPnlPeriod, Array<{ t: number; v: number }>>;

  selectedFrom?: number;
}

export interface PolymarketProfile {
  name?: string;
  pseudonym?: string;
  bio?: string;
  avatar?: string;
  joinedAt?: string;
  xUsername?: string;
  takerTier?: string;
  verifiedBadge?: boolean;
  views?: number;
}

export interface PolymarketMarket {
  market: string;
  icon?: string;
  outcome: string;
  avg: number;
  current: number;
  value: number;
  invested: number;
  size?: number;
  pnl: number;
  pnlPct: number;
}

export interface PolymarketBlock {
  profile: PolymarketProfile;
  positionsValue: number;
  pnlAllTime: number;
  predictions: number;
  positionsCount: number;
  markets: PolymarketMarket[];
  pnlSeries: Record<PolymarketPnlPeriod, Array<{ t: number; p: number }>>;

  selectedFrom?: number;
}

export type FomoPnlPeriod = '24H' | '7D' | '30D';

export interface FomoWirePosition {
  symbol: string;
  icon?: string;
  tradeUrl?: string;
  amount: number;
  avgEntryPrice: number | null;
  avgTransferInPrice: number | null;
  costBasis: number;
  value: number;
  unrealizedPnl: number;
}

export interface FomoWireProfile {
  name?: string;
  handle?: string;
  twitterHandle?: string;
  bio?: string;
  avatar?: string;
}

export interface FomoBlock {
  profile: FomoWireProfile;
  equity: number;
  trades: number;
  positionsCount: number;
  positions: FomoWirePosition[];
  pnlSeries: Record<FomoPnlPeriod, Array<{ t: number; v: number }>>;
}

export interface LighterWirePosition {
  symbol: string;
  accountIndex: number;
  side: 'long' | 'short';
  size: number;
  entryPx: number;
  positionValue: number;
  unrealizedPnl: number;
  realizedPnl: number | null;
  liquidationPx: number | null;
  leverage: number | null;
  marginMode: 'cross' | 'isolated' | '';
  allocatedMargin: number | null;
}

export interface PumpfunWireHolding {
  tokenAddress: string;
  symbol: string;
  icon?: string;
  tradeUrl?: string;
  amount: number;
  value: number;
  costBasis: number | null;
  currentMarketCap: number;
  unrealizedPnl: number | null;
}

export type PumpfunPnlWindow = '1d' | '1w' | '1m';

export interface PumpfunWireWindowPnl {
  window: PumpfunPnlWindow;
  profit: number;
  realizedPnl: number;
  unrealizedPnl: number;
  profitPct: number;
  totalBuyVolume: number;
}

export interface PumpfunWireProfile {
  name?: string;
  avatar?: string;

  twitterHandle?: string;
  bio?: string;
}

export interface PumpfunBlock {
  address: string;
  profile?: PumpfunWireProfile;

  accountValue: number | null;

  positionsCount: number;
  positionsScope: string;
  positions: PumpfunWireHolding[];
  pnlWindows: PumpfunWireWindowPnl[];
}

export type SmartFollowerCategoryKey = 'crypto' | 'ai' | 'equity_trading';

export interface HoverCardCategory {
  key: SmartFollowerCategoryKey;
  label: string;

  count: number | null;

  rank: number | null;
}

export interface HoverCardSmartFollowers {
  total: number | null;
  categories: HoverCardCategory[];

  topSegment?: HoverCardCategory | null;

  topFollowers: Array<{ username: string; name?: string; avatarUrl?: string }>;
}

export interface HoverCardSocialFollowers {
  twitterId: string;

  total: number;

  verified?: number;
  active?: number;
  activeVerified?: number;

  verifiedAt: string;
}

export type ProfileCardMode = 'both' | 'trading_only' | 'x_only' | 'none';

export type SourceStatus = 'ok' | 'miss' | 'error';

export type TotalPlatforms = { platforms?: string[] };

export type HoverCardAccountValue = Omit<TradingAccountValue, 'totalUsd'> & TotalPlatforms;
export type HoverCardPnlTotal = TradingPnlTotal & TotalPlatforms;

export interface AttestedWirePosition {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number | null;
  markPrice: number | null;
  positionValue: number | null;
  unrealizedPnl: number | null;
  liquidationPrice: number | null;
  leverage: number | null;
  margin: number | null;
  funding?: number | null;
  instrumentType?: 'option';
}

export type HoverCardPlatformTotal = Pick<
  TradingPlatformSubtotal,
  'platform' | 'valueLabel' | 'totalAccounts' | 'publicAccounts' | 'valueUsd' | 'pnlUsd'
> & {
  upnlUsd?: number | null;

  predictionsCount?: number | null;

  positionsCount?: number | null;

  points?: number | null;

  buyVolume?: number | null;

  dataAsOf?: string | null;

  category?: 'perps' | 'cex' | 'prediction' | 'memecoin' | 'brokerage';
  source?: 'crawler' | 'attestation' | 'broker';

  pnlSeries?: Record<string, Array<{ t: number; v: number }>>;
};

export interface HoverCardWallet {
  platform: string;

  address: string | null;

  ordinal?: number | null;

  addressRevealed?: boolean;

  hasPositions?: boolean;

  displayName?: string | null;
  avatarUrl?: string | null;

  scraped: boolean;

  maskedAccountId?: string | null;

  positions?: AttestedWirePosition[];

  points?: number | null;

  tier?: { name: string; pointsRate: number };
}

export interface HoverCardReferral {
  referredUsers: number | null;
  referredVolume: number | null;
  platforms: Array<{
    platform: string;
    referredUsers: number | null;
    referredVolume: number | null;
  }>;
}

export interface HoverCardResult {
  twitterId: string;

  handle?: string;
  profile?: { name: string; username: string; avatarUrl?: string; bio?: string };
  smartFollowers: HoverCardSmartFollowers | null;

  hyperliquid: HyperliquidBlock | null;

  polymarket: PolymarketBlock | null;

  fomo?: FomoBlock | null;

  pumpfun?: PumpfunBlock | null;

  accountValue?: HoverCardAccountValue | null;

  allTimePnl?: HoverCardPnlTotal | null;

  tradingPlatforms?: string[];

  tradingPlatformTotals?: HoverCardPlatformTotal[];

  tradingWallets?: HoverCardWallet[];

  referral?: HoverCardReferral;
  points?: Array<{ platform: string; points: number }>;

  socialFollowers?: HoverCardSocialFollowers;

  profileCardMode?: ProfileCardMode;
  meta: {
    partial: boolean;
    sources: {
      sf: SourceStatus;
      hyperliquid: SourceStatus;
      polymarket: SourceStatus;
      fomo?: SourceStatus;
      pumpfun?: SourceStatus;
    };
  };
}
