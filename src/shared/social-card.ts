
import type { TradingAccountValue, TradingPnlTotal } from './trading-summary';

export interface BadgeItem {

  smartFollowers: number | null;
  platforms: {

    hl: boolean;
    pm: boolean;

    hlPositions?: number | null;
    pmPositions?: number | null;

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

export interface HyperliquidPosition {
  coin: string;
  side: 'long' | 'short';
  leverage: number;
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
}

export type SmartFollowerCategoryKey = 'crypto' | 'ai' | 'equity_trading';

export interface HoverCardSmartFollowers {
  total: number;
  categories: Array<{
    key: SmartFollowerCategoryKey;
    label: string;
    count: number;
    rank: number;
  }>;

  topFollowers: Array<{ username: string; name?: string; avatarUrl?: string }>;
}

export type SourceStatus = 'ok' | 'miss' | 'error';

export type TotalPlatforms = { platforms?: string[] };

export type HoverCardAccountValue = Omit<TradingAccountValue, 'totalUsd'> & TotalPlatforms;
export type HoverCardPnlTotal = TradingPnlTotal & TotalPlatforms;

export interface HoverCardResult {

  twitterId: string;

  handle?: string;
  profile?: { name: string; username: string; avatarUrl?: string; bio?: string };
  smartFollowers: HoverCardSmartFollowers | null;
  hyperliquid: HyperliquidBlock | null;
  polymarket: PolymarketBlock | null;

  accountValue?: HoverCardAccountValue | null;

  allTimePnl?: HoverCardPnlTotal | null;

  tradingPlatforms?: string[];
  meta: {

    partial: boolean;
    sources: { sf: SourceStatus; hyperliquid: SourceStatus; polymarket: SourceStatus };
  };
}
