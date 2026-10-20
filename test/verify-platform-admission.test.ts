import assert from 'node:assert/strict';
import test from 'node:test';

import type { ExtensionVerifier } from '../src/shared/contracts.ts';
import { buildTasks, tasksInCategory } from '../src/verify/catalog.ts';

const NOW = 1_700_000_000_000;

const PERP_PLATFORMS = ['hyperliquid', 'variational', 'lighter'] as const;

const verifier = (over: Partial<ExtensionVerifier> & { id: string; platform: string }) => ({
  name: over.id,
  guide: { url: 'https://example.com/', message: 'Sign in.' },
  ...over,
});

test('the Hyperliquid referral verifier is admitted; Lighter and Variational referrals ride their trading card', () => {
  const tasks = buildTasks(
    [
      verifier({ id: 'hyperliquid_referral', platform: 'hyperliquid', category: 'referral' }),
      verifier({ id: 'lighter_referral', platform: 'lighter', category: 'referral' }),
      verifier({ id: 'variational_referral', platform: 'variational', category: 'referral' }),
    ],
    {},
    NOW,
  );
  const hl = tasks.find((t) => t.id === 'hyperliquid_referral');
  assert.ok(hl?.verifier, 'the hyperliquid card must be bound to its live verifier');
  assert.equal(hl.category, 'referral');
  assert.deepEqual(
    tasksInCategory(tasks, 'referral').map((t) => t.id),
    ['hyperliquid_referral'],
  );
});

test("existing platforms keep today's behaviour exactly", () => {
  const verifiers: ExtensionVerifier[] = [
    verifier({ id: 'polymarket_wallet', platform: 'polymarket' }),
    verifier({ id: 'fomo_ownership', platform: 'fomo' }),
    verifier({ id: 'pumpfun_account', platform: 'pumpfun' }),
    verifier({ id: 'x_analytics_overview', platform: 'x' }),
    verifier({ id: 'axis_account', platform: 'axis' }),
  ];
  const tasks = buildTasks(verifiers, {}, NOW);

  for (const v of verifiers) {
    assert.ok(
      tasks.some((t) => t.id === v.id),
      `${v.id} must still be admitted`,
    );
  }
  assert.equal(tasks.find((t) => t.id === 'x_analytics_overview')?.category, 'social');
  for (const id of ['polymarket_wallet', 'fomo_ownership', 'pumpfun_account', 'axis_account']) {
    assert.equal(tasks.find((t) => t.id === id)?.category, 'trading', `${id} stays in Trading`);
  }
});

test('the perp platforms render no static placeholder card', () => {
  const tasks = buildTasks([], {}, NOW);
  for (const platform of [...PERP_PLATFORMS, 'fomo']) {
    assert.equal(
      tasks.filter((t) => t.meta.platform === platform || t.id === `platform:${platform}`).length,
      0,
      `${platform} is live-only and must not render a placeholder`,
    );
  }
});

test('the CEXes are not verifiable, and leave no placeholder', () => {
  const locked: Array<[string, string]> = [
    ['binance_asset_history', 'binance'],
    ['okx_referral', 'okx'],
    ['bybit_asset_history', 'bybit'],
    ['kraken_asset_history', 'kraken'],
    ['bitget_referral', 'bitget'],
    ['gate_asset_history', 'gate'],
    ['mexc_referral', 'mexc'],
  ];
  const tasks = buildTasks(
    locked.map(([id, platform]) => verifier({ id, platform })),
    {},
    NOW,
  );
  for (const [, platform] of locked) {
    assert.equal(tasks.filter((t) => t.meta.platform === platform).length, 0, platform);
  }
});

test('admission never widens beyond the allowlist', () => {
  const tasks = buildTasks(
    [verifier({ id: 'coinbase_referral', platform: 'coinbase', category: 'referral' })],
    {},
    NOW,
  );
  assert.equal(tasks.filter((t) => t.meta.platform === 'coinbase').length, 0);
});
