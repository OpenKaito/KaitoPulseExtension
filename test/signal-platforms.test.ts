import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SIGNAL_PROTOCOLS,
  boundPlatforms,
  isSignalProtocol,
  isSnapshotPlatform,
  platformCategory,
  popoverLayout,
} from '../src/signal/platforms.ts';

test('registry order is the profile tab order', () => {
  assert.deepEqual(SIGNAL_PROTOCOLS, [
    'hyperliquid',
    'polymarket',
    'fomo',
    'pumpfun',
    'binance',
    'okx',
    'bybit',
    'variational',
    'lighter',
  ]);
});

test('boundPlatforms keeps registry order and drops missing platforms', () => {
  assert.deepEqual(boundPlatforms({ lighter: {}, hyperliquid: {}, okx: undefined, binance: {} }), [
    'hyperliquid',
    'binance',
    'lighter',
  ]);
});

test('four or fewer platforms stay flat (design 2026-09-30)', () => {
  assert.deepEqual(popoverLayout(['hyperliquid', 'polymarket', 'binance', 'okx']), {
    kind: 'flat',
    platforms: ['hyperliquid', 'polymarket', 'binance', 'okx'],
  });
});

test('more than four platforms group under category tabs, empty categories hidden', () => {
  const layout = popoverLayout(['hyperliquid', 'binance', 'okx', 'variational', 'lighter']);
  assert.equal(layout.kind, 'tabs');
  assert.deepEqual(
    layout.kind === 'tabs' ? layout.tabs.map((t) => [t.label, t.platforms]) : [],
    [
      ['Perps', ['hyperliquid', 'lighter', 'variational']],
      ['CEX', ['binance', 'okx']],
    ],
  );
});

test('a served category overrides the local map; unknown ones fall back', () => {
  assert.equal(platformCategory('lighter', 'cex'), 'cex');
  assert.equal(platformCategory('lighter', 'brokerage'), 'perps');
  assert.equal(platformCategory('fomo', undefined), 'memecoin');
  const layout = popoverLayout(['hyperliquid', 'polymarket', 'fomo', 'lighter', 'pumpfun'], {
    lighter: 'cex',
  });
  assert.deepEqual(
    layout.kind === 'tabs' ? layout.tabs.map((t) => t.category) : [],
    ['perps', 'cex', 'prediction', 'memecoin'],
  );
});

test('snapshot sources: served source wins, otherwise the registry default', () => {
  assert.equal(isSnapshotPlatform('binance'), true);
  assert.equal(isSnapshotPlatform('lighter'), false);
  assert.equal(isSnapshotPlatform('lighter', 'attestation'), true);
  assert.equal(isSnapshotPlatform('okx', 'crawler'), false);
});

test('isSignalProtocol accepts the nine platforms only', () => {
  assert.ok(isSignalProtocol('bybit'));
  assert.ok(!isSignalProtocol('kraken'));
  assert.ok(!isSignalProtocol('toString'));
});

test('profile tabs: X first, then bound platforms in the fixed order', async () => {
  const { profileTabs } = await import('../src/signal/platforms.ts');
  assert.deepEqual(
    profileTabs({ lighter: {}, okx: {}, polymarket: {}, fomo: undefined, hyperliquid: {} }),
    ['x', 'hyperliquid', 'polymarket', 'okx', 'lighter'],
  );
  assert.deepEqual(profileTabs({}), ['x']);
});

test('perps tab lists Hyperliquid, Lighter, Variational — the design order, not the profile strip order', () => {
  const layout = popoverLayout(['hyperliquid', 'binance', 'variational', 'lighter', 'okx']);
  const perps = layout.kind === 'tabs' ? layout.tabs.find((t) => t.category === 'perps') : undefined;
  assert.deepEqual(perps?.platforms, ['hyperliquid', 'lighter', 'variational']);
});

test('a platform with only referral or points public still gets its block and tab', async () => {
  const data = {
    hyperliquid: { heading: '1 Hyperliquid Account' },
    platformMetrics: { variational: { points: '12,940' }, polymarket: { referredTraders: '0' } },
  };
  assert.deepEqual(boundPlatforms(data), ['hyperliquid', 'polymarket', 'variational']);
  const { profileTabs } = await import('../src/signal/platforms.ts');
  assert.deepEqual(profileTabs(data), ['x', 'hyperliquid', 'polymarket', 'variational']);
});
