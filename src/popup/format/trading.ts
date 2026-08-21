
import type { TradingAccount } from '@/shared/trading-summary';
import { formatUpdated, formatVerifiedOn, shortDateOf } from './time';

export function pnlLabelFor(account: Pick<TradingAccount, 'pnlBasis' | 'pnlCoversFrom'>): string {
  switch (account.pnlBasis) {
    case 'platform_all_time':
      return 'All-Time P&L';
    case 'snapshot_window': {
      const from = shortDateOf(account.pnlCoversFrom);
      return from ? `P&L · Since ${from}` : 'P&L · Latest';
    }
    case 'accrued_since_verify':
      return 'P&L · Since verification';
    case 'open_positions_only':
      return 'P&L · Open positions';
    default:

      return 'P&L';
  }
}
export function timestampLabelFor(
  account: Pick<TradingAccount, 'source' | 'dataAsOf' | 'verifiedAt'>,
): string | null {
  if (account.source === 'attestation') return formatVerifiedOn(account.verifiedAt);
  return formatUpdated(account.dataAsOf) ?? formatVerifiedOn(account.verifiedAt);
}

export function freshnessSourceOf(
  account: Pick<TradingAccount, 'source' | 'dataAsOf' | 'verifiedAt'>,
): string | null {
  if (account.source === 'attestation') return account.verifiedAt;
  return account.dataAsOf ?? account.verifiedAt;
}

export function formatNativeAmount(
  account: Pick<TradingAccount, 'nativeValue' | 'nativeCurrency'>,
): string | null {
  const { nativeValue, nativeCurrency } = account;
  if (nativeValue == null || !Number.isFinite(nativeValue) || !nativeCurrency) return null;
  const amount = nativeValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
  return `${amount} ${nativeCurrency}`;
}

export function formatNativePnl(
  account: Pick<TradingAccount, 'pnl' | 'nativeCurrency'>,
): string | null {
  const { pnl, nativeCurrency } = account;
  if (pnl == null || !Number.isFinite(pnl) || !nativeCurrency) return null;
  const sign = pnl < 0 ? '-' : '+';
  const amount = Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
  return `${sign}${amount} ${nativeCurrency}`;
}
