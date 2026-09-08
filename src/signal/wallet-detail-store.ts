import type { HyperliquidPosition, PolymarketMarket } from '@/shared/social-card';
import type {
  WalletDetailPages,
  WalletDetailResult,
  WalletDetailSummary,
} from '@/shared/wallet-detail';
import type { WalletDetailMerge } from '@/shared/wallet-detail';
import { WALLET_DETAIL_PAGE_SIZE, mergeWalletDetailPage } from '@/shared/wallet-detail';
import { createLogger } from './logger';
import { sendKaitoMessage } from './messaging';
import { SwrCache } from './swr-cache';
import { SIGNAL_CONFIG } from './config';

export type WalletDetailPlatform = 'hyperliquid' | 'polymarket';

export type WalletDetailData = {
  summary: WalletDetailSummary;

  positions: HyperliquidPosition[];
  markets: PolymarketMarket[];

  total: number;

  truncated: boolean;
};

export type WalletDetailEntry =
  | { status: 'ok'; data: WalletDetailData }
  | { status: 'withheld' }
  | { status: 'unavailable' };

const MAX_PAGES = 4;

const logger = createLogger('wallet-detail');

type DetailRow = HyperliquidPosition | PolymarketMarket;

function rowsOf(platform: WalletDetailPlatform, page: WalletDetailResult): DetailRow[] {
  return (platform === 'hyperliquid' ? page.positions : page.markets) ?? [];
}

async function requestPage(
  platform: WalletDetailPlatform,
  address: string,
  offset: number,
): Promise<WalletDetailEntry | { status: 'page'; page: WalletDetailResult }> {
  const response = await sendKaitoMessage({
    target: 'kaitoExtension',
    action: 'fetchWalletDetail',
    request: {
      platform,
      address,
      offset,
      limit: WALLET_DETAIL_PAGE_SIZE,

      includeSeries: false,
    },
  });
  if (response.outcome === 'ok') return { status: 'page', page: response.detail };
  if (response.outcome === 'withheld') return { status: 'withheld' };
  return { status: 'unavailable' };
}

async function fetchWalletDetail(
  platform: WalletDetailPlatform,
  address: string,
): Promise<WalletDetailEntry> {
  let pages: WalletDetailPages<DetailRow> | null = null;
  let summary: WalletDetailSummary | null = null;
  let restarted = false;

  for (let fetched = 0; fetched < MAX_PAGES; fetched += 1) {
    const result = await requestPage(platform, address, pages?.rows.length ?? 0);
    if (result.status !== 'page') return pages && summary ? done(platform, pages, summary) : result;

    summary = result.page.summary;

    const merged: WalletDetailMerge<DetailRow> = mergeWalletDetailPage(
      pages,
      result.page,
      rowsOf(platform, result.page),
    );
    if (merged.status === 'restart') {
      if (restarted) break;
      restarted = true;
      pages = null;
      continue;
    }

    pages = merged.pages;
    if (!merged.pages.hasMore) break;
  }

  if (!pages || !summary) return { status: 'unavailable' };
  return done(platform, pages, summary);
}

function done(
  platform: WalletDetailPlatform,
  pages: WalletDetailPages<DetailRow>,
  summary: WalletDetailSummary,
): WalletDetailEntry {
  if (pages.hasMore) {
    logger.warn(`wallet-detail truncated at ${pages.rows.length} of ${pages.total} rows`);
  }
  return {
    status: 'ok',
    data: {
      summary,
      positions: platform === 'hyperliquid' ? (pages.rows as HyperliquidPosition[]) : [],
      markets: platform === 'polymarket' ? (pages.rows as PolymarketMarket[]) : [],
      total: pages.total,
      truncated: pages.hasMore,
    },
  };
}

const cache = new SwrCache<WalletDetailEntry>({
  freshTtl: SIGNAL_CONFIG.cacheFreshTtlMs,
  negativeTtl: SIGNAL_CONFIG.cacheNegativeTtlMs,
  errorBackoff: SIGNAL_CONFIG.cacheErrorBackoffMs,
  maxEntries: SIGNAL_CONFIG.cacheMaxEntries,
  label: 'wallet-detail',
  fetchKeys: async (keys) => {
    const entries = await Promise.all(
      keys.map(async (key): Promise<[string, WalletDetailEntry]> => {
        const separator = key.indexOf(':');
        const platform = key.slice(0, separator) as WalletDetailPlatform;
        return [key, await fetchWalletDetail(platform, key.slice(separator + 1))];
      }),
    );
    return new Map(entries);
  },
});

export function getWalletDetail(
  platform: WalletDetailPlatform,
  address: string,
): Promise<WalletDetailEntry | null> {
  return cache.request(`${platform}:${address}`);
}
