
export type AuraSummaryResponse = {

  total: number;
  earned: {

    total: number;

    claim: number;

    firstLogin: number;

    attention: number;
  };
  referral: {

    total: number;

    count: number;
  };

  rank: {

    rank: number;

    percentile: number;

    snapshotTotal: number;

    computedAt: string | null;
  } | null;

  onboarded: boolean;

  invite: {

    code: string;

    shortUrl: string | null;
  } | null;
  asOf: {

    realtime: string;

    settledThrough: string | null;
    settlementLagHours: number;
  };

  degraded: boolean;
};

export function roundAura(value: number | null | undefined): number | null {
  return value == null || !Number.isFinite(value) ? null : Math.round(value);
}
