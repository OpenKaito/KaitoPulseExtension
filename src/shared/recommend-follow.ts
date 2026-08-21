
export interface FollowRecommendationEvidence {

  impressionCnt: number;
  clickCnt: number;

  dwellSeconds: number;
  lastSeenAt: number;

  seenPostCount: number;

  maxViewSeconds: number;
}

export interface CircleProofAccount {

  twitterId: string;
  handle: string;
  displayName: string;
  avatarUrl: string;
}

export const CIRCLE_PROOF_LIMIT = 3;

export interface FollowRecommendationItem {
  rank: number;

  twitterId: string;
  handle: string;
  displayName: string;
  avatarUrl: string;
  followersCount: number;

  generalSf: number;

  tags: string[];
  creatorType: 'Creator' | 'Project' | null;

  bio: string;
  evidence: FollowRecommendationEvidence;

  circleCount?: number;

  circleProof?: CircleProofAccount[];
}

export type FollowRecommendationEmptyReason =
  | 'no_browsing_history'
  | 'all_already_followed'
  | 'no_twitter_binding'

  | 'disabled_by_user';

export interface FollowRecommendationResponse {
  items: FollowRecommendationItem[];
  computedAt: number;

  nextRefreshAt: number;

  reason: FollowRecommendationEmptyReason | null;

  totalViewSeconds: number | null;
}

export interface FollowActionReport {

  eventId: string;

  targetTwitterId: string;
  action: 'follow' | 'unfollow';

  occurredAt: number;
}

export type LocallyFollowedMap = Record<string, number>;

export const LOCALLY_FOLLOWED_TTL_MS = 5 * 60 * 1000;

export function pruneLocallyFollowed(map: LocallyFollowedMap, now: number): LocallyFollowedMap {
  const pruned: LocallyFollowedMap = {};
  for (const [twitterId, followedAt] of Object.entries(map)) {
    if (now - followedAt < LOCALLY_FOLLOWED_TTL_MS) pruned[twitterId] = followedAt;
  }
  return pruned;
}
