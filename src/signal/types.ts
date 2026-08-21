
import type { AccountSizeTier } from '@/shared/account-size';

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

export interface HyperliquidSummary {

  address: string;

  addressShort: string;
  accountValue: string;
  profitLoss: string;
  profitLossNegative: boolean;
  upnl: string;
  upnlNegative: boolean;

  charts: Record<string, ChartPoint[]>;

  positionsTotal: number;

  positions: PerpPosition[];
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

export interface PredictionSummary {
  name: string;

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

export interface PopoverTotals {

  accountSizeTier: AccountSizeTier | null;

  accountSizeLabel: string;

  allTimePnl: string;

  allTimePnlDirection: "gain" | "loss" | "flat" | null;

  coverage?: { covered: number; total: number };

  accountValuePlatforms: string[];
  allTimePnlPlatforms: string[];
}

export interface SignalPopoverData {
  smartFollowers: SmartFollowerStat[];

  bio?: string;
  hyperliquid?: HyperliquidSummary;
  polymarket?: PredictionSummary;

  compareValues?: { hyperliquid?: number; polymarket?: number };

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
