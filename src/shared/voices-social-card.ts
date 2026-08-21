
export type SocialCardScope = 'ai' | 'crypto' | 'trading';

export const SOCIAL_CARD_SCOPES: readonly SocialCardScope[] = ['crypto', 'ai', 'trading'];

export function scopeFromCategoryKey(key: string): SocialCardScope | null {
  switch (key) {
    case 'crypto':
      return 'crypto';
    case 'ai':
      return 'ai';
    case 'equity_trading':
      return 'trading';
    default:
      return null;
  }
}

export interface VoicesSocialCardProfile {

  user_id?: string;
  name: string;
  username: string;
  avatar: string;
  bio: string;
}

export interface VoicesSocialCardOverview {
  profile?: VoicesSocialCardProfile;
  followers?: number;

  smart_follower?: number;

  segment_smart_follower?: number;
  impression?: number;
  smart_engagement?: number;

  relevant_tweet_count?: number;
}

export interface VoicesSharePoint {
  date: string;
  smart_follower_share?: number;
  mindshare_share?: number;
}

export interface VoicesShareSeries {
  top: number;
  line?: VoicesSharePoint[];
  peak?: { date: string; smart_follower_share?: number; mindshare_share?: number };
}

export interface VoicesRankSeries {
  top?: number;

  current?: number;
  peak?: { date: string; smart_follower_rank?: number; mindshare_rank?: number };
}

export interface VoicesTopSmartFollower {
  user_id?: string;
  name?: string;
  username?: string;
  avatar?: string;
}

export interface VoicesSocialCardDetails {
  smart_follower_share?: VoicesShareSeries | null;
  smart_follower_rank?: VoicesRankSeries | null;
  mindshare_share?: VoicesShareSeries | null;
  mindshare_rank?: VoicesRankSeries | null;
  top_smart_followers?: VoicesTopSmartFollower[];
}

export interface VoicesHeatmapCell {
  date: string;
  intensity: 0 | 1 | 2 | 3 | 4 | 5;
  tweet_count?: number;
  smart_engagement_count?: number;
}

export interface VoicesSmartEngagementActivity {
  cells?: VoicesHeatmapCell[];
}

export interface SocialCardBundle {
  scope: SocialCardScope;
  overview: VoicesSocialCardOverview;

  details?: VoicesSocialCardDetails;

  activity?: VoicesSmartEngagementActivity;
}

export const SOCIAL_CARD_MIN_SMART_FOLLOWERS = 10;

export interface ScopeEligibilityInput {
  profile?: unknown;
  segment_smart_follower?: number;
  smart_follower?: number;
}

function scopeSmartFollowers(overview: ScopeEligibilityInput): number {
  return overview.segment_smart_follower ?? overview.smart_follower ?? 0;
}

export function isScopeEligible(overview: ScopeEligibilityInput | undefined): boolean {
  if (!overview?.profile) return false;
  return scopeSmartFollowers(overview) >= SOCIAL_CARD_MIN_SMART_FOLLOWERS;
}

export function pickDefaultScope(
  overviewByScope: Partial<Record<SocialCardScope, VoicesSocialCardOverview | undefined>>,
  scopes: readonly SocialCardScope[] = SOCIAL_CARD_SCOPES,
): SocialCardScope | null {
  const eligible = scopes.filter((scope) => isScopeEligible(overviewByScope[scope]));
  if (eligible.length === 0) return null;
  return eligible.reduce((best, scope) => {
    const a = overviewByScope[best];
    const b = overviewByScope[scope];
    const seDiff = (b?.smart_engagement ?? 0) - (a?.smart_engagement ?? 0);
    if (seDiff !== 0) return seDiff > 0 ? scope : best;
    return (b?.relevant_tweet_count ?? 0) > (a?.relevant_tweet_count ?? 0) ? scope : best;
  }, eligible[0]);
}
