export interface ScreenerRow {
  ticker: string;
  mindshare: number | null;
  mindshare_7d: number | null;
  sentiment: number | null;
  bullish_ratio?: number | null;
  bearish_ratio?: number | null;
  mention?: number | null;
  mention_1d?: number | null;
  price: number | null;
  price_1d: number | null;
}

export interface ScreenerResponse {
  data: ScreenerRow[];
  stale?: boolean;
}
