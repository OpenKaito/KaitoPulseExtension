import type { ExtensionProof, ExtensionVerifier } from '@/shared/contracts';
import type { PlatformMeta, TaskStatus, VerifyCategory, VerifyTask } from './types';

const ZKTLS_STEPS = (platform: string): string[] => [
  `Log in to ${platform} — we open the page for you`,
  'Keep the tab open while we read the required data securely (zkTLS)',
  'A cryptographic proof is generated and submitted — we never see your password',
];

const SERVER_READ_STEPS = (platform: string): string[] => [
  `Verify the wallet you trade ${platform} with, on Kaito — once, no gas`,
  `We read your public ${platform} referral stats for that address`,
  'The reading is recorded against your Kaito account',
];

export const PLATFORM_CATALOG: PlatformMeta[] = [
  {
    platform: 'polymarket',
    displayName: 'Polymarket',
    category: 'trading',
    groupLabel: 'DEX',
    kind: 'zktls',
    cardTitle: 'Verify Polymarket wallet ownership to claim reward',
    cardSubtitle: 'Prove ownership of your Polymarket proxy wallet',
    payTier: 'high',
    tile: { letter: 'P', bg: '#2E6FF2', fg: '#FFFFFF' },
    detail: {
      requirement: 'A signed-in Polymarket account',
      verifies:
        'Proxy wallet ownership \u00b7 referral signups \u00b7 referral earnings \u00b7 active traders \u00b7 referral code and link',
      time: '~2 min',
      validity: 'Valid for 30 days',
      earn: ['· Campaign reward eligibility (TBD)'],
      steps: ZKTLS_STEPS('Polymarket'),
    },
  },
  {
    platform: 'x',
    displayName: 'X',
    category: 'social',
    groupLabel: 'Social',
    kind: 'zktls',
    cardTitle: 'Verify your X account analytics',
    cardSubtitle: 'Prove your 7-day reach and engagement via extension',
    payTier: 'high',
    tile: { letter: 'X', bg: '#000000', fg: '#FFFFFF' },
    detail: {
      requirement: 'X Premium account, signed in',

      verifies: 'Impressions · engagements · profile visits · followers · daily trend',
      alsoReads: 'Creator Rewards eligibility progress',
      time: '~1 min',
      validity: 'Verified once, no expiry',
      earn: ['· Campaign reward eligibility (TBD)'],
      steps: ZKTLS_STEPS('X'),
    },
  },
  {
    platform: 'pumpfun',
    displayName: 'Pump.fun',
    category: 'trading',
    groupLabel: 'DEX',
    kind: 'zktls',
    cardTitle: 'Verify your pump.fun account to claim reward',
    cardSubtitle: 'Prove ownership of your pump.fun account',
    payTier: 'medium',
    tile: { letter: 'P', bg: '#22C55E', fg: '#0B0B0B' },
    detail: {
      requirement: 'A signed-in pump.fun account',
      verifies: 'pump.fun account ownership',
      time: '~2 min',
      validity: 'Verify only',
      earn: ['· Campaign reward eligibility (TBD)'],
      steps: ZKTLS_STEPS('pump.fun'),
    },
  },
  {
    platform: 'fomo',
    displayName: 'fomo',
    category: 'trading',
    groupLabel: 'DEX',
    kind: 'zktls',
    cardTitle: 'Verify your fomo account to claim reward',
    cardSubtitle: 'Prove your fomo account value and PnL',
    payTier: 'medium',
    tile: { letter: 'F', bg: '#111111', fg: '#FFFFFF' },
    detail: {
      requirement: 'A signed-in fomo account',
      verifies: 'Account value · total PnL · 24h / 7d / 30d PnL',
      time: '~1 min',
      validity: 'Verify only',
      earn: ['· Campaign reward eligibility (TBD)'],
      steps: ZKTLS_STEPS('fomo'),
    },
  },
  {
    platform: 'hyperliquid',
    displayName: 'Hyperliquid',
    category: 'referral',
    groupLabel: 'DEX',
    kind: 'server_read',
    cardTitle: 'Verify your Hyperliquid referrals to claim reward',
    cardSubtitle: 'Prove the referrals credited to your Hyperliquid address',
    payTier: 'medium',
    tile: { letter: 'H', bg: '#072723', fg: '#97FCE4' },
    detail: {
      requirement: 'A verified Hyperliquid wallet on Kaito',
      verifies: 'Referred users · referred volume · referral rewards · referral code and stage',
      time: '~1 min',
      validity: 'Verify only',
      earn: ['· Campaign reward eligibility (TBD)'],
      steps: SERVER_READ_STEPS('Hyperliquid'),
    },
  },
  {
    platform: 'variational',
    displayName: 'Variational',
    category: 'trading',
    groupLabel: 'DEX',
    kind: 'zktls',
    snapshot: true,
    cardTitle: 'Verify your Variational portfolio to claim reward',
    cardSubtitle: 'Prove the value and PnL of your Variational account',
    payTier: 'medium',
    tile: { letter: 'V', bg: '#111827', fg: '#E5E7EB' },
    detail: {
      requirement: 'A signed-in Variational account',
      verifies:
        'Account value \u00b7 all-time PnL \u00b7 PnL history \u00b7 unrealized PnL \u00b7 holdings \u00b7 positions \u00b7 referred users \u00b7 referred trading volume \u00b7 points',
      time: '~2 min',
      validity: 'Verify only',
      earn: ['· Campaign reward eligibility (TBD)'],
      steps: ZKTLS_STEPS('Variational'),
    },
  },
  {
    platform: 'lighter',
    displayName: 'Lighter',
    category: 'trading',
    groupLabel: 'DEX',
    kind: 'zktls',
    cardTitle: 'Verify your Lighter wallet to claim reward',
    cardSubtitle:
      'Prove the Lighter account you trade with; its value and PnL are then read from Lighter',
    payTier: 'medium',
    tile: { letter: 'L', bg: '#1F2937', fg: '#FFFFFF' },
    detail: {
      requirement: 'A signed-in Lighter account',
      verifies:
        'Wallet address \u00b7 referred users \u00b7 referred trading volume \u00b7 account value, PnL and positions read afterwards from Lighter',
      time: '~2 min',
      validity: 'Verify only',
      earn: ['· Campaign reward eligibility (TBD)'],
      steps: ZKTLS_STEPS('Lighter'),
    },
  },
  {
    platform: 'binance',
    displayName: 'Binance',
    category: 'trading',
    groupLabel: 'CEX',
    kind: 'zktls',
    snapshot: true,
    cardTitle: 'Verify Binance account value to claim reward',
    cardSubtitle: 'Prove the value and PnL of your Binance account',
    payTier: 'high',
    tile: { letter: 'B', bg: '#F0B90B', fg: '#1A1400' },
    detail: {
      requirement: 'A signed-in Binance account',
      verifies:
        "Account value \u00b7 PnL on current holdings \u00b7 today's PnL \u00b7 unrealized PnL \u00b7 holdings \u00b7 futures positions \u00b7 30-day history \u00b7 deposits and withdrawals",
      time: '~2 min',
      validity: 'Valid for 30 days',
      earn: ['\u00b7 Campaign reward eligibility (TBD)'],
      steps: ZKTLS_STEPS('Binance'),
    },
  },
  {
    platform: 'okx',
    displayName: 'OKX',
    category: 'trading',
    groupLabel: 'CEX',
    kind: 'zktls',
    snapshot: true,
    cardTitle: 'Verify OKX account value to claim reward',
    cardSubtitle: 'Prove the holdings and PnL in your OKX account',
    payTier: 'high',
    tile: { letter: 'O', bg: '#FFFFFF', fg: '#000000' },
    detail: {
      requirement: 'A signed-in OKX account',
      verifies:
        'Account value \u00b7 PnL history \u00b7 unrealized PnL \u00b7 holdings \u00b7 positions \u00b7 asset history \u00b7 transfers',
      time: '~2 min',
      validity: 'Valid for 30 days',
      earn: ['\u00b7 Campaign reward eligibility (TBD)'],
      steps: ZKTLS_STEPS('OKX'),
    },
  },
  {
    platform: 'bitget',
    displayName: 'Bitget',
    category: 'trading',
    groupLabel: 'CEX',
    kind: 'zktls',
    snapshot: true,
    cardTitle: 'Verify Bitget account value to claim reward',
    cardSubtitle: 'Prove the value of your Bitget account',
    payTier: 'high',
    tile: { letter: 'B', bg: '#00F0FF', fg: '#000000' },
    detail: {
      requirement: 'A signed-in Bitget account',
      verifies: 'Account value \u00b7 window PnL by product \u00b7 30-day history',
      time: '~2 min',
      validity: 'Valid for 30 days',
      earn: ['\u00b7 Campaign reward eligibility (TBD)'],
      steps: ZKTLS_STEPS('Bitget'),
    },
  },
  {
    platform: 'gate',
    displayName: 'Gate',
    category: 'trading',
    groupLabel: 'CEX',
    kind: 'zktls',
    snapshot: true,
    cardTitle: 'Verify Gate account value to claim reward',
    cardSubtitle: 'Prove the value and PnL of your Gate account',
    payTier: 'high',
    tile: { letter: 'G', bg: '#2354E6', fg: '#FFFFFF' },
    detail: {
      requirement: 'A signed-in Gate account',
      verifies: 'Account value \u00b7 window PnL \u00b7 30-day history',
      time: '~2 min',
      validity: 'Valid for 30 days',
      earn: ['\u00b7 Campaign reward eligibility (TBD)'],
      steps: ZKTLS_STEPS('Gate'),
    },
  },
  {
    platform: 'kraken',
    displayName: 'Kraken',
    category: 'trading',
    groupLabel: 'CEX',
    kind: 'zktls',
    snapshot: true,
    cardTitle: 'Verify Kraken account value to claim reward',
    cardSubtitle: 'Prove the holdings in your Kraken account',
    payTier: 'high',
    tile: { letter: 'K', bg: '#5741D9', fg: '#FFFFFF' },
    detail: {
      requirement: 'A signed-in Kraken account',
      verifies: 'Account value \u00b7 holdings \u00b7 30-day history',
      time: '~2 min',
      validity: 'Valid for 30 days',
      earn: ['\u00b7 Campaign reward eligibility (TBD)'],
      steps: ZKTLS_STEPS('Kraken'),
    },
  },
  {
    platform: 'bybit',
    displayName: 'Bybit',
    category: 'trading',
    groupLabel: 'CEX',
    kind: 'zktls',
    snapshot: true,
    cardTitle: 'Verify Bybit account value to claim reward',
    cardSubtitle: 'Prove the holdings and positions in your Bybit account',
    payTier: 'high',
    tile: { letter: 'B', bg: '#F7A600', fg: '#1A0D00' },
    detail: {
      requirement: 'A signed-in Bybit account',
      verifies:
        'Account value \u00b7 all-time PnL \u00b7 unrealized PnL \u00b7 holdings \u00b7 futures positions \u00b7 30-day history \u00b7 deposits and withdrawals',
      time: '~2 min',
      validity: 'Valid for 30 days',
      earn: ['\u00b7 Campaign reward eligibility (TBD)'],
      steps: ZKTLS_STEPS('Bybit'),
    },
  },
  {
    platform: 'mexc',
    displayName: 'MEXC',
    category: 'trading',
    groupLabel: 'CEX',
    kind: 'zktls',
    snapshot: true,
    cardTitle: 'Verify MEXC account value to claim reward',
    cardSubtitle: 'Prove the value of your MEXC account',
    payTier: 'high',
    tile: { letter: 'M', bg: '#1972F5', fg: '#FFFFFF' },
    detail: {
      requirement: 'A signed-in MEXC account',
      verifies: 'Account value \u00b7 window PnL by product \u00b7 30-day history',
      time: '~2 min',
      validity: 'Valid for 30 days',
      earn: ['\u00b7 Campaign reward eligibility (TBD)'],
      steps: ZKTLS_STEPS('MEXC'),
    },
  },
];

const CATALOG_BY_PLATFORM = new Map(PLATFORM_CATALOG.map((meta) => [meta.platform, meta]));

const ALLOWED_VERIFY_PLATFORMS: ReadonlySet<string> = new Set([
  'x',
  'polymarket',
  'axis',
  'pumpfun',
  'fomo',
  'hyperliquid',
  'variational',
  'lighter',
]);

const LIVE_ONLY_PLATFORMS: ReadonlySet<string> = new Set([
  'fomo',
  'hyperliquid',
  'variational',
  'lighter',
]);

export function isSupportedVerifyPlatform(platform: string): boolean {
  return ALLOWED_VERIFY_PLATFORMS.has(platform);
}

function capitaliseDataType(item: string): string {
  const firstWord = item.split(/\s/, 1)[0] ?? '';
  if (/[.A-Z]/.test(firstWord)) return item;
  return item.charAt(0).toUpperCase() + item.slice(1);
}

export function dataTypeLabels(verifies: string): string[] {
  return verifies
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(capitaliseDataType);
}

export function consentFields(verifies: string): string[] {
  const fields = dataTypeLabels(verifies);
  return fields.some((f) => /account id|wallet address/i.test(f))
    ? fields
    : [...fields, 'Account ID'];
}

type VerifierMetaOverride = Partial<Omit<PlatformMeta, 'tile' | 'detail'>> & {
  tile?: Partial<PlatformMeta['tile']>;
  detail?: Partial<PlatformMeta['detail']>;
};

const VERIFIER_META_OVERRIDES: Record<string, VerifierMetaOverride> = {
  polymarket_referral: {
    cardTitle: 'Verify your Polymarket referrals to claim reward',
    cardSubtitle: 'Prove your referral signups and earnings',
    detail: {
      requirement: 'A signed-in Polymarket account with a referral link',
      verifies: 'Referral signups · referral earnings · active traders · referral code and link',
    },
  },
  fomo_referral: {
    cardTitle: 'Verify your fomo referrals to claim reward',
    cardSubtitle: 'Prove how many friends you referred and what they earned you',
    detail: {
      requirement: 'A signed-in fomo account',
      verifies:
        'Friends referred · total referral fees · 24h / 7d referral fees · referral code and link',
    },
  },
  lighter_referral: {
    category: 'referral',
    cardTitle: 'Verify your Lighter referrals to claim reward',
    cardSubtitle: 'Prove how many users you referred on Lighter and how much they traded',
    payTier: 'medium',
    detail: {
      requirement: 'A signed-in Lighter account',
      verifies:
        'Referred users · premium referrals · referred trading volume · fees paid by referrals · your referral code and link · the code you signed up with · wallet address',
      validity: 'Verify only',
    },
  },
  variational_referral: {
    category: 'referral',
    cardTitle: 'Verify your Variational referrals to claim reward',
    cardSubtitle: 'Prove how many users you referred on Variational and how much they traded',
    payTier: 'medium',
    detail: {
      requirement: 'A signed-in Variational account',
      verifies:
        'Referred users · referred trading volume · referral earnings (claimed and unclaimed) · points · referral code and link · account ID',
      validity: 'Verify only',
    },
  },
  binance_referral_volume: {
    category: 'referral',
    cardTitle: 'Verify your Binance referrals to claim reward',
    cardSubtitle: 'Prove how many users you referred on Binance and how much they traded',
    payTier: 'medium',
    detail: {
      requirement: 'A signed-in Binance account',
      verifies:
        'Referred users · referred trading volume · commission · referral code and link · account ID',
      validity: 'Verify only',
    },
  },
  okx_referral: {
    category: 'referral',
    cardTitle: 'Verify your OKX referrals to claim reward',
    cardSubtitle: 'Prove how many users you referred on OKX and how much they traded',
    payTier: 'medium',
    detail: {
      requirement: 'A signed-in OKX account',
      verifies:
        'Referred users · referred trading volume · rewards · referral code and link · account ID',
      validity: 'Verify only',
    },
  },
  bybit_referral: {
    category: 'referral',
    cardTitle: 'Verify your Bybit referrals to claim reward',
    cardSubtitle: 'Prove how many users you referred on Bybit and how much they traded',
    payTier: 'medium',
    detail: {
      requirement: 'A signed-in Bybit account',
      verifies:
        'Referred users · referred trading volume · commission · referral code and link · account ID',
      validity: 'Verify only',
    },
  },
  bitget_referral: {
    category: 'referral',
    cardTitle: 'Verify your Bitget referrals to claim reward',
    cardSubtitle: 'Prove how many users you referred on Bitget and how much they traded',
    payTier: 'medium',
    detail: {
      requirement: 'A signed-in Bitget account',
      verifies: 'Referred users · referred trading volume · referral code and link · account ID',
      validity: 'Verify only',
    },
  },
  gate_referral: {
    category: 'referral',
    cardTitle: 'Verify your Gate referrals to claim reward',
    cardSubtitle: 'Prove how many users you referred on Gate',
    payTier: 'medium',
    detail: {
      requirement: 'A signed-in Gate account',
      verifies: 'Referred users · referral code and link · account ID',
      validity: 'Verify only',
    },
  },
  kraken_referral: {
    category: 'referral',
    cardTitle: 'Verify your Kraken referrals to claim reward',
    cardSubtitle: 'Prove how many users you referred on Kraken',
    payTier: 'medium',
    detail: {
      requirement: 'A signed-in Kraken account',
      verifies: 'Referred users · completed referrals · referral code and plan · account ID',
      validity: 'Verify only',
    },
  },
  mexc_referral: {
    category: 'referral',
    cardTitle: 'Verify your MEXC referrals to claim reward',
    cardSubtitle: 'Prove how many users you referred on MEXC and how much they traded',
    payTier: 'medium',
    detail: {
      requirement: 'A signed-in MEXC account',
      verifies:
        'Referred users · referred trading volume and its period · referral code and link · account ID',
      validity: 'Verify only',
    },
  },
};

function metaForVerifier(base: PlatformMeta, verifierId: string): PlatformMeta {
  const override = VERIFIER_META_OVERRIDES[verifierId];
  if (!override) return base;
  return {
    ...base,
    ...override,
    tile: override.tile ? { ...base.tile, ...override.tile } : base.tile,
    detail: override.detail ? { ...base.detail, ...override.detail } : base.detail,
  };
}

function metaForUnknownPlatform(verifier: ExtensionVerifier): PlatformMeta {
  const displayName = verifier.platform.charAt(0).toUpperCase() + verifier.platform.slice(1);
  return {
    platform: verifier.platform,
    displayName,
    category: 'trading',
    groupLabel: 'DEX',
    kind: 'zktls',
    cardTitle: `Verify your ${displayName} account to claim reward`,
    cardSubtitle: 'Verify via extension',
    payTier: 'medium',
    tile: { letter: displayName.charAt(0).toUpperCase(), bg: '#3A3F47', fg: '#F5F7FA' },
    detail: {
      requirement: `${displayName} verification`,
      verifies: verifier.name,
      time: '~2 min',
      validity: 'Verify only',
      earn: ['· Campaign reward eligibility (TBD)'],
      steps: ZKTLS_STEPS(displayName),
    },
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function isSnapshotUpdate(task: VerifyTask): boolean {
  return (
    task.meta.snapshot === true && task.category !== 'referral' && task.status.state === 'verified'
  );
}

export function statusFor(proof: ExtensionProof | undefined, now: number): TaskStatus {
  if (!proof) return { state: 'available' };

  const daysSince = Math.max(0, Math.floor((now - proof.verifiedAt) / DAY_MS));
  return { state: 'verified', proof, daysSince };
}

export function statusEquals(a: TaskStatus, b: TaskStatus): boolean {
  if (a.state !== b.state) return false;
  if (a.state === 'verified' && b.state === 'verified') {
    return a.daysSince === b.daysSince && a.proof.proofId === b.proof.proofId;
  }
  return true;
}

const VERIFY_CATEGORIES: ReadonlySet<string> = new Set<VerifyCategory>([
  'ai',
  'crypto',
  'trading',
  'social',
  'referral',
]);

function resolveTaskCategory(wire: string | undefined, fallback: VerifyCategory): VerifyCategory {
  return wire !== undefined && VERIFY_CATEGORIES.has(wire) ? (wire as VerifyCategory) : fallback;
}

const REFERRAL_CARRIED_BY_TRADING: ReadonlySet<string> = new Set([
  'polymarket_referral',
  'variational_referral',
  'lighter_referral',
]);

function admitsVerifier(verifier: ExtensionVerifier): boolean {
  return (
    ALLOWED_VERIFY_PLATFORMS.has(verifier.platform) && !REFERRAL_CARRIED_BY_TRADING.has(verifier.id)
  );
}

export function buildTasks(
  verifiers: ExtensionVerifier[],
  verifications: Record<string, ExtensionProof>,
  now: number,
): VerifyTask[] {
  const tasks: VerifyTask[] = [];
  const seenPlatforms = new Set<string>();

  const orderOf = (platform: string): number => {
    const idx = PLATFORM_CATALOG.findIndex((m) => m.platform === platform);
    return idx === -1 ? PLATFORM_CATALOG.length : idx;
  };
  const sorted = [...verifiers]

    .filter(admitsVerifier)
    .sort((a, b) => orderOf(a.platform) - orderOf(b.platform));

  for (const verifier of sorted) {
    const base = CATALOG_BY_PLATFORM.get(verifier.platform) ?? metaForUnknownPlatform(verifier);
    const meta = metaForVerifier(base, verifier.id);
    seenPlatforms.add(verifier.platform);
    tasks.push({
      id: verifier.id,
      meta,
      category: resolveTaskCategory(verifier.category, meta.category),
      verifier,
      status: statusFor(verifications[verifier.id], now),
    });
  }

  for (const meta of PLATFORM_CATALOG) {
    if (seenPlatforms.has(meta.platform)) continue;
    if (!ALLOWED_VERIFY_PLATFORMS.has(meta.platform)) continue;
    if (LIVE_ONLY_PLATFORMS.has(meta.platform)) continue;
    tasks.push({
      id: `platform:${meta.platform}`,
      meta,
      category: meta.category,
      status: statusFor(undefined, now),
    });
  }

  return tasks.sort((a, b) => orderOf(a.meta.platform) - orderOf(b.meta.platform));
}

export function tasksInCategory(
  tasks: VerifyTask[],
  category: VerifyCategory | 'all',
): VerifyTask[] {
  return category === 'all' ? tasks : tasks.filter((t) => t.category === category);
}

export const CATEGORY_TABS: Array<{ id: VerifyCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'trading', label: 'Trading' },
  { id: 'social', label: 'Social' },
  { id: 'referral', label: 'Referral' },
];
