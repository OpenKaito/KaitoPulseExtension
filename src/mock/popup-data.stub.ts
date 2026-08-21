
import type { ExtensionSocialCard } from '@/shared/extension-social';
import type { FollowRecommendationResponse } from '@/shared/recommend-follow';
import type { PopupData } from '@/popup/data/types';
import type { SocialCardData } from '@/popup/social-card/view-model';
import { EMPTY_DATA } from '@/popup/data/empty';

export const FIXTURE_DATA: PopupData = EMPTY_DATA;
export const FIXTURE_SOCIAL_CARD: SocialCardData | undefined = undefined;
export const FIXTURE_SOCIAL_CARD_LINKS: ExtensionSocialCard | undefined = undefined;
export const FIXTURE_RECOMMENDATIONS: FollowRecommendationResponse | undefined = undefined;

export function validateFixtures(): void {}
