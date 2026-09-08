import type { HyperliquidPosition, PolymarketMarket } from './social-card';

export interface WalletDetailRequest {
  platform: string;

  address: string;

  offset?: number;
  limit?: number;

  includeSeries?: boolean;
}

export const WALLET_DETAIL_PAGE_SIZE = 50;
export const WALLET_DETAIL_MAX_PAGE_SIZE = 200;

export interface HyperliquidWalletSummary {
  accountValue: number;
  uPnl: number;
  pnlAllTime: number;
  positionsCount: number;

  pnlSeries?: Record<string, Array<{ t: number; v: number }>>;
}

export interface PolymarketWalletSummary {
  positionsValue: number;
  pnlAllTime: number;
  predictions: number;
  positionsCount: number;

  pnlSeries?: Record<string, Array<{ t: number; p: number }>>;
}

export type WalletDetailSummary = HyperliquidWalletSummary | PolymarketWalletSummary;

export interface WalletDetailResult {
  platform: string;
  address: string;

  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;

  batchId: number;

  summary: WalletDetailSummary;

  positions?: HyperliquidPosition[];
  markets?: PolymarketMarket[];
}

export function isHyperliquidWalletSummary(
  summary: WalletDetailSummary,
): summary is HyperliquidWalletSummary {
  return 'accountValue' in summary;
}

export type WalletDetailOutcome =
  | { outcome: 'ok'; detail: WalletDetailResult }
  | { outcome: 'withheld' }
  | { outcome: 'unavailable'; error?: string };

export function walletDetailOutcomeFor(status: number): 'withheld' | 'unavailable' {
  return status === 404 ? 'withheld' : 'unavailable';
}

export interface WalletDetailPages<Row> {
  batchId: number;
  rows: Row[];
  total: number;
  hasMore: boolean;
}

export type WalletDetailMerge<Row> =
  | { status: 'merged'; pages: WalletDetailPages<Row> }
  | { status: 'restart' };

export function mergeWalletDetailPage<Row>(
  previous: WalletDetailPages<Row> | null,
  page: WalletDetailResult,
  rows: Row[],
): WalletDetailMerge<Row> {
  if (previous != null && previous.batchId !== page.batchId) return { status: 'restart' };

  const carried = previous == null || page.offset === 0 ? [] : previous.rows.slice(0, page.offset);

  if (carried.length < page.offset) return { status: 'restart' };

  return {
    status: 'merged',
    pages: {
      batchId: page.batchId,
      rows: [...carried, ...rows],
      total: page.total,
      hasMore: page.hasMore,
    },
  };
}
