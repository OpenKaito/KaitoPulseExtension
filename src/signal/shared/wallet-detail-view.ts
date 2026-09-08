import { createResource, type Accessor } from 'solid-js';
import { isHyperliquidWalletSummary } from '@/shared/wallet-detail';
import type { HyperliquidAccount, PolymarketAccount } from '../types';
import { getWalletDetail, type WalletDetailPlatform } from '../wallet-detail-store';
import { count, perpPositionRow, predictionMarketRow, usd } from './format';

export type WalletDetailStatus = 'idle' | 'loading' | 'ready' | 'withheld' | 'unavailable';

export type WalletDetailView = {
  status: WalletDetailStatus;
  positions: ReturnType<typeof perpPositionRow>[];
  markets: ReturnType<typeof predictionMarketRow>[];
  summary:
    | {
        platform: 'hyperliquid';
        accountValue: string;
        upnl: string;
        upnlNegative: boolean;
        profitLoss: string;
        profitLossNegative: boolean;
      }
    | {
        platform: 'polymarket';
        positionsValue: string;
        profitLoss: string;
        profitLossNegative: boolean;
        predictions: string;
      }
    | null;
  positionsTotal: number | null;
};

const IDLE: WalletDetailView = {
  status: 'idle',
  positions: [],
  markets: [],
  summary: null,
  positionsTotal: null,
};

export function createWalletDetail(
  platform: WalletDetailPlatform,
  address: Accessor<string | null>,
): Accessor<WalletDetailView> {
  const [entry] = createResource(address, (addr) => getWalletDetail(platform, addr));

  return () => {
    if (entry.loading) return { ...IDLE, status: 'loading' };
    const value = entry.state === 'ready' ? entry() : undefined;
    if (value == null)
      return entry.state === 'unresolved' ? IDLE : { ...IDLE, status: 'unavailable' };
    if (value.status !== 'ok') return { ...IDLE, status: value.status };

    const { summary, positions, markets, total } = value.data;
    return {
      status: 'ready',
      positions: positions.map(perpPositionRow),
      markets: markets.map(predictionMarketRow),
      summary: isHyperliquidWalletSummary(summary)
        ? {
            platform: 'hyperliquid',
            accountValue: usd(summary.accountValue),
            upnl: usd(summary.uPnl),
            upnlNegative: summary.uPnl < 0,
            profitLoss: usd(summary.pnlAllTime),
            profitLossNegative: summary.pnlAllTime < 0,
          }
        : {
            platform: 'polymarket',
            positionsValue: usd(summary.positionsValue),
            profitLoss: usd(summary.pnlAllTime),
            profitLossNegative: summary.pnlAllTime < 0,
            predictions: count(summary.predictions),
          },
      positionsTotal: total,
    };
  };
}

export function withHyperliquidDetail(
  account: HyperliquidAccount,
  view: WalletDetailView,
): HyperliquidAccount {
  if (view.summary?.platform !== 'hyperliquid') return account;
  return {
    ...account,
    accountValue: view.summary.accountValue,
    upnl: view.summary.upnl,
    upnlNegative: view.summary.upnlNegative,
    profitLoss: view.summary.profitLoss,
    profitLossNegative: view.summary.profitLossNegative,
    positionsTotal: view.positionsTotal ?? account.positionsTotal,
    positions: view.positions,
  };
}

export function withPolymarketDetail(
  account: PolymarketAccount,
  view: WalletDetailView,
): PolymarketAccount {
  if (view.summary?.platform !== 'polymarket') return account;
  return {
    ...account,
    positionsValue: view.summary.positionsValue,
    profitLoss: view.summary.profitLoss,
    profitLossNegative: view.summary.profitLossNegative,
    predictions: view.summary.predictions,
    positionsTotal: view.positionsTotal ?? account.positionsTotal,
    markets: view.markets,
  };
}
