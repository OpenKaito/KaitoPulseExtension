
import type { HoverCardResult } from '@/shared/social-card';
import type { PopupData, SmartFollower } from './types';

function toSmartFollowers(card: HoverCardResult): SmartFollower[] {
  return (card.smartFollowers?.topFollowers ?? []).map((follower, i) => ({

    twitterId: follower.username || String(i),
    username: follower.name || follower.username,
    handle: `@${follower.username}`,
    avatarUrl: follower.avatarUrl,

    followers: null,
  }));
}

export function withHoverCard(base: PopupData, card: HoverCardResult): PopupData {
  const followers = toSmartFollowers(card);

  return {
    ...base,
    profile: {
      ...base.profile,
      smartFollowers: card.smartFollowers?.total ?? null,
    },
    social: {
      categories: (card.smartFollowers?.categories ?? []).map((category) => ({
        label: category.label,
        score: category.count,
        rank: category.rank,
      })),

      followers,
      followersOrdering: 'topBySf',
    },
  };
}
