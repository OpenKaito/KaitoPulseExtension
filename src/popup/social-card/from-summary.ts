
import {
  EXTENSION_SOCIAL_CARD_SECTOR,
  type ExtensionSocialCardData,
  type ExtensionSocialCardProfile,
} from '@/shared/extension-social';
import {
  isScopeEligible,
  type SocialCardBundle,
  type VoicesSmartEngagementActivity,
  type VoicesSocialCardProfile,
} from '@/shared/voices-social-card';

function toVoicesProfile(profile: ExtensionSocialCardProfile): VoicesSocialCardProfile {
  return {
    name: profile.name ?? '',
    username: profile.username ?? '',
    avatar: profile.avatar ?? '',
    bio: profile.bio ?? '',
  };
}

const DETAILS_KEYS = [
  'smart_follower_share',
  'smart_follower_rank',
  'mindshare_share',
  'mindshare_rank',
  'top_smart_followers',
] as const;

function hasDetailsHalf(data: ExtensionSocialCardData): boolean {
  return DETAILS_KEYS.some((key) => key in data);
}

export function bundleFromSummaryCardData(
  data: ExtensionSocialCardData | null | undefined,
  activity?: VoicesSmartEngagementActivity,
): SocialCardBundle | null {
  if (!data?.profile?.username) return null;
  if (!isScopeEligible(data)) return null;

  return {
    scope: EXTENSION_SOCIAL_CARD_SECTOR,
    overview: { ...data, profile: toVoicesProfile(data.profile) },
    details: hasDetailsHalf(data) ? data : undefined,
    activity,
  };
}
