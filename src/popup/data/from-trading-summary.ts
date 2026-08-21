
import type { TradingAccount, TradingSummaryResponse } from '@/shared/trading-summary';
import { isPerpOnlyPnl, pnlUsdOf } from '@/shared/trading-summary';
import type { HoverCardResult } from '@/shared/social-card';
import { accountSizeTierFromBucket } from '@/shared/account-size';
import { formatJoined, platformBrandColor, platformDisplayName, shortenAddress } from '../format/platforms';
import { epochOf, formatCalculated } from '../format/time';
import {
  formatNativeAmount,
  formatNativePnl,
  freshnessSourceOf,
  pnlLabelFor,
  timestampLabelFor,
} from '../format/trading';
import type { IncludedAccount, PlatformGroup, PopupData } from './types';

function profileFor(platform: string, card: HoverCardResult | undefined): IncludedAccount['profile'] {
  if (platform !== 'polymarket' || !card?.polymarket) return undefined;
  const profile = card.polymarket.profile;
  return {
    name: profile.name || profile.pseudonym || platformDisplayName(platform),
    avatarUrl: profile.avatar,
    joined: formatJoined(profile.joinedAt),
    bio: profile.bio,
  };
}

function toIncludedAccount(account: TradingAccount, card: HoverCardResult | undefined): IncludedAccount {

  const pnlUsd = pnlUsdOf(account);
  return {
    platform: account.platform,
    displayName: platformDisplayName(account.platform),
    brandColor: platformBrandColor(account.platform),
    accountLabel: shortenAddress(account.accountId),
    accountId: account.accountId,
    profile: profileFor(account.platform, card),
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

function oldestTimestampLabel(members: IncludedAccount[]): string | null {
  let oldest: IncludedAccount | undefined;
  for (const account of members) {
    const at = account.freshnessAt;
    if (at == null || !Number.isFinite(at)) continue;
    if (!oldest || at < (oldest.freshnessAt as number)) oldest = account;
  }
  return oldest?.timestampLabel ?? agreed(members, (account) => account.timestampLabel);
}

export function groupByPlatform(accounts: IncludedAccount[]): PlatformGroup[] {
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

    const pnlLabel = agreed(members, (account) => account.pnlLabel);

    const known = members.filter((account) => account.publicOnX !== undefined);
    return {
      platform,
      displayName: head.displayName,
      brandColor: head.brandColor,
      accounts: members,
      value: sumOrNull(counted.map((account) => account.value)),

      pnl: pnlLabel == null ? null : sumOrNull(members.map((account) => account.pnl)),

      fxApproximate: members.some((account) => account.fxApproximate),

      valueLabel: agreed(members, (account) => account.valueLabel) ?? 'Value',

      pnlLabel: pnlLabel ?? 'P&L',

      perpOnly: members.every((account) => account.perpOnly),
      timestampLabel: oldestTimestampLabel(members),
      publicCount: known.length === 0 ? null : known.filter((account) => account.publicOnX).length,
    };
  });
}

export function withTradingSummary(
  base: PopupData,
  summary: TradingSummaryResponse | undefined,
  hoverCard: HoverCardResult | undefined,
): PopupData {
  if (!summary) return base;

  const includedAccounts = summary.accounts.map((account) => toIncludedAccount(account, hoverCard));

  return {
    ...base,
    tradingOverview: {
      calculatedLabel: formatCalculated(summary.calculatedAt),
    },
    profile: {
      ...base.profile,

      accountSize: accountSizeTierFromBucket(summary.accountValue.bucket),

      accountValueUsd: summary.accountValue.coveredAccounts > 0 ? summary.accountValue.totalUsd : null,
      allTimePnlUsd: summary.allTimePnl.value,

      allTimePnlApproximate: summary.allTimePnl.fxApproximate,
    },

    tradingCoverage: {
      covered: summary.allTimePnl.coveredAccounts,
      total: summary.allTimePnl.totalAccounts,
    },
    includedAccounts,
    platformGroups: groupByPlatform(includedAccounts),
  };
}
