
import type { ExtensionProof, ExtensionVerifier } from '@/shared/contracts';
import type { PlatformMeta, TaskStatus, VerifyCategory, VerifyTask } from './types';

const ZKTLS_STEPS = (platform: string): string[] => [
  `Log in to ${platform} — we open the page for you`,
  'Keep the tab open while we read the required data securely (zkTLS)',
  'A cryptographic proof is generated and submitted — we never see your password',
];

const ZKTLS_FOOTNOTE =
  'Only a pass/fail proof is shared. We never see your password, and no funds will be moved.';

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
      verifies: 'Proxy wallet ownership',
      time: '~2 min',
      validity: 'Valid for 30 days',
      earn: ['· Campaign reward eligibility (TBD)'],
      steps: ZKTLS_STEPS('Polymarket'),
      footnote: ZKTLS_FOOTNOTE,
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
      time: '~1 min',
      validity: 'Verified once, no expiry',
      earn: ['· Campaign reward eligibility (TBD)'],
      steps: ZKTLS_STEPS('X'),
      footnote: ZKTLS_FOOTNOTE,
    },
  },
];

const CATALOG_BY_PLATFORM = new Map(PLATFORM_CATALOG.map((meta) => [meta.platform, meta]));

const ALLOWED_VERIFY_PLATFORMS: ReadonlySet<string> = new Set(['x', 'polymarket', 'axis']);

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

type VerifierMetaOverride = Partial<Omit<PlatformMeta, 'tile' | 'detail'>> & {
  tile?: Partial<PlatformMeta['tile']>;
  detail?: Partial<PlatformMeta['detail']>;
};

const VERIFIER_META_OVERRIDES: Record<string, VerifierMetaOverride> = {

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
      footnote: ZKTLS_FOOTNOTE,
    },
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

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

    .filter((v) => ALLOWED_VERIFY_PLATFORMS.has(v.platform))
    .sort((a, b) => orderOf(a.platform) - orderOf(b.platform));

  for (const verifier of sorted) {

    const base = CATALOG_BY_PLATFORM.get(verifier.platform) ?? metaForUnknownPlatform(verifier);
    const meta = metaForVerifier(base, verifier.id);
    seenPlatforms.add(verifier.platform);
    tasks.push({
      id: verifier.id,
      meta,
      verifier,
      status: statusFor(verifications[verifier.id], now),
    });
  }

  for (const meta of PLATFORM_CATALOG) {
    if (seenPlatforms.has(meta.platform)) continue;
    tasks.push({ id: `platform:${meta.platform}`, meta, status: statusFor(undefined, now) });
  }

  return tasks.sort((a, b) => orderOf(a.meta.platform) - orderOf(b.meta.platform));
}

export function tasksInCategory(tasks: VerifyTask[], category: VerifyCategory | 'all'): VerifyTask[] {
  return category === 'all' ? tasks : tasks.filter((t) => t.meta.category === category);
}

export const CATEGORY_TABS: Array<{ id: VerifyCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'trading', label: 'Trading' },
  { id: 'social', label: 'Social' },
];
