
export type { AccountSizeTier } from '@/shared/account-size';
import type { AccountSizeTier } from '@/shared/account-size';

export type AuraProfile = {
  username?: string;
  handle?: string;
  avatarUrl?: string;

  aura?: number | null;
  auraDelta?: number | null;
  smartFollowers?: number | null;
  accountSize?: AccountSizeTier | null;

  accountValueUsd?: number | null;
  allTimePnlUsd?: number | null;

  allTimePnlApproximate?: boolean;
};

export type AuraStats = {

  total?: number | null;
  rank?: number | null;
  earned?: number | null;
  referral?: number | null;

  inviteUrl?: string | null;

  inviteCode?: string | null;
};

export type SmartFollower = {
  twitterId: string;
  username: string;
  handle: string;
  avatarUrl?: string;

  followers: number | null;
};

export type FollowerOrdering = 'recent' | 'topBySf';

export type SocialInsights = {

  categories: { label: string; score: number; rank?: number | null }[];

  followers: SmartFollower[];

  followersOrdering: FollowerOrdering;
};

export type TradingCoverage = { covered: number; total: number };

export type TradingOverview = {

  calculatedLabel: string | null;
};

export type TradingTotalsVisibility = boolean | null;

export type IncludedAccount = {
  platform: string;
  displayName: string;
  brandColor: string;

  accountLabel: string;

  accountId: string;

  profile?: { name: string; avatarUrl?: string; joined?: string; bio?: string };

  valueLabel: string;

  value: number | null;

  pnl: number | null;

  pnlLabel: string;

  nativePnlAmount?: string | null;

  fxApproximate?: boolean;

  freshnessAt?: number | null;

  perpOnly: boolean;

  includedInTotal: boolean;

  timestampLabel: string | null;

  nativeAmount: string | null;

  publicOnX?: boolean;
};

export type PlatformGroup = {
  platform: string;
  displayName: string;
  brandColor: string;
  accounts: IncludedAccount[];

  value: number | null;
  pnl: number | null;

  fxApproximate?: boolean;

  valueLabel: string;
  pnlLabel: string;

  perpOnly: boolean;

  timestampLabel: string | null;

  publicCount: number | null;
};

export type TimeSpent = {

  minutes: number;
};

export type PopupData = {
  profile: AuraProfile;
  aura: AuraStats;
  social: SocialInsights;

  tradingOverview: TradingOverview | null;

  tradingCoverage: TradingCoverage | null;
  includedAccounts: IncludedAccount[];

  platformGroups: PlatformGroup[];
  timeSpent: TimeSpent;
};
