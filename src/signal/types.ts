import type { AccountSizeTier } from '@/shared/account-size';
import type { ProfileCardMode } from '@/shared/social-card';
import type { PlatformCategory } from './platforms';

export interface AvatarSignalProfile {
  tweetId: string;
  label: string;
  value: string;
  avatarShape?: 'circle' | 'square';
  avatarSize?: 'regular' | 'compact' | 'large';
}

export type SignalProtocol =
  | 'hyperliquid'
  | 'polymarket'
  | 'fomo'
  | 'pumpfun'
  | 'binance'
  | 'okx'
  | 'bybit'
  | 'variational'
  | 'lighter';

export type TokenProtocol = Extract<SignalProtocol, 'fomo' | 'pumpfun'>;

export type AccountProtocol = Exclude<SignalProtocol, 'hyperliquid' | 'polymarket' | TokenProtocol>;

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

  quantity?: string;
  value?: string;
  detail?: string;
  entryMark?: string;
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

  accountCount: number;

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

export interface TokenPosition {
  symbol: string;
  iconUrl?: string;

  supply: string;

  value: string;

  pnl: string;

  changePct: string;
  changeNegative: boolean;
}

export interface TokenAccount {
  name: string;
  address?: string;
  avatarUrl?: string;

  meta: string;
  bio: string;

  profileUrl?: string;

  anonymous: boolean;
  hasDetail: boolean;
  hasPositions: boolean;

  accountValue: string;
  profitLoss: string;
  profitLossNegative: boolean;
  trades: string;

  positionsTotal: number;

  tokens: TokenPosition[];
}

export type PositionsFooterCopy = 'count' | 'slice' | 'affordance';

export interface TokenPlatformSummary {
  protocol: TokenProtocol;

  heading: string;

  aggregate: boolean;

  accounts: TokenAccount[];

  accountCount: number;

  valueLabel: string;
  accountValue: string;
  profitLoss: string;
  profitLossNegative: boolean;
  countLabel: string;
  trades: string;

  positionsTotal: number;

  positionsFooter: PositionsFooterCopy;
}

export interface PredictionSummary {
  heading: string;

  aggregate: boolean;

  accounts: PolymarketAccount[];

  accountCount: number;

  positionsValue: string;
  profitLoss: string;
  profitLossNegative: boolean;
  predictions: string;

  charts: Record<string, ChartPoint[]>;

  positionsTotal: number;
}
export interface PlatformAccountChip {
  label: string;

  address: string | null;

  anonymous: boolean;

  hasPositions: boolean;

  positions?: PerpPosition[];

  tier?: string;
}

export interface AccountPlatformSummary {
  protocol: AccountProtocol;

  heading: string;

  aggregate: boolean;

  accounts: PlatformAccountChip[];

  accountCount: number;

  accountValue: string;
  profitLoss: string;
  profitLossNegative: boolean;
  upnl: string;
  upnlNegative: boolean;

  charts: Record<string, ChartPoint[]>;

  positionsCount: number | null;

  points?: string;

  dataAsOf?: string;
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

export interface ReferralTotalFigure {
  text: string;

  platforms: string[];
}

export interface ReferralTotals {
  referredUsers?: ReferralTotalFigure;

  referredVolume?: ReferralTotalFigure;
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

  fomo?: TokenPlatformSummary;
  pumpfun?: TokenPlatformSummary;

  binance?: AccountPlatformSummary;
  okx?: AccountPlatformSummary;
  bybit?: AccountPlatformSummary;
  variational?: AccountPlatformSummary;
  lighter?: AccountPlatformSummary;

  platformCategories?: Partial<Record<SignalProtocol, PlatformCategory>>;
  platformMetrics?: Partial<Record<SignalProtocol, PlatformMetrics>>;
  totals?: PopoverTotals;

  referralTotals?: ReferralTotals;
}

export interface PlatformMetrics {
  referredTraders?: string;
  referredVolume?: string;
  points?: string;
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
