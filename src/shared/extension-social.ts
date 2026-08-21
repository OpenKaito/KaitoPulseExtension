
import type {
  SocialCardScope,
  VoicesSmartEngagementActivity,
  VoicesSocialCardDetails,
  VoicesSocialCardOverview,
} from './voices-social-card';

export interface ExtensionSocialCardProfile {
  name: string | null;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  location: string | null;
  language: string | null;
  identity_tags: string[] | null;
}

export type ExtensionSocialCardData = Omit<VoicesSocialCardOverview, 'profile'> &
  VoicesSocialCardDetails & { profile: ExtensionSocialCardProfile | null };

export const EXTENSION_SOCIAL_CARD_SECTOR: SocialCardScope = 'crypto';

export interface ExtensionSocialCardActivityResponse {
  activity: VoicesSmartEngagementActivity | null;
}

export interface ExtensionSocialCard {

  imageUrl: string | null;

  shortUrl: string | null;

  profileUrl: string | null;

  sector: string | null;

  updatedAtMs?: number | null;

  mySocialsUrl: string;

  data?: ExtensionSocialCardData | null;
}

export interface ExtensionSocialSummary {
  socialCard: ExtensionSocialCard;
  degraded?: boolean;

  followers?: ExtensionSocialFollower[];
}

export interface ExtensionSocialFollower {
  twitterId: string;
  username: string;
  name?: string;
  avatarUrl?: string;

  smartFollowers: number | null;

  followedAtMs: number | null;
}
