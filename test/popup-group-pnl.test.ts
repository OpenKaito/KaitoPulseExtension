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
  // Icon imports (`./x.png?inline`) are Vite's; stub them as empty strings.
  load(url, context, nextLoad) {
    if (/\.png(\?|$)/.test(url)) {
      return { format: 'module', source: 'export default "";', shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const { groupByPlatform } = await import('../src/popup/data/from-trading-summary.ts');

type Account = Parameters<typeof groupByPlatform>[0][number];

const account = (over: Partial<Account>): Account =>
  ({
    platform: 'pumpfun',
    displayName: 'Pump.fun',
    brandColor: '#86efac',
    includedInTotal: true,
    value: 1,
    pnl: null,
    pnlLabel: 'P&L',
    fxApproximate: false,
    valueLabel: 'Account Value',
    perpOnly: false,
    ...over,
  }) as Account;

type Subtotal = NonNullable<Parameters<typeof groupByPlatform>[1]>[number];

const subtotal = (over: Partial<Subtotal>): Subtotal =>
  ({
    platform: 'pumpfun',
    totalAccounts: 4,
    pnlUsd: null,
    pnlBasis: null,
    pnlCoversFrom: null,
    pnlCoveredAccounts: 0,
    fxApproximate: false,
    ...over,
  }) as Subtotal;

test("the group's P&L is the backend subtotal, with its coverage disclosed (pump.fun, 2026-09-29)", () => {
  const members = [account({ pnl: -10, pnlLabel: 'All-Time P&L' }), account({}), account({}), account({})];
  const [group] = groupByPlatform(members, [
    subtotal({ pnlUsd: -10, pnlBasis: 'platform_all_time', pnlCoveredAccounts: 1 }),
  ]);
  assert.equal(group.pnl, -10);
  assert.equal(group.pnlLabel, 'All-Time P&L');
  assert.equal(group.pnlCoverage, '1 of 4 accounts');
});

test('🛑 the backend refusing to add P&Ls up (different windows) is kept — no member re-sum', () => {
  const members = [
    account({ pnl: -10, pnlLabel: 'P&L · Since Sep 1' }),
    account({ pnl: 5, pnlLabel: 'P&L · Since Sep 1' }),
    account({}),
  ];
  const [group] = groupByPlatform(members, [subtotal({ pnlUsd: null, totalAccounts: 3 })]);
  assert.equal(group.pnl, null);
  assert.equal(group.pnlCoverage, null);
});

test('flags describe the figure shown: an account outside the sum adds no ≈', () => {
  const members = [account({ pnl: -10, pnlLabel: 'All-Time P&L' }), account({ fxApproximate: true })];
  const [group] = groupByPlatform(members);
  // No subtotal ⇒ strict member rule: the labels disagree, so no P&L…
  assert.equal(group.pnl, null);
  // …and the ≈ of an account without a P&L does not leak onto the group.
  assert.equal(group.fxApproximate, false);
});

test('full coverage carries no coverage note', () => {
  const [group] = groupByPlatform(
    [account({ pnl: 3, pnlLabel: 'All-Time P&L' })],
    [subtotal({ pnlUsd: 3, pnlBasis: 'platform_all_time', pnlCoveredAccounts: 1, totalAccounts: 1 })],
  );
  assert.equal(group.pnlCoverage, null);
});

test('🛑 no subtotal: members are never added up — same label, possibly different windows', () => {
  const [group] = groupByPlatform([
    account({ pnl: -10, pnlLabel: 'P&L · Since Sep 1' }),
    account({ pnl: 5, pnlLabel: 'P&L · Since Sep 1' }),
  ]);
  assert.equal(group.pnl, null);
});

test('no subtotal: a single account shows its own P&L', () => {
  const [group] = groupByPlatform([account({ pnl: 7, pnlLabel: 'All-Time P&L' })]);
  assert.equal(group.pnl, 7);
  assert.equal(group.pnlLabel, 'All-Time P&L');
});

test('a longest-window subtotal (OKX / Bitget / Gate / MEXC) names its start, not a bare "P&L"', () => {
  const [group] = groupByPlatform(
    [account({ platform: 'okx', pnl: 3, pnlLabel: 'P&L · Since Apr 1' })],
    [
      subtotal({
        platform: 'okx',
        totalAccounts: 1,
        pnlUsd: 3,
        pnlBasis: 'longest_window',
        pnlCoversFrom: '2026-04-01',
        pnlCoveredAccounts: 1,
      }),
    ],
  );
  assert.match(group.pnlLabel, /^P&L · Since /);
});

test('≈ follows the accounts inside a partial subtotal, not the platform-wide flag', () => {
  const [group] = groupByPlatform(
    [account({ pnl: 3, pnlLabel: 'All-Time P&L' }), account({ fxApproximate: true })],
    [
      subtotal({
        totalAccounts: 2,
        pnlUsd: 3,
        pnlBasis: 'platform_all_time',
        pnlCoveredAccounts: 1,
        fxApproximate: true,
      }),
    ],
  );
  assert.equal(group.fxApproximate, false);
});
