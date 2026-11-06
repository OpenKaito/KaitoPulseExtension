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
});

const { toSidebarRows, outcomeTone, formatShortAgo } = await import(
  '../src/signal/activity-sidebar/rows.ts'
);

type Item = Parameters<typeof toSidebarRows>[0][number];

function item(over: Partial<Item>): Item {
  return {
    eventId: 'e1',
    platform: 'hyperliquid',
    actor: { twitterId: '1', handle: 'fx_alex', avatarUrl: '', name: 'Alex Fixture' },
    market: { id: 'BTC', label: 'BTC', icon: '' },
    side: 'buy',
    price: '68000',
    quantity: '0.25',
    notional: '17000',
    eventTime: '2026-10-27T10:00:00Z',
    ...over,
  };
}

test('HL perp: neutral tag, symbol and rounded notional', () => {
  const [row] = toSidebarRows([item({})]);
  assert.equal(row.tag, 'Bought');
  assert.equal(row.tone, 'neutral');
  assert.equal(row.subject, 'BTC · ~$17K');
  assert.equal(row.name, 'Alex Fixture');
});

test('HL spot sell is marked Spot', () => {
  const [row] = toSidebarRows([
    item({ side: 'sell', market: { id: '@107', label: 'HYPE', icon: '' }, notional: '3200' }),
  ]);
  assert.equal(row.tag, 'Sold');
  assert.equal(row.subject, 'HYPE · ~$3.2K · Spot');
});

test('PM: outcome goes in the tag, the market title is quoted', () => {
  const [row] = toSidebarRows([
    item({
      platform: 'polymarket',
      market: { id: '0xm', label: 'Will the Fed cut rates in December?', icon: '', outcome: 'Yes' },
    }),
  ]);
  assert.equal(row.tag, 'Bought Yes');
  assert.equal(row.tone, 'up');
  assert.equal(row.subject, '“Will the Fed cut rates in December?”');
});

test('PM without a catalogued title or outcome', () => {
  const [row] = toSidebarRows([
    item({ platform: 'polymarket', side: 'sell', market: { id: '0xm', label: '0xm', icon: '' } }),
  ]);
  assert.equal(row.tag, 'Sold');
  assert.equal(row.tone, 'neutral');
  assert.equal(row.subject, 'a Polymarket market');
});

test('only enumerable binary outcomes are coloured', () => {
  assert.equal(outcomeTone('Yes'), 'up');
  assert.equal(outcomeTone(' over '), 'up');
  assert.equal(outcomeTone('Down'), 'down');
  assert.equal(outcomeTone('Under'), 'down');
  assert.equal(outcomeTone('Nemiga'), 'neutral');
  assert.equal(outcomeTone(undefined), 'neutral');
});

test('missing name falls back to empty', () => {
  const [row] = toSidebarRows([item({ actor: { twitterId: '1', handle: 'h', avatarUrl: '' } })]);
  assert.equal(row.name, '');
});

test('short relative time like the X timeline', () => {
  const now = Date.parse('2026-10-27T12:00:00Z');
  assert.equal(formatShortAgo('2026-10-27T11:59:40Z', now), 'now');
  assert.equal(formatShortAgo('2026-10-27T11:58:00Z', now), '2m');
  assert.equal(formatShortAgo('2026-10-27T09:00:00Z', now), '3h');
  assert.equal(formatShortAgo('2026-10-25T12:00:00Z', now), '2d');
  assert.equal(formatShortAgo('2026-10-01T12:00:00Z', now), 'Oct 1');
  assert.equal(formatShortAgo('bad', now), '');
});

const { formatSignedUsd } = await import('../src/signal/activity-sidebar/rows.ts');

test('HL position actions become the row tag; liquidations alone are red', () => {
  const rows = toSidebarRows([
    item({ trade: { action: 'opened', position: 'long', realizedPnlUsd: null } }),
    item({ trade: { action: 'added', position: 'short', realizedPnlUsd: null } }),
    item({ side: 'sell', trade: { action: 'reduced', position: 'long', realizedPnlUsd: '3400.4' } }),
    item({ side: 'sell', trade: { action: 'closed', position: 'long', realizedPnlUsd: '9120' } }),
    item({ side: 'sell', trade: { action: 'flipped', position: 'long', toPosition: 'short', realizedPnlUsd: '-298' } }),
    item({ side: 'sell', trade: { action: 'liquidated', position: 'long', realizedPnlUsd: '-4310' } }),
  ]);
  assert.deepEqual(
    rows.map((r) => [r.tag, r.tone, r.subject]),
    [
      ['Opened long', 'neutral', 'BTC · ~$17K'],
      ['Added to short', 'neutral', 'BTC · ~$17K'],
      ['Reduced long', 'neutral', 'BTC · ~$17K · +$3,400'],
      ['Closed long', 'neutral', 'BTC · ~$17K · +$9,120'],
      ['Flipped long → short', 'neutral', 'BTC · ~$17K · −$298'],
      ['Liquidated long', 'down', 'BTC · ~$17K · −$4,310'],
    ],
  );
});

test('HL spot sale shows its PnL; no or unknown context falls back to Bought / Sold', () => {
  const [spot, none, odd] = toSidebarRows([
    item({ side: 'sell', market: { id: '@107', label: 'HYPE', icon: '' }, notional: '3200', trade: { action: 'sold', position: null, realizedPnlUsd: '8722' } }),
    item({ side: 'sell' }),
    item({ trade: { action: 'something_new', position: 'long', realizedPnlUsd: null } }),
  ]);
  assert.deepEqual([spot.tag, spot.subject], ['Sold', 'HYPE · ~$3.2K · Spot · +$8,722']);
  assert.deepEqual([none.tag, none.subject], ['Sold', 'BTC · ~$17K']);
  assert.equal(odd.tag, 'Bought');
});

test('signed USD: whole dollars from $10, cents below, compact from $100K, nothing for zero', () => {
  assert.equal(formatSignedUsd('3400.4'), '+$3,400');
  assert.equal(formatSignedUsd('-0.77'), '−$0.77');
  assert.equal(formatSignedUsd('-123456'), '−$123.5K');
  assert.equal(formatSignedUsd('0.00'), '');
  assert.equal(formatSignedUsd(null), '');
});
