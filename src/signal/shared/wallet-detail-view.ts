import { createResource, type Accessor } from 'solid-js';
import {
  isHyperliquidWalletSummary,
  type LighterWalletSummary,
  type PolymarketWalletSummary,
} from '@/shared/wallet-detail';
import { tokenRow } from '../social-card-map';
import type {
  AccountPlatformSummary,
  HyperliquidAccount,
  PlatformAccountChip,
  PolymarketAccount,
  TokenAccount,
  TokenPosition,
} from '../types';
import { getWalletDetail, type WalletDetailPlatform } from '../wallet-detail-store';
import {
  count,
  lighterPositionRow,
  perpPositionRow,
  predictionMarketRow,
  usd,
  usdSigned,
} from './format';

export type WalletDetailStatus = 'idle' | 'loading' | 'ready' | 'withheld' | 'unavailable';

export type WalletDetailView = {
  status: WalletDetailStatus;
  positions: ReturnType<typeof perpPositionRow>[];
  markets: ReturnType<typeof predictionMarketRow>[];
  tokens: TokenPosition[];
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
    | {
        platform: 'pumpfun';
        accountValue: string;
      }
    | {
        platform: 'lighter';
        accountValue: string;
        upnl: string;
        upnlNegative: boolean;
        profitLoss: string;
        profitLossNegative: boolean;
      }
    | null;
  positionsTotal: number | null;
};

const IDLE: WalletDetailView = {
  status: 'idle',
  positions: [],
  markets: [],
  tokens: [],
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

    const { summary, positions, markets, holdings, lighterPositions, total } = value.data;
    if (platform === 'lighter') {
      const s = summary as LighterWalletSummary;
      return {
        ...IDLE,
        status: 'ready',
        positions: lighterPositions.map(lighterPositionRow),
        summary: {
          platform: 'lighter',
          accountValue: usd(s.accountValue),
          upnl: usdSigned(s.uPnl),
          upnlNegative: s.uPnl < 0,
          profitLoss: usdSigned(s.pnlAllTime),
          profitLossNegative: (s.pnlAllTime ?? 0) < 0,
        },
        positionsTotal: total,
      };
    }
    if (platform === 'pumpfun') {
      const accountValue = 'accountValue' in summary ? summary.accountValue : null;
      return {
        ...IDLE,
        status: 'ready',
        tokens: holdings.map(tokenRow),
        summary: {
          platform: 'pumpfun',
          accountValue: accountValue == null ? '-' : usd(accountValue),
        },
        positionsTotal: total,
      };
    }
    return {
      status: 'ready',
      positions: positions.map(perpPositionRow),
      markets: markets.map(predictionMarketRow),
      tokens: [],
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
            positionsValue: usd((summary as PolymarketWalletSummary).positionsValue),
            profitLoss: usd((summary as PolymarketWalletSummary).pnlAllTime),
            profitLossNegative: (summary as PolymarketWalletSummary).pnlAllTime < 0,
            predictions: count((summary as PolymarketWalletSummary).predictions),
          },
      positionsTotal: total,
    };
  };
}

export type AccountPositions = {
  hasDetail: Accessor<boolean>;
  chip: Accessor<PlatformAccountChip | undefined>;
  canOpen: Accessor<boolean>;
  view: Accessor<WalletDetailView>;
};

export function createAccountPositions(
  data: Accessor<AccountPlatformSummary>,
  selected: Accessor<number>,
  expanded: Accessor<boolean>,
): AccountPositions {
  const inline = (): boolean =>
    data().protocol !== 'lighter' && data().accounts.some((c) => c.positions != null);
  const hasDetail = (): boolean => data().protocol === 'lighter' || inline();
  const chip = () => data().accounts[Math.min(selected(), data().accounts.length - 1)];
  const canOpen = (): boolean =>
    inline() ? chip()?.positions != null : hasDetail() && chip()?.address != null;
  const fetched = createWalletDetail('lighter', () =>
    data().protocol === 'lighter' && expanded() ? (chip()?.address ?? null) : null,
  );
  const view = (): WalletDetailView => {
    if (!inline()) return fetched();
    const positions = chip()?.positions ?? [];
    return { ...IDLE, status: 'ready', positions, positionsTotal: positions.length };
  };
  return { hasDetail, chip, canOpen, view };
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

export function withPumpfunDetail(account: TokenAccount, view: WalletDetailView): TokenAccount {
  if (view.summary?.platform !== 'pumpfun') return account;
  return {
    ...account,
    hasDetail: true,
    accountValue: view.summary.accountValue,
    positionsTotal: view.positionsTotal ?? account.positionsTotal,
    tokens: view.tokens,
  };
}
