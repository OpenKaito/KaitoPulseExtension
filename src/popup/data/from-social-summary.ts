
import type { ExtensionSocialFollower } from '@/shared/extension-social';
import type { PopupData, SmartFollower } from './types';

function toSmartFollower(follower: ExtensionSocialFollower): SmartFollower {
  return {
    twitterId: follower.twitterId,
    username: follower.name || follower.username,
    handle: `@${follower.username}`,
    avatarUrl: follower.avatarUrl,
    followers: follower.smartFollowers,
  };
}

export function withSocialFollowers(
  base: PopupData,
  followers: ExtensionSocialFollower[] | undefined,
): PopupData {
  if (!followers) return base;

  return {
    ...base,
    social: {
      ...base.social,
      followers: followers.map(toSmartFollower),
      followersOrdering: 'recent',
    },
  };
}
