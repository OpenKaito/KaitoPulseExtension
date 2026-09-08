export interface CashtagOccurrence {
  cashtag: string;

  tweetId?: string;

  authorId?: string;

  entityHint?: string;

  authorHandle?: string;
}

export interface ResolvedTicker {
  cashtag: string;

  tweetId: string | null;
  tickerId: string;
  symbol: string;
  name: string;

  logo?: string;

  kind: 'stock' | 'crypto';

  ambiguous: boolean;

  candidates: string[];

  resolvedBy: 'global' | 'entity_hint' | 'author_handle' | 'tweet' | 'author';
}

export interface TickerResolveResponse {
  resolved: ResolvedTicker[];
}
