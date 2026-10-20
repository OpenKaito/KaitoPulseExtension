import type { PopoverTotals, ReferralTotals } from '../types';

export function hasServedTotals(totals: PopoverTotals | undefined): boolean {
  return totals != null && (totals.accountValue != null || totals.allTimePnl != null);
}

export function hasReferralTotals(referral: ReferralTotals | undefined): boolean {
  return referral != null && (referral.referredUsers != null || referral.referredVolume != null);
}
