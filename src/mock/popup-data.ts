
import type { CircleProofAccount, FollowRecommendationResponse } from '@/shared/recommend-follow';
import type { IncludedAccount, PlatformGroup, PopupData, SmartFollower } from '@/popup/data/types';
import type { ExtensionSocialCard } from '@/shared/extension-social';
import type { SocialCardData } from '@/popup/social-card/view-model';
import {
  assertFixtureShapes,
  daysBefore,
  elidedAddress,
  evmAddress,
  FIXTURE_NOW,
  minutesBefore,
  xId,
} from './generate';

function avatar(hue: number, rx = 32): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue},70%,62%)"/>` +
    `<stop offset="1" stop-color="hsl(${(hue + 48) % 360},72%,38%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="64" height="64" rx="${rx}" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function noise(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const FIXTURE_VIEW_SECONDS = 2700;

const FIXTURE_INVITE_CODE = '8k2f';

const TOP_SMART_FOLLOWERS: SmartFollower[] = [
  { twitterId: xId('follower', 1), username: 'Larkfield', handle: '@0xLarkfield', followers: 128, avatarUrl: avatar(8) },
  { twitterId: xId('follower', 2), username: 'Nightpool', handle: '@nightpool_x', followers: 112, avatarUrl: avatar(52) },
  { twitterId: xId('follower', 3), username: 'Tidewalker', handle: '@tidewalker', followers: 96, avatarUrl: avatar(96) },
  { twitterId: xId('follower', 4), username: 'Ketra', handle: '@KetraTrades', followers: 84, avatarUrl: avatar(140) },
  { twitterId: xId('follower', 5), username: 'GRN', handle: '@GrandRenewal', followers: 73, avatarUrl: avatar(184) },
  { twitterId: xId('follower', 6), username: 'Nimbus AI', handle: '@Nimbus_Labs', followers: 61, avatarUrl: avatar(228) },
  { twitterId: xId('follower', 7), username: 'EVinvestor', handle: '@iamEVinvestor', followers: 49, avatarUrl: avatar(272) },
  { twitterId: xId('follower', 8), username: 'Pentanode', handle: '@Pentanode', followers: 37, avatarUrl: avatar(316) },

  { twitterId: xId('follower', 9), username: 'Weftdart', handle: '@weftdart', followers: 34, avatarUrl: avatar(20) },
  { twitterId: xId('follower', 10), username: 'Alden Merrow', handle: '@CryptoMerrow', followers: 31, avatarUrl: avatar(64) },
  { twitterId: xId('follower', 11), username: 'Vesper', handle: '@VesperKalind', followers: 29, avatarUrl: avatar(108) },
  { twitterId: xId('follower', 12), username: 'punk4417', handle: '@punk4417', followers: 27, avatarUrl: avatar(152) },
  { twitterId: xId('follower', 13), username: 'weiluo', handle: '@weiluo', followers: 24, avatarUrl: avatar(196) },
  { twitterId: xId('follower', 14), username: 'Tantalus', handle: '@0xTantalus', followers: 22, avatarUrl: avatar(240) },
  { twitterId: xId('follower', 15), username: 'Adrian Renwick', handle: '@Renwickk', followers: 19, avatarUrl: avatar(284) },
  { twitterId: xId('follower', 16), username: 'tinyling', handle: '@tinyling', followers: 17, avatarUrl: avatar(328) },
  { twitterId: xId('follower', 17), username: 'DeFi Orren', handle: '@DefiOrren', followers: 15, avatarUrl: avatar(36) },
  { twitterId: xId('follower', 18), username: 'Path 2 FI', handle: '@Path2FI', followers: 12, avatarUrl: avatar(80) },
  { twitterId: xId('follower', 19), username: 'Mossy', handle: '@chunkymoss_', followers: 10, avatarUrl: avatar(124) },
  { twitterId: xId('follower', 20), username: 'Cream Lane', handle: '@CreamLaneDaily', followers: 8, avatarUrl: avatar(168) },
];

const HL_MAIN_ADDRESS = evmAddress('hyperliquid', 0);

const HL_MAIN: IncludedAccount = {
  platform: 'hyperliquid',
  displayName: 'Hyperliquid',
  brandColor: '#96fce4',
  accountId: HL_MAIN_ADDRESS,

  accountLabel: elidedAddress(HL_MAIN_ADDRESS),
  valueLabel: 'Account Value',
  value: 455426.97,
  pnl: -14023.09,
  pnlLabel: 'All-Time P&L',
  perpOnly: true,
  includedInTotal: true,
  timestampLabel: 'Updated 2h ago',
  nativeAmount: null,
  publicOnX: true,
};

const HL_SECOND_ADDRESS = evmAddress('hyperliquid', 1);

const HL_SECOND: IncludedAccount = {
  platform: 'hyperliquid',
  displayName: 'Hyperliquid',
  brandColor: '#96fce4',
  accountId: HL_SECOND_ADDRESS,

  accountLabel: elidedAddress(HL_SECOND_ADDRESS),
  valueLabel: 'Account Value',
  value: 128640.5,
  pnl: 8420.35,
  pnlLabel: 'All-Time P&L',
  perpOnly: true,
  includedInTotal: true,
  timestampLabel: 'Updated 2h ago',
  nativeAmount: null,
  publicOnX: true,
};

const HL_THIRD_ADDRESS = evmAddress('hyperliquid', 2);

const HL_THIRD: IncludedAccount = {
  platform: 'hyperliquid',
  displayName: 'Hyperliquid',
  brandColor: '#96fce4',
  accountId: HL_THIRD_ADDRESS,

  accountLabel: elidedAddress(HL_THIRD_ADDRESS),
  valueLabel: 'Account Value',
  value: 76389.22,
  pnl: 2190.4,
  pnlLabel: 'All-Time P&L',
  perpOnly: true,
  includedInTotal: true,
  timestampLabel: 'Updated 2h ago',

  publicOnX: false,
  nativeAmount: null,
};

const POLYMARKET_ACCOUNT_ADDRESS = evmAddress('polymarket', 0);

const POLYMARKET_ACCOUNT: IncludedAccount = {
  platform: 'polymarket',
  displayName: 'Polymarket',
  brandColor: '#89a2ff',
  accountId: POLYMARKET_ACCOUNT_ADDRESS,

  accountLabel: elidedAddress(POLYMARKET_ACCOUNT_ADDRESS),
  profile: {
    name: 'Pranjal',
    avatarUrl: avatar(210),
    joined: 'Joined jan 2021',
    bio: 'Experimental tip response b0t. Min refundable tip is a 0.26.',
  },
  valueLabel: 'Positions Value',
  value: 56212.29,
  pnl: 14023.09,
  pnlLabel: 'All-Time P&L',
  perpOnly: false,
  includedInTotal: true,
  timestampLabel: 'Updated 2h ago',
  nativeAmount: null,
  publicOnX: true,
};

const HYPERLIQUID_ACCOUNTS: IncludedAccount[] = [HL_MAIN, HL_SECOND, HL_THIRD];

const INCLUDED_ACCOUNTS: IncludedAccount[] = [
  HL_MAIN,
  HL_SECOND,
  HL_THIRD,
  POLYMARKET_ACCOUNT,
];

const FIXTURE_PLATFORM_GROUPS: PlatformGroup[] = [
  {
    platform: 'hyperliquid',
    displayName: 'Hyperliquid',
    brandColor: '#96fce4',
    accounts: HYPERLIQUID_ACCOUNTS,
    value: 660456.69,
    pnl: -3412.34,
    valueLabel: 'Account Value',
    pnlLabel: 'All-Time P&L',
    perpOnly: true,
    timestampLabel: 'Updated 2h ago',
    publicCount: 2,
  },
  {
    platform: 'polymarket',
    displayName: 'Polymarket',
    brandColor: '#89a2ff',
    accounts: [POLYMARKET_ACCOUNT],
    value: 56212.29,
    pnl: 14023.09,
    valueLabel: 'Positions Value',
    pnlLabel: 'All-Time P&L',
    perpOnly: false,
    timestampLabel: 'Updated 2h ago',
    publicCount: 1,
  },
];

export const FIXTURE_DATA: PopupData = {
  profile: {
    username: 'Rivett',
    handle: '@Punk3155',
    avatarUrl: avatar(268),
    aura: 84,
    auraDelta: 18,
    smartFollowers: 12456,
    accountSize: 1,
    allTimePnlUsd: 127450,
  },
  aura: {
    total: 84,
    rank: 2418,

    earned: 72,
    referral: 12,
    inviteUrl: `kaito.ai/invite/${FIXTURE_INVITE_CODE}`,
  },
  social: {
    categories: [
      { label: 'Crypto', score: 880, rank: 1 },
      { label: 'AI', score: 1200, rank: 1 },
      { label: 'Equity Trading', score: 4500, rank: 45 },
    ],
    followers: TOP_SMART_FOLLOWERS,
    followersOrdering: 'recent',
  },
  tradingOverview: { calculatedLabel: 'Calculated Aug 9, 10:00' },

  tradingCoverage: { covered: 2, total: 2 },
  includedAccounts: INCLUDED_ACCOUNTS,
  platformGroups: FIXTURE_PLATFORM_GROUPS,
  timeSpent: { minutes: FIXTURE_VIEW_SECONDS / 60 },
};

export const FIXTURE_SOCIAL_CARD: SocialCardData = {
  scope: 'crypto',
  name: 'Larkfield',
  handle: '@larkfield',
  avatarUrl: avatar(8, 0),
  bio: 'I like to train large deep neural nets. Previously Director of AI @Voltari, founding team @NovaLabsAI.',
  totalFollowers: 21_700,
  smartFollowers: 41_000,
  segmentSmartFollowers: 2541,
  impressions: 150_000,
  smartEngagements: 12_700,

  dailyEngagements: Array.from({ length: 365 }, (_, i) => {
    const date = new Date(Date.now() - (364 - i) * 86_400_000).toISOString().slice(0, 10);
    const active = noise(i) < 0.25 + 0.45 * (i / 365);
    const intensity = (active ? 1 + Math.floor(noise(i * 3 + 7) * 5) : 0) as 0 | 1 | 2 | 3 | 4 | 5;
    return { date, intensity, tweet_count: intensity, smart_engagement_count: intensity * 4 };
  }),
  smartFollowersStats: {
    topPct: 0.03,
    highestRank: 12,

    highestRankDate: '2026-07-14',

    line: Array.from({ length: 60 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 3, 1) + i * 86_400_000).toISOString().slice(0, 10),
      value: 900 + i * 18 + Math.sin(i / 6) * 90 + noise(i) * 40,
    })),
  },
  mindshareStats: {
    current: 50,
    topPct: 0.03,
    highestRank: 12,
    highestRankDate: '2026-05-02',

    line: Array.from({ length: 52 }, (_, i) => ({
      date: new Date(Date.UTC(2025, 7, 3) + i * 7 * 86_400_000).toISOString().slice(0, 10),
      value: 0.35 + i * 0.022 + Math.sin(i / 4) * 0.12 + noise(i * 5) * 0.08,
    })),
  },

  topSmartFollowers: [
    { avatarUrl: avatar(8, 0), name: 'Larkfield', handle: '@0xLarkfield' },
    { avatarUrl: avatar(52, 0), name: 'Nightpool', handle: '@nightpool_x' },
    { avatarUrl: avatar(96, 0), name: 'Tidewalker', handle: '@tidewalker' },
    { avatarUrl: avatar(140, 0), name: 'Ketra', handle: '@KetraTrades' },
    { avatarUrl: avatar(184, 0), name: 'GRN', handle: '@GrandRenewal' },
    { avatarUrl: avatar(228, 0), name: 'Nimbus AI', handle: '@Nimbus_Labs' },
    { avatarUrl: avatar(272, 0), name: 'EVinvestor', handle: '@iamEVinvestor' },
    { avatarUrl: avatar(316, 0), name: 'Pentanode', handle: '@Pentanode' },
    { avatarUrl: avatar(20, 0), name: 'Loomdart', handle: '@weftdart' },
    { avatarUrl: avatar(64, 0), name: 'Arthur Hayes', handle: '@CryptoMerrow' },
    { avatarUrl: avatar(108, 0), name: 'Vitalik', handle: '@VesperKalind' },
    { avatarUrl: avatar(152, 0), name: 'punk6529', handle: '@punk4417' },
  ],
  hasDetails: true,
};

export const FIXTURE_SOCIAL_CARD_LINKS: ExtensionSocialCard = {
  imageUrl: null,
  shortUrl: `https://ka.io/s/${FIXTURE_INVITE_CODE}`,
  profileUrl: 'https://kaito.ai/share/social-card/fixture-token',
  sector: 'crypto',
  updatedAtMs: daysBefore(21),
  mySocialsUrl: 'https://kaito.ai/my-socials',
};

function circleProof(hues: number[]): CircleProofAccount[] {
  return hues.map((hue, index) => ({

    twitterId: xId(`circle/${hue}`, index),
    handle: `mutual_${hue}`,
    displayName: `Mutual ${index + 1}`,
    avatarUrl: avatar(hue),
  }));
}

export const FIXTURE_RECOMMENDATIONS: FollowRecommendationResponse = {

  computedAt: FIXTURE_NOW,

  nextRefreshAt: FIXTURE_NOW + 5 * 60_000,
  reason: null,
  totalViewSeconds: FIXTURE_VIEW_SECONDS,
  items: [
    {
      rank: 1,
      twitterId: xId('recommendation', 1),
      handle: 'aixbt_agent',
      displayName: 'aixbt',
      avatarUrl: avatar(18),
      followersCount: 412_000,
      generalSf: 1_820,
      tags: ['AI', 'Crypto', 'Trading'],
      creatorType: 'Creator',
      bio: 'Autonomous market intelligence.',
      evidence: { impressionCnt: 41, clickCnt: 6, dwellSeconds: 214, lastSeenAt: minutesBefore(167), seenPostCount: 12, maxViewSeconds: 137 },

      circleCount: 37,
      circleProof: circleProof([12, 84, 190]),
    },
    {
      rank: 2,
      twitterId: xId('recommendation', 2),
      handle: 'Punk9059',
      displayName: 'Sisyphus',
      avatarUrl: avatar(122),
      followersCount: 96_400,
      generalSf: 940,
      tags: ['Crypto', 'DeFi'],
      creatorType: null,
      bio: 'Rolling the boulder onchain.',
      evidence: { impressionCnt: 22, clickCnt: 3, dwellSeconds: 96, lastSeenAt: minutesBefore(167), seenPostCount: 8, maxViewSeconds: 41 },
      circleCount: 3,
      circleProof: circleProof([44, 150, 300]),
    },
    {
      rank: 3,
      twitterId: xId('recommendation', 3),
      handle: 'MonadCommunity',
      displayName: 'Monad Community',
      avatarUrl: avatar(266),
      followersCount: 288_000,
      generalSf: 2_310,
      tags: [],
      creatorType: 'Project',

      bio: 'Community-run account for everything Monad. Not the official team.',
      evidence: { impressionCnt: 15, clickCnt: 0, dwellSeconds: 58, lastSeenAt: minutesBefore(167), seenPostCount: 5, maxViewSeconds: 23 },

      circleCount: 1,
      circleProof: circleProof([210]),
    },
    {
      rank: 4,
      twitterId: xId('recommendation', 4),
      handle: 'zerebro',
      displayName: '',
      avatarUrl: '',
      followersCount: 51_200,
      generalSf: 405,
      tags: ['AI'],
      creatorType: 'Creator',

      circleCount: 0,
      circleProof: [],
      bio: 'thoughts from the latent space.',
      evidence: { impressionCnt: 9, clickCnt: 2, dwellSeconds: 33, lastSeenAt: minutesBefore(167), seenPostCount: 4, maxViewSeconds: 0 },
    },
    {
      rank: 5,
      twitterId: xId('recommendation', 5),
      handle: 'HyperliquidX',
      displayName: 'Hyperliquid',
      avatarUrl: avatar(160),
      followersCount: 604_000,
      generalSf: 3_120,
      tags: ['Trading', 'DeFi', 'Perps'],
      creatorType: 'Project',
      bio: 'A performant L1 for a fully onchain open financial system.',
      evidence: { impressionCnt: 7, clickCnt: 0, dwellSeconds: 19, lastSeenAt: minutesBefore(167), seenPostCount: 3, maxViewSeconds: 0 },

      circleCount: 212,
      circleProof: [],
    },
  ],
};

export function validateFixtures(): void {
  assertFixtureShapes({
    followers: TOP_SMART_FOLLOWERS,
    profileHandle: FIXTURE_DATA.profile.handle,
    accounts: INCLUDED_ACCOUNTS,
    recommendations: FIXTURE_RECOMMENDATIONS.items,
    cardFollowers: FIXTURE_SOCIAL_CARD.topSmartFollowers,

    epochs: [FIXTURE_RECOMMENDATIONS.computedAt, FIXTURE_SOCIAL_CARD_LINKS.updatedAtMs],
  });
}
