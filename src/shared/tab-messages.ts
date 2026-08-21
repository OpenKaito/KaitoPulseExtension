import type { FollowActionReport } from './recommend-follow';

export type TabMessage =

  | { type: 'kaito:openVerifyPanel'; taskId?: string }

  | { type: 'kaito:followFromRecommendation'; twitterId: string }

  | { type: 'kaito:followFromRecommendationConfirmed'; twitterId: string }

  | { type: 'kaito:followActionReport'; report: FollowActionReport };

export type TabMessageType = TabMessage['type'];
