
export type TokenChartPeriod = "7D" | "30D" | "3M" | "6M" | "12M";

export const PERIOD_TO_DURATION: Record<TokenChartPeriod, string> = {
  "7D": "7d",
  "30D": "30d",
  "3M": "3m",
  "6M": "6m",
  "12M": "12m",
};

export interface TokenChartMeta {
  tickerId: string;

  symbol: string;

  name?: string;

  logo?: string;

  kind: "stock" | "crypto";

  interval: string;

  priceAvailable: boolean;

  sentimentAvailable: boolean;
  sentimentInterval: string;

  sentimentMode: "absolute" | "average";
}

export interface TickerChartResponse {
  timestamps: number[];
  price: (number | null)[];
  sentiment: (number | null)[];
  events?: (string | null)[];
  meta: TokenChartMeta;
}

export interface TokenChartPoint {
  t: number;
  price: number | null;
  sentiment: number | null;
  event: string | null;
}

export interface TokenChartResult {
  symbol: string;
  points: TokenChartPoint[];
  meta: TokenChartMeta;
}
