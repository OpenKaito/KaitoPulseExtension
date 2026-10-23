import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (/\.png(\?|$)/.test(url)) {
      return { format: 'module', source: 'export default "";', shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const { withTradingSummary } = await import('../src/popup/data/from-trading-summary.ts');
const { EMPTY_DATA } = await import('../src/popup/data/empty.ts');

type Summary = NonNullable<Parameters<typeof withTradingSummary>[1]>;
type Referral = NonNullable<Parameters<typeof withTradingSummary>[3]>;
type Account = Summary['accounts'][number];
type Subtotal = NonNullable<Summary['platforms']>[number];

const account = (over: Partial<Account>): Account =>
  ({
    platform: 'variational',
    accountId: '0xABCDEF0000000000000000000000000000ABCDEF',
    source: 'attestation',
    valueLabel: 'Account Value',
    nativeValue: null,
    nativeCurrency: null,
    valueUsd: 1,
    includedInTotal: true,
    exclusionReason: null,
    pnl: null,
    pnlBasis: null,
    pnlCompleteness: null,
    pnlCoversFrom: null,
    pnlCoversTo: null,
    dataAsOf: null,
    verifiedAt: null,
    ...over,
  }) as Account;

const summary = (accounts: Account[]): Summary =>
  ({
    accountValue: { bucket: null, totalUsd: null, currency: 'USD', coveredAccounts: 0, totalAccounts: 0 },
    allTimePnl: { value: null, coveredAccounts: 0, totalAccounts: 0, fxApproximate: false },
    platforms: [],
    accounts,
    calculatedAt: null,
  }) as unknown as Summary;

const referral = (rows: Partial<Referral['accounts'][number]>[]): Referral => ({
  accounts: rows.map((row) => ({
    platform: 'variational',
    accountId: null,
    referredUsers: null,
    referredVolume: null,
    volumeWindow: 'all_time',
    dataSource: 'snapshot',
    verifiedAt: 0,
    ...row,
  })),
});

const included = (accounts: Account[], rows?: Referral) =>
  withTradingSummary(EMPTY_DATA, summary(accounts), undefined, rows).includedAccounts;

test('referral rows join their account regardless of address case', () => {
  const [row] = included(
    [account({})],
    referral([
      { accountId: '0xabcdef0000000000000000000000000000abcdef', referredUsers: 120, referredVolume: 3000 },
    ]),
  );
  assert.deepEqual(row.referral, { users: 120, volume: 3000 });
  assert.equal(row.referralVerifiable, undefined);
});

test('a referral platform without referral data offers to verify it; others do not', () => {
  const [polymarket, pumpfun] = included(
    [account({ platform: 'polymarket', accountId: '0xpm' }), account({ platform: 'pumpfun', accountId: 'So1' })],
    referral([]),
  );
  assert.equal(polymarket.referral, undefined);
  assert.equal(polymarket.referralVerifiable, true);
  assert.equal(pumpfun.referralVerifiable, undefined);
});

test('nothing referral-related renders before the referral summary arrives', () => {
  const [row] = included([account({})]);
  assert.equal(row.referral, undefined);
  assert.equal(row.referralVerifiable, undefined);
});

test('the legacy Referral switches no longer hide an account\'s referral', () => {
  const [row] = included(
    [account({ referralPublic: false })],
    referral([
      {
        accountId: '0xabcdef0000000000000000000000000000abcdef',
        referredUsers: 5,
        referralPublic: false,
      },
    ]),
  );
  assert.deepEqual(row.referral, { users: 5, volume: null });
});

test('points and tier come from the account, whatever its Points switch', () => {
  const [shown] = included([account({ points: 0.041739, tier: { name: 'Iron', pointsRate: 1 } })]);
  assert.deepEqual(shown.points, { total: 0.041739, tier: 'Iron' });

  const [hidden] = included([account({ points: 3, pointsPublic: false })]);
  assert.deepEqual(hidden.points, { total: 3, tier: null });

  const [none] = included([account({ platform: 'hyperliquid', accountId: '0xhl' })]);
  assert.equal(none.points, undefined);
});

const groups = (accounts: Account[], rows?: Referral) =>
  withTradingSummary(EMPTY_DATA, summary(accounts), undefined, rows).platformGroups;

test('a platform card sums its public accounts\' referral and shows the verify link only when none has any', () => {
  const [hl] = groups(
    [
      account({ platform: 'hyperliquid', accountId: '0xa1', publicOnX: true }),
      account({
        platform: 'hyperliquid',
        accountId: '0xa2',
        publicOnX: true,
        referralPublic: false,
      }),
      account({ platform: 'hyperliquid', accountId: '0xa3', publicOnX: true }),
      account({ platform: 'hyperliquid', accountId: '0xa4', publicOnX: false }),
      account({ platform: 'hyperliquid', accountId: '0xa5' }),
    ],
    referral([
      { platform: 'hyperliquid', accountId: '0xa1', referredUsers: 70, referredVolume: 1_000_000 },
      { platform: 'hyperliquid', accountId: '0xa2', referredUsers: 9, referredVolume: 200_000 },
      { platform: 'hyperliquid', accountId: '0xa4', referredUsers: 500, referredVolume: 9_000_000 },
      { platform: 'hyperliquid', accountId: '0xa5', referredUsers: 40, referredVolume: 7_000_000 },
    ]),
  );
  assert.deepEqual(hl.referral, { users: 79, volume: 1_200_000 });
  assert.equal(hl.referralVerifiable, undefined);

  const [pm] = groups([account({ platform: 'polymarket', accountId: '0xpm' })], referral([]));
  assert.equal(pm.referral, undefined);
  assert.equal(pm.referralVerifiable, true);
});

test('a platform card sums points; the tier is the highest by points rate', () => {
  const [same] = groups([
    account({ accountId: '0xv1', points: 1.5, tier: { name: 'Gold', pointsRate: 1.2 } }),
    account({ accountId: '0xv2', points: 2, tier: { name: 'Gold', pointsRate: 1.2 } }),
  ]);
  assert.deepEqual(same.points, { total: 3.5, tier: 'Gold' });

  const [mixed] = groups([
    account({ accountId: '0xv1', points: 1, tier: { name: 'Iron', pointsRate: 1 } }),
    account({ accountId: '0xv2', points: 1, tier: { name: 'Gold', pointsRate: 1.2 } }),
    account({ accountId: '0xv3', points: 1 }),
  ]);
  assert.deepEqual(mixed.points, { total: 3, tier: 'Gold' });
});

test('a platform card counts every account in points and tier, whatever its Points switch', () => {
  const [group] = groups([
    account({ accountId: '0xv1', points: 1, tier: { name: 'Iron', pointsRate: 1 } }),
    account({
      accountId: '0xv2',
      points: 4,
      tier: { name: 'Platinum', pointsRate: 1.5 },
      pointsPublic: false,
    }),
  ]);
  assert.deepEqual(group.points, { total: 5, tier: 'Platinum' });
  assert.deepEqual(group.accounts[1].points, { total: 4, tier: 'Platinum' });

  const [allHidden] = groups([
    account({ points: 2, tier: { name: 'Iron', pointsRate: 1 }, pointsPublic: false }),
  ]);
  assert.deepEqual(allHidden.points, { total: 2, tier: 'Iron' });
});

test("a platform card's points total is the backend subtotal when it carries one", () => {
  const response = summary([
    account({ accountId: '0xv1', points: 1 }),
    account({ accountId: '0xv2', points: 2, pointsPublic: false }),
  ]);
  const subtotal = { platform: 'variational', points: 10 } as Subtotal;
  const [group] = withTradingSummary(
    EMPTY_DATA,
    { ...response, platforms: [subtotal] },
    undefined,
  ).platformGroups;
  assert.equal(group.points?.total, 10);

  const withoutPoints = { platform: 'variational' } as Subtotal;
  const [fallback] = withTradingSummary(
    EMPTY_DATA,
    { ...response, platforms: [withoutPoints] },
    undefined,
  ).platformGroups;
  assert.equal(fallback.points?.total, 3);
});

test('the account count leaves out Privy-linked wallets but the card still lists them', () => {
  const [hl] = groups([
    account({ platform: 'hyperliquid', accountId: '0xa1', origin: 'verified' }),
    account({ platform: 'hyperliquid', accountId: '0xa2', origin: 'linked', valueUsd: 5 }),
    account({ platform: 'hyperliquid', accountId: '0xa3' }),
  ]);
  assert.equal(hl.accountCount, 2);
  assert.equal(hl.accounts.length, 3);
  assert.equal(hl.value, 7);
});

test("a platform card's timestamp is its newest verification", () => {
  const older = account({ accountId: '0xv1', dataAsOf: '2026-09-01T00:00:00.000Z' });
  const newer = account({ accountId: '0xv2', dataAsOf: '2026-10-10T00:00:00.000Z' });
  const [olderRow, newerRow] = included([older, newer]);
  assert.notEqual(olderRow.timestampLabel, newerRow.timestampLabel);

  const [first] = groups([older, newer]);
  assert.equal(first.timestampLabel, newerRow.timestampLabel);
  const [second] = groups([newer, older]);
  assert.equal(second.timestampLabel, newerRow.timestampLabel);
});

const fullSummary = (): Summary =>
  ({
    ...summary([
      account({ accountId: '0xv1', valueUsd: 0.5, pnlUsd: 3, publicOnX: true }),
      account({ accountId: '0xv2', valueUsd: 0.2, pnlUsd: -1, publicOnX: false }),
    ]),
    accountValue: {
      bucket: null,
      totalUsd: 0.7,
      currency: 'USD',
      coveredAccounts: 2,
      totalAccounts: 2,
      coveredPlatforms: 1,
    },
    allTimePnl: {
      value: 2,
      basis: 'platform_all_time',
      completeness: null,
      coversFrom: null,
      coversTo: null,
      currency: 'USD',
      fxApproximate: false,
      coveredAccounts: 2,
      totalAccounts: 3,
      coveredPlatforms: 1,
    },
  }) as Summary;

const publicTotals = (bucket: string | null): NonNullable<Summary['publicTotals']> => ({
  accountValue: {
    bucket,
    currency: 'USD',
    coveredAccounts: 1,
    totalAccounts: 1,
    coveredPlatforms: 1,
  },
  allTimePnl: {
    value: 3,
    basis: 'platform_all_time',
    completeness: null,
    coversFrom: null,
    coversTo: null,
    currency: 'USD',
    fxApproximate: true,
    coveredAccounts: 1,
    totalAccounts: 2,
    coveredPlatforms: 1,
  },
});

test('the header covers only the accounts shown on X when the backend sends publicTotals', () => {
  const data = withTradingSummary(
    EMPTY_DATA,
    { ...fullSummary(), publicTotals: publicTotals(null) },
    undefined,
  );
  assert.equal(data.profile.accountSize, null);
  assert.equal(data.profile.accountValueUsd, null);
  assert.equal(data.profile.allTimePnlUsd, 3);
  assert.equal(data.profile.allTimePnlApproximate, true);
  assert.deepEqual(data.tradingCoverage, { covered: 1, total: 2 });
  assert.equal(data.platformGroups[0].value, 0.7);
  assert.equal(data.platformGroups[0].accounts.length, 2);
});

test('the public header bucket comes from publicTotals', () => {
  const data = withTradingSummary(
    EMPTY_DATA,
    { ...fullSummary(), publicTotals: publicTotals('1,000+') },
    undefined,
  );
  assert.equal(data.profile.accountSize, 4);
  assert.equal(data.profile.accountValueUsd, null);
});

test('publicTotals null shows no header figures', () => {
  const data = withTradingSummary(
    EMPTY_DATA,
    { ...fullSummary(), publicTotals: null },
    undefined,
  );
  assert.equal(data.profile.accountSize, null);
  assert.equal(data.profile.accountValueUsd, null);
  assert.equal(data.profile.allTimePnlUsd, null);
  assert.equal(data.profile.allTimePnlApproximate, false);
  assert.equal(data.tradingCoverage, null);
  assert.equal(data.platformGroups[0].value, 0.7);
});

test('without publicTotals (older backend) the header keeps the full self-view totals', () => {
  const data = withTradingSummary(EMPTY_DATA, fullSummary(), undefined);
  assert.equal(data.profile.accountValueUsd, 0.7);
  assert.equal(data.profile.allTimePnlUsd, 2);
  assert.equal(data.profile.allTimePnlApproximate, false);
  assert.deepEqual(data.tradingCoverage, { covered: 2, total: 3 });
});
