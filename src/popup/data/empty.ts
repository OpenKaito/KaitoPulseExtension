import type { PopupData } from './types';

export const EMPTY_DATA: PopupData = {
  profile: {
    aura: null,
    auraDelta: null,
    smartFollowers: null,
    accountSize: null,

    accountValueUsd: null,
    allTimePnlUsd: null,
  },
  aura: { total: null, rank: null, earned: null, referral: null, inviteUrl: null, inviteCode: null },
  social: { categories: [], followers: [], followersOrdering: 'recent' },

  tradingOverview: null,

  tradingCoverage: null,
  includedAccounts: [],
  platformGroups: [],
  timeSpent: { minutes: 0 },
};
