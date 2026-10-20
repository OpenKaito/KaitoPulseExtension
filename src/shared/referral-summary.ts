export type ReferralVolumeWindow =
  | 'all_time'
  | 'last_30d'
  | 'current_quarter'
  | 'current_period'
  | 'not_provided'
  | 'unverified';

export type ReferralAccountRow = {
  platform: string;
  accountId: string | null;
  referredUsers: number | null;
  referredVolume: number | null;
  volumeWindow: ReferralVolumeWindow;
  volumeExpired?: boolean;
  dataSource: 'live' | 'snapshot';
  verifiedAt: number;
  referralPublic?: boolean;
};

export type ReferralSummaryResponse = {
  accounts: ReferralAccountRow[];
};

export const REFERRAL_PROGRAM_PLATFORMS: ReadonlySet<string> = new Set([
  'hyperliquid',
  'polymarket',
  'variational',
  'lighter',
]);

export function referralAccountKey(platform: string, accountId: string): string {
  const id = accountId.trim();
  return `${platform}|${/^0x[0-9a-fA-F]+$/.test(id) ? id.toLowerCase() : id}`;
}
