
export type BehaviorEventKind = 'impression' | 'click' | 'follow' | 'unfollow';

export type BehaviorSurface = 'feed' | 'usercell' | 'hovercard' | 'profile';

export interface BehaviorActor {
  twitterId: string | null;
  handle: string | null;
}

export type ClickTargetType =
  | 'open_detail'
  | 'media'
  | 'link'
  | 'hashtag'
  | 'mention'
  | 'profile'
  | 'engagement_button';

export type EngagementKind = 'like' | 'retweet' | 'reply' | 'bookmark';

export interface ImpressionPayload {
  tweetId: string;
  authorHandle: string | null;
  dwellMs: number;
}

export interface ClickPayload {

  tweetId: string | null;
  targetType: ClickTargetType;
  engagementKind?: EngagementKind;
  href?: string;
}

export interface FollowPayload {
  targetTwitterId: string;
  targetHandle: string | null;
}

interface BehaviorEventBase {
  id: string;
  ts: number;
  actor: BehaviorActor;
  surface: BehaviorSurface;
}

export type BehaviorEvent =
  | (BehaviorEventBase & { kind: 'impression'; payload: ImpressionPayload })
  | (BehaviorEventBase & { kind: 'click'; payload: ClickPayload })
  | (BehaviorEventBase & { kind: 'follow' | 'unfollow'; payload: FollowPayload });

export interface BehaviorEventSnapshot {
  entries: BehaviorEvent[];
}

export function createBehaviorEventId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
