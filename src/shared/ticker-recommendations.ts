export type TickerAssetType = 'crypto' | 'equity' | 'nft' | 'pretge';

export interface TickerTopPost {
  tweetId: string;
  authorHandle: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  engagement: number;
  createdAt: string;
}

export interface TickerRecommendationItem {
  ticker: string;
  type: TickerAssetType;
  score: number;
  rank: number;
  interactions: number;
  topPost?: TickerTopPost;
}

export interface TickerRecommendationsResponse {
  generatedAt: string;
  source: 'personal' | 'fallback';
  items: TickerRecommendationItem[];
}
