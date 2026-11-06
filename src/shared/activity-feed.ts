export type ActivityFeedPlatform = 'hyperliquid' | 'polymarket';

export interface ActivityFeedConfig {
  enabled: boolean;
  refreshIntervalSeconds: number;
}

export interface ActivityFeedItem {
  eventId: string;
  platform: ActivityFeedPlatform | string;
  actor: { twitterId: string; handle: string; avatarUrl: string; name?: string };
  market: { id: string; label: string; icon: string; outcome?: string };
  side: 'buy' | 'sell' | string;
  price: string;
  quantity: string;
  notional: string;
  eventTime: string;
  trade?: ActivityFeedTrade;
}

export interface ActivityFeedTrade {
  action:
    | 'opened'
    | 'added'
    | 'reduced'
    | 'closed'
    | 'flipped'
    | 'liquidated'
    | 'bought'
    | 'sold'
    | string;
  position: 'long' | 'short' | null;
  toPosition?: 'long' | 'short';
  realizedPnlUsd: string | null;
}

export type ActivityFeedPostSource = 'x' | 'substack';

export interface ActivityFeedPostTag {
  assetId: string;
  asset: string;
  direction: 'bullish' | 'bearish' | 'neutral' | string;
  claimType: string;
  text: string;
}

export interface ActivityFeedPostBadge {
  kind: 'track_record' | 'peer_reaction' | 'conviction' | string;
  text: string;
}

export interface ActivityFeedPost {
  eventId: string;
  source: ActivityFeedPostSource | string;
  actor: { twitterId: string; handle: string; avatarUrl: string; name?: string };
  postedAt: string;
  url: string;
  title: string | null;
  summary: string;
  tags: ActivityFeedPostTag[];
  badge: ActivityFeedPostBadge | null;
}

export interface ActivityFeedPostsPage {
  items: ActivityFeedPost[];
  nextBefore: string | null;
  generatedAt: string;
}

export interface ActivityFeedPage {
  items: ActivityFeedItem[];
  nextBefore: string | null;
  generatedAt: string;
}
