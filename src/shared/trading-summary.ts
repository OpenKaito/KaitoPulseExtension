
export type TradingSource = 'crawler' | 'attestation' | 'broker';

export type TradingTotalCoverage = {
  currency: string;

  coveredAccounts: number;

  totalAccounts: number;

  coveredPlatforms: number;
};

export type TradingAccountValue = TradingTotalCoverage & {

  bucket: string | null;

  totalUsd: number | null;
};

export type TradingPnlBasis =
  | 'platform_all_time'
  | 'snapshot_window'
  | 'accrued_since_verify'
  | 'open_positions_only';

export type TradingExclusionReason = 'value_unavailable' | 'fx_rate_unavailable' | 'currency_unknown';

export type TradingPnlTotal = TradingTotalCoverage & {

  value: number | null;

  basis: TradingPnlBasis | null;
  completeness: string | null;

  coversFrom: string | null;
  coversTo: string | null;

  fxApproximate?: boolean;
};

export type TradingAccount = {

  platform: string;

  accountId: string;
  source: TradingSource;

  valueLabel: string;

  nativeValue: number | null;
  nativeCurrency: string | null;

  valueUsd: number | null;
  includedInTotal: boolean;
  exclusionReason: TradingExclusionReason | null;

  fxRate?: number | null;
  fxRateDate?: string | null;

  pnl: number | null;

  pnlUsd?: number | null;

  fxApproximate?: boolean;
  pnlBasis: TradingPnlBasis | null;
  pnlCompleteness: string | null;

  pnlCoversFrom: string | null;
  pnlCoversTo: string | null;

  dataAsOf: string | null;

  verifiedAt: string | null;

  publicOnX?: boolean;
};

export type TradingPnlUnavailableReason = 'no_pnl_data' | 'mixed_windows';

export type TradingPlatformSubtotal = {
  platform: string;

  valueLabel: string;
  totalAccounts: number;

  publicAccounts: number;

  publicOnX: boolean;
  valueUsd: number | null;

  bucket: string | null;
  valueCoveredAccounts: number;

  pnlUsd: number | null;
  pnlBasis: TradingPnlBasis | null;
  pnlCompleteness: string | null;
  pnlCoversFrom: string | null;
  pnlCoversTo: string | null;
  pnlCoveredAccounts: number;
  pnlUnavailableReason: TradingPnlUnavailableReason | null;

  fxApproximate?: boolean;
  currency: string;

  dataAsOf: string | null;
};

export type TradingSummaryResponse = {
  accountValue: TradingAccountValue;
  allTimePnl: TradingPnlTotal;
  accounts: TradingAccount[];

  platforms?: TradingPlatformSubtotal[];

  includedPlatforms: string[];

  calculatedAt: string;

  degraded: boolean;
};

function isAllTimeBasis(basis: TradingPnlBasis | null | undefined): boolean {
  return basis === 'platform_all_time';
}

export function isPerpOnlyPnl(account: Pick<TradingAccount, 'platform' | 'pnlBasis'>): boolean {
  return account.platform === 'hyperliquid' && isAllTimeBasis(account.pnlBasis);
}

export function pnlUsdOf(
  account: Pick<TradingAccount, 'pnl' | 'pnlUsd' | 'nativeCurrency'>,
): number | null {
  if (account.pnlUsd !== undefined) return account.pnlUsd;
  return account.nativeCurrency == null || account.nativeCurrency === 'USD' ? account.pnl : null;
}
