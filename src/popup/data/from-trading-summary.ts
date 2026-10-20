import type {
  TradingAccount,
  TradingPlatformSubtotal,
  TradingSummaryResponse,
} from '@/shared/trading-summary';
import { isPerpOnlyPnl, pnlUsdOf } from '@/shared/trading-summary';
import type { HoverCardResult } from '@/shared/social-card';
import {
  REFERRAL_PROGRAM_PLATFORMS,
  referralAccountKey,
  type ReferralAccountRow,
  type ReferralSummaryResponse,
} from '@/shared/referral-summary';
import { accountSizeTierFromBucket } from '@/shared/account-size';
import {
  accountLabelFor,
  formatJoined,
  platformBrandColor,
  platformDisplayName,
} from '../format/platforms';
import { epochOf, formatCalculated } from '../format/time';
import {
  formatNativeAmount,
  formatNativePnl,
  freshnessSourceOf,
  pnlLabelFor,
  timestampLabelFor,
} from '../format/trading';
import type { IncludedAccount, PlatformGroup, PopupData } from './types';

function profileFor(
  platform: string,
  card: HoverCardResult | undefined,
  polymarketAccounts: number,
): IncludedAccount['profile'] {
  if (platform !== 'polymarket' || polymarketAccounts !== 1) return undefined;
  const block = card?.polymarket;
  if (!block || (block.selectedFrom != null && block.selectedFrom !== 1)) return undefined;
  const profile = block.profile;
  return {
    name: profile.name || profile.pseudonym || platformDisplayName(platform),
    avatarUrl: profile.avatar,
    joined: formatJoined(profile.joinedAt),
    bio: profile.bio,
  };
}

const NAMED_ACCOUNT_PLATFORMS = new Set(['polymarket', 'fomo']);

export function accountLabel(
  account: Pick<TradingAccount, 'platform' | 'accountId' | 'displayName'>,
): string {
  const name = account.displayName?.trim();
  return name && NAMED_ACCOUNT_PLATFORMS.has(account.platform)
    ? name
    : accountLabelFor(account.platform, account.accountId);
}

function referralOf(
  account: TradingAccount,
  rows: ReadonlyMap<string, ReferralAccountRow> | undefined,
): Pick<IncludedAccount, 'referral' | 'referralVerifiable'> {
  if (!REFERRAL_PROGRAM_PLATFORMS.has(account.platform)) return {};
  const row = rows?.get(referralAccountKey(account.platform, account.accountId));
  if (row && (row.referredUsers != null || row.referredVolume != null)) {
    return { referral: { users: row.referredUsers, volume: row.referredVolume } };
  }
  return rows ? { referralVerifiable: true } : {};
}

function pointsOf(account: TradingAccount): Pick<IncludedAccount, 'points'> {
  const tier = account.tier?.name?.trim() || null;
  if (account.points == null && !tier) return {};
  return { points: { total: account.points ?? null, tier } };
}

function allPointsOf(account: TradingAccount): Pick<IncludedAccount, 'allPoints'> {
  const tier = account.tier?.name?.trim() ? account.tier : null;
  if (account.points == null && !tier) return {};
  return { allPoints: { total: account.points ?? null, tier } };
}

function toIncludedAccount(
  account: TradingAccount,
  card: HoverCardResult | undefined,
  polymarketAccounts: number,
  referralRows?: ReadonlyMap<string, ReferralAccountRow>,
): IncludedAccount {
  const pnlUsd = pnlUsdOf(account);
  return {
    platform: account.platform,
    displayName: platformDisplayName(account.platform),
    brandColor: platformBrandColor(account.platform),
    accountLabel: accountLabel(account),
    accountId: account.accountId,
    profile: profileFor(account.platform, card, polymarketAccounts),
    valueLabel: account.valueLabel,
    value: account.valueUsd,
    pnl: pnlUsd,

    pnlLabel: pnlLabelFor(account),
    perpOnly: isPerpOnlyPnl(account),
    includedInTotal: account.includedInTotal,
    timestampLabel: timestampLabelFor(account),
    freshnessAt: epochOf(freshnessSourceOf(account)),

    nativeAmount: account.valueUsd == null ? formatNativeAmount(account) : null,

    nativePnlAmount: pnlUsd == null ? formatNativePnl(account) : null,
    fxApproximate: account.fxApproximate,
    publicOnX: account.publicOnX,
    ...referralOf(account, referralRows),
    ...pointsOf(account),
    ...allPointsOf(account),
    ...(account.origin === 'linked' ? { linked: true } : {}),
  };
}

function sumOrNull(values: (number | null)[]): number | null {
  const known = values.filter((value): value is number => value != null && Number.isFinite(value));
  return known.length === 0 ? null : known.reduce((total, value) => total + value, 0);
}

function agreed<T>(members: IncludedAccount[], pick: (account: IncludedAccount) => T): T | null {
  const first = pick(members[0]);
  return members.every((account) => pick(account) === first) ? first : null;
}

function newestTimestampLabel(members: IncludedAccount[]): string | null {
  let newest: IncludedAccount | undefined;
  for (const account of members) {
    const at = account.freshnessAt;
    if (at == null || !Number.isFinite(at)) continue;
    if (!newest || at > (newest.freshnessAt as number)) newest = account;
  }
  return newest?.timestampLabel ?? agreed(members, (account) => account.timestampLabel);
}

function groupReferral(
  members: IncludedAccount[],
): Pick<PlatformGroup, 'referral' | 'referralVerifiable'> {
  const withReferral = members.filter((account) => account.referral && account.publicOnX === true);
  if (withReferral.length > 0) {
    return {
      referral: {
        users: sumOrNull(withReferral.map((account) => account.referral?.users ?? null)),
        volume: sumOrNull(withReferral.map((account) => account.referral?.volume ?? null)),
      },
    };
  }
  return members.some((account) => account.referralVerifiable) ? { referralVerifiable: true } : {};
}

function bestTier(members: IncludedAccount[]): string | null {
  let best: { name: string; pointsRate: number } | null = null;
  for (const account of members) {
    const tier = account.allPoints?.tier;
    if (!tier) continue;
    if (!best || tier.pointsRate > best.pointsRate) best = tier;
  }
  return best?.name.trim() ?? null;
}

function groupPoints(
  members: IncludedAccount[],
  subtotal: TradingPlatformSubtotal | undefined,
): Pick<PlatformGroup, 'points'> {
  const withPoints = members.filter((account) => account.allPoints);
  const backendTotal = subtotal?.points ?? null;
  if (withPoints.length === 0 && backendTotal == null) return {};
  return {
    points: {
      total:
        backendTotal ?? sumOrNull(withPoints.map((account) => account.allPoints?.total ?? null)),
      tier: bestTier(withPoints),
    },
  };
}

export function groupByPlatform(
  accounts: IncludedAccount[],
  subtotals?: readonly TradingPlatformSubtotal[],
): PlatformGroup[] {
  const order: string[] = [];
  const byPlatform = new Map<string, IncludedAccount[]>();
  for (const account of accounts) {
    const existing = byPlatform.get(account.platform);
    if (existing) {
      existing.push(account);
    } else {
      order.push(account.platform);
      byPlatform.set(account.platform, [account]);
    }
  }

  return order.map((platform) => {
    const members = byPlatform.get(platform) as IncludedAccount[];
    const head = members[0];
    const counted = members.filter((account) => account.includedInTotal);

    const subtotal = subtotals?.find((row) => row.platform === platform);
    const withPnl = members.filter((account) => account.pnl != null);
    const pnlLabel = subtotal
      ? subtotal.pnlUsd == null
        ? null
        : pnlLabelFor({ pnlBasis: subtotal.pnlBasis, pnlCoversFrom: subtotal.pnlCoversFrom })
      : members.length === 1
        ? members[0].pnlLabel
        : null;
    const groupPnl = subtotal ? subtotal.pnlUsd : members.length === 1 ? members[0].pnl : null;
    const pnlCoverage =
      subtotal && groupPnl != null && subtotal.pnlCoveredAccounts < subtotal.totalAccounts
        ? `${subtotal.pnlCoveredAccounts} of ${subtotal.totalAccounts} accounts`
        : null;

    const known = members.filter((account) => account.publicOnX !== undefined);
    return {
      platform,
      displayName: head.displayName,
      brandColor: head.brandColor,
      accounts: members,
      accountCount: members.filter((account) => !account.linked).length,
      value: sumOrNull(counted.map((account) => account.value)),

      pnl: groupPnl,
      pnlCoverage,

      fxApproximate: withPnl.some((account) => account.fxApproximate),

      valueLabel: agreed(members, (account) => account.valueLabel) ?? 'Value',

      pnlLabel: pnlLabel ?? 'P&L',

      perpOnly: withPnl.length > 0 && withPnl.every((account) => account.perpOnly),
      timestampLabel: newestTimestampLabel(members),
      publicCount: known.length === 0 ? null : known.filter((account) => account.publicOnX).length,
      ...groupReferral(members),
      ...groupPoints(members, subtotal),
    };
  });
}

function headerTotals(
  base: PopupData,
  summary: TradingSummaryResponse,
): Pick<PopupData, 'profile' | 'tradingCoverage'> {
  if (summary.publicTotals !== undefined) {
    const totals = summary.publicTotals;
    return {
      profile: {
        ...base.profile,
        accountSize: totals ? accountSizeTierFromBucket(totals.accountValue.bucket) : null,
        accountValueUsd: null,
        allTimePnlUsd: totals?.allTimePnl.value ?? null,
        allTimePnlApproximate: totals?.allTimePnl.fxApproximate ?? false,
      },
      tradingCoverage: totals
        ? { covered: totals.allTimePnl.coveredAccounts, total: totals.allTimePnl.totalAccounts }
        : null,
    };
  }
  return {
    profile: {
      ...base.profile,

      accountSize: accountSizeTierFromBucket(summary.accountValue.bucket),

      accountValueUsd:
        summary.accountValue.coveredAccounts > 0 ? summary.accountValue.totalUsd : null,
      allTimePnlUsd: summary.allTimePnl.value,

      allTimePnlApproximate: summary.allTimePnl.fxApproximate,
    },

    tradingCoverage: {
      covered: summary.allTimePnl.coveredAccounts,
      total: summary.allTimePnl.totalAccounts,
    },
  };
}

export function withTradingSummary(
  base: PopupData,
  summary: TradingSummaryResponse | undefined,
  hoverCard: HoverCardResult | undefined,
  referral?: ReferralSummaryResponse,
): PopupData {
  if (!summary) return base;

  const polymarketAccounts = summary.accounts.filter((a) => a.platform === 'polymarket').length;
  const referralRows = referral
    ? new Map(
        referral.accounts
          .filter((row): row is ReferralAccountRow & { accountId: string } => row.accountId != null)
          .map((row) => [referralAccountKey(row.platform, row.accountId), row]),
      )
    : undefined;
  const includedAccounts = summary.accounts.map((account) =>
    toIncludedAccount(account, hoverCard, polymarketAccounts, referralRows),
  );

  return {
    ...base,
    tradingOverview: {
      calculatedLabel: formatCalculated(summary.calculatedAt),
    },
    ...headerTotals(base, summary),
    includedAccounts,
    platformGroups: groupByPlatform(includedAccounts, summary.platforms),
  };
}
