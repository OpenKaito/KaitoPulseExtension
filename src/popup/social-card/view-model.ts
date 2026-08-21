
import type {
  SocialCardBundle,
  SocialCardScope,
  VoicesHeatmapCell,
  VoicesShareSeries,
  VoicesSocialCardDetails,
} from '@/shared/voices-social-card';

export interface SharePoint {
  date: string;
  value: number;
}

export interface FollowerAvatar {
  avatarUrl: string;
  name?: string;
  handle?: string;
}

export interface SmartFollowersStats {

  topPct: number;

  highestRank: number;

  highestRankDate: string;
  line: SharePoint[];
}

export interface MindshareStats {

  current: number;

  topPct: number;
  highestRank: number;
  highestRankDate: string;
  line: SharePoint[];
}

export interface SocialCardData {
  scope: SocialCardScope;
  name: string;
  handle: string;
  avatarUrl: string;
  bio: string;
  totalFollowers: number;

  smartFollowers: number;

  segmentSmartFollowers: number;
  impressions: number;
  smartEngagements: number;
  dailyEngagements: VoicesHeatmapCell[];
  smartFollowersStats: SmartFollowersStats;
  mindshareStats: MindshareStats;
  topSmartFollowers: FollowerAvatar[];

  hasDetails: boolean;
}

const toLine = (
  share: VoicesShareSeries | null | undefined,
  key: 'smart_follower_share' | 'mindshare_share',
): SharePoint[] => (share?.line ?? []).map((p) => ({ date: p.date, value: p[key] ?? 0 }));

function dedupeByHandle(list: FollowerAvatar[]): FollowerAvatar[] {
  const seen = new Set<string>();
  const out: FollowerAvatar[] = [];
  for (const item of list) {
    const key = item.handle?.toLowerCase() ?? item.avatarUrl;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function highResAvatar(url: string | undefined): string {
  if (!url) return '';
  if (url.includes('default_profile')) return url;
  return url.replace(/_(normal|bigger|mini)(\.[a-z]{3,4})$/i, '_400x400$2');
}

function toSmartFollowersStats(details: VoicesSocialCardDetails | undefined): SmartFollowersStats {
  const rank = details?.smart_follower_rank;
  return {

    topPct: (rank?.top ?? 0) * 100,
    highestRank: Number(rank?.peak?.smart_follower_rank ?? 0),
    highestRankDate: rank?.peak?.date ?? '',
    line: toLine(details?.smart_follower_share, 'smart_follower_share'),
  };
}

function toMindshareStats(details: VoicesSocialCardDetails | undefined): MindshareStats {
  const rank = details?.mindshare_rank;
  return {
    current: Number(rank?.current ?? 0),
    topPct: Number(rank?.top ?? 0) * 100,
    highestRank: Number(rank?.peak?.mindshare_rank ?? 0),
    highestRankDate: rank?.peak?.date ?? '',
    line: toLine(details?.mindshare_share, 'mindshare_share'),
  };
}

export function toSocialCardData(bundle: SocialCardBundle): SocialCardData | null {
  const { overview, details, activity, scope } = bundle;
  const profile = overview.profile;
  if (!profile) return null;

  return {
    scope,
    name: profile.name,
    handle: `@${profile.username}`,
    avatarUrl: highResAvatar(profile.avatar),
    bio: profile.bio,
    totalFollowers: overview.followers ?? 0,
    smartFollowers: overview.smart_follower ?? 0,
    segmentSmartFollowers: overview.segment_smart_follower ?? overview.smart_follower ?? 0,
    impressions: overview.impression ?? 0,
    smartEngagements: overview.smart_engagement ?? 0,
    dailyEngagements: activity?.cells ?? [],
    smartFollowersStats: toSmartFollowersStats(details),
    mindshareStats: toMindshareStats(details),
    topSmartFollowers: dedupeByHandle(
      (details?.top_smart_followers ?? []).map((f) => ({
        avatarUrl: highResAvatar(f.avatar),
        name: f.name,
        handle: f.username ? `@${f.username}` : undefined,
      })),
    ),
    hasDetails: details !== undefined,
  };
}
