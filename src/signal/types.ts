import type { AccountSizeTier } from '@/shared/account-size';
import type { ProfileCardMode } from '@/shared/social-card';

export interface AvatarSignalProfile {
  tweetId: string;
  label: string;
  value: string;
  avatarShape?: 'circle' | 'square';
  avatarSize?: 'regular' | 'compact' | 'large';
}

export type SignalProtocol = 'hyperliquid' | 'polymarket';

export interface NameTagEntry {
  protocol: SignalProtocol;
  positionsCount: number | null;
}

export interface NameTagProfile {
  id: string;

  entries: NameTagEntry[];
}

export interface SmartFollowerStat {
  label: string;
  value: string;

  rank?: string;

  verifiedBadge?: boolean;
}

export interface HoverCardStatsView {
  verified?: SmartFollowerStat;
  active?: SmartFollowerStat;

  categories: SmartFollowerStat[];
}

export interface PerpPosition {
  pair: string;
  leverage: string;
  side: 'Long' | 'Short';
  pnl: string;
  pnlNegative: boolean;
  entry: string;
  margin: string;
  liqPrice: string;
  size: string;
  mark: string;
  markNegative: boolean;
  funding: string;

  iconUrl?: string;
}

export interface ChartPoint {
  v: number;
  label: string;
  time: string;
}

export interface HyperliquidAccount {
  address: string | null;

  addressShort: string;

  anonymous: boolean;

  hasDetail: boolean;

  hasPositions: boolean;
  accountValue: string;
  profitLoss: string;
  profitLossNegative: boolean;
  upnl: string;
  upnlNegative: boolean;

  charts: Record<string, ChartPoint[]>;

  positionsTotal: number;

  positions: PerpPosition[];
}

export interface HyperliquidSummary {
  heading: string;

  aggregate: boolean;

  accounts: HyperliquidAccount[];

  accountValue: string;
  profitLoss: string;
  profitLossNegative: boolean;
  upnl: string;
  upnlNegative: boolean;

  charts: Record<string, ChartPoint[]>;

  positionsTotal: number;
}

export interface PredictionMarket {
  title: string;

  outcome: string;

  outcomeYes: boolean;
  avg: string;
  current: string;

  shares: string;
  value: string;

  change: string;
  changeNegative: boolean;

  iconUrl?: string;
}

export interface PolymarketAccount {
  name: string;

  address: string | null;

  profileHandle: string | null;

  anonymous: boolean;
  hasDetail: boolean;
  hasPositions: boolean;

  avatarUrl?: string;
  meta: string;
  bio: string;
  positionsValue: string;
  profitLoss: string;
  profitLossNegative: boolean;

  predictions: string;

  charts: Record<string, ChartPoint[]>;

  positionsTotal: number;

  markets: PredictionMarket[];
}

export interface PredictionSummary {
  heading: string;

  aggregate: boolean;

  accounts: PolymarketAccount[];

  positionsValue: string;
  profitLoss: string;
  profitLossNegative: boolean;
  predictions: string;

  charts: Record<string, ChartPoint[]>;

  positionsTotal: number;
}
export interface AccountValueTotal {
  tier: AccountSizeTier;

  label: string;

  platforms: string[];
}

export interface AllTimePnlTotal {
  text: string;

  direction: 'gain' | 'loss' | 'flat';

  platforms: string[];

  coverage?: { covered: number; total: number };
}

export interface PopoverTotals {
  accountValue?: AccountValueTotal;

  allTimePnl?: AllTimePnlTotal;

  platforms: string[];
}

export interface SignalPopoverData {
  smartFollowers: SmartFollowerStat[];

  smartFollowerTotal?: SmartFollowerStat;
  smartFollowerCategories?: SmartFollowerStat[];

  topSegment?: SmartFollowerStat;

  verifiedFollowers?: SmartFollowerStat;
  activeFollowers?: SmartFollowerStat;

  profileCardMode?: ProfileCardMode;

  bio?: string;
  hyperliquid?: HyperliquidSummary;
  polymarket?: PredictionSummary;

  totals?: PopoverTotals;
}

export interface SignalProfileSnapshot {
  avatarUrl?: string;
  displayName: string;
  handle: string;
}

export interface UsernameChange {
  from: string;

  to: string;

  date: string;
}

export interface TopSmartFollower {
  avatarUrl?: string;

  username?: string;

  name?: string;
}

export interface UserInfoData extends SignalPopoverData {
  topSmartFollowers: TopSmartFollower[];
}

export interface SignalFetchOptions {
  method?: 'DELETE' | 'GET' | 'POST' | 'PUT' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  baseURL?: string;

  redirect?: 'error' | 'follow' | 'manual';
}

export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};
