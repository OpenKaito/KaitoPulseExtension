
export type AccountSizeTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

const TIER_LABELS: Record<AccountSizeTier, string> = {
  1: '1+',
  2: '10+',
  3: '100+',
  4: '1,000+',
  5: '10,000+',
  6: '100,000+',
  7: '1M+',
  8: '10M+',
  9: '100M+',
};

export const ACCOUNT_SIZE_TIERS = 9;

export const ACCOUNT_SIZE_DOT_AXIS = [4.58333, 10, 15.4167] as const;
export const ACCOUNT_SIZE_DOT_R = 1.875;

export const ACCOUNT_SIZE_DOT_CELLS = ACCOUNT_SIZE_DOT_AXIS.flatMap((cy) =>
  ACCOUNT_SIZE_DOT_AXIS.map((cx) => ({ cx, cy })),
);

export function accountSizeTierFromBucket(bucket: string | null | undefined): AccountSizeTier | null {
  if (!bucket) return null;
  const found = (Object.keys(TIER_LABELS) as Array<`${AccountSizeTier}`>).find(
    (tier) => TIER_LABELS[Number(tier) as AccountSizeTier] === bucket,
  );
  return found ? (Number(found) as AccountSizeTier) : null;
}

export const ACCOUNT_SIZE_FLOOR_USD = 1;

export function formatAccountSize(tier: AccountSizeTier): string {
  return TIER_LABELS[tier];
}

export function clampTier(tier: number): AccountSizeTier {
  return Math.min(Math.max(Math.round(tier), 1), ACCOUNT_SIZE_TIERS) as AccountSizeTier;
}
