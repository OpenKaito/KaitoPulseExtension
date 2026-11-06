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

const { toActivityRows, appendPage, mergeRefresh, formatApproxUsd, formatQuantity, isHyperliquidSpot } = await import(
  '../src/popup/format/activity.ts'
);

type Item = Parameters<typeof toActivityRows>[0][number];

function item(over: Partial<Item> & { at: string }): Item {
  const { at, ...rest } = over;
  return {
    eventId: `e-${at}-${rest.side ?? 'buy'}`,
    platform: 'hyperliquid',
    actor: { twitterId: '1', handle: 'fx_trader', avatarUrl: '' },
    market: { id: 'BTC', label: 'BTC', icon: '' },
    side: 'buy',
    price: '68000',
    quantity: '0.25',
    notional: '17000',
    eventTime: at,
    ...rest,
  };
}

test('a perp fill reads as verb, quantity and coin, with an approximate dollar amount', () => {
  const [row] = toActivityRows([item({ at: '2026-10-24T08:00:00Z' })]);
  assert.equal(row.action, 'Bought · 0.25 BTC');
  assert.equal(row.amount, '~$17K');
  assert.equal(row.handle, 'fx_trader');
});

test('a spot fill carries the Spot tag; a perp does not', () => {
  const [spot] = toActivityRows([
    item({ at: '2026-10-24T08:00:00Z', market: { id: '@107', label: 'HYPE', icon: '' }, quantity: '120', notional: '3200' }),
  ]);
  assert.equal(spot.action, 'Bought · 120 HYPE · Spot');
  assert.equal(isHyperliquidSpot('PURR/USDC'), true);
  assert.equal(isHyperliquidSpot('xyz:SOXL'), false);
});

test('a Polymarket fill names the market', () => {
  const [row] = toActivityRows([
    item({
      at: '2026-10-24T08:00:00Z',
      platform: 'polymarket',
      side: 'sell',
      market: { id: '1119', label: 'Will BTC close above $80k this month?', icon: '' },
      notional: '860',
    }),
  ]);
  assert.equal(row.action, 'Sold · “Will BTC close above $80k this month?”');
  assert.equal(row.amount, '~$860');
});

test('a Polymarket fill names the outcome before the market, whatever the outcome is', () => {
  const rows = toActivityRows([
    item({
      at: '2026-10-24T08:00:00Z',
      platform: 'polymarket',
      market: { id: '1', label: 'Will the Fed hike in October?', icon: '', outcome: 'Yes' },
    }),
    item({
      at: '2026-10-24T07:00:00Z',
      platform: 'polymarket',
      side: 'sell',
      market: { id: '2', label: 'LoL: Gen.G vs T1', icon: '', outcome: 'Gen.G' },
    }),
  ]);
  assert.deepEqual(
    rows.map((row) => row.action),
    ['Bought Yes · “Will the Fed hike in October?”', 'Sold Gen.G · “LoL: Gen.G vs T1”'],
  );
});

test('an unknown or blank outcome falls back to the plain verb', () => {
  const rows = toActivityRows([
    item({ at: '2026-10-24T08:00:00Z', platform: 'polymarket', market: { id: '1', label: 'M', icon: '', outcome: '' } }),
    item({ at: '2026-10-24T07:00:00Z', platform: 'polymarket', market: { id: '2', label: 'M', icon: '', outcome: '  ' } }),
  ]);
  assert.deepEqual(
    rows.map((row) => row.action),
    ['Bought · “M”', 'Bought · “M”'],
  );
});

test('a Polymarket row without a catalogue title names the venue, not the token id', () => {
  const tokenId = '1901778500174516627832438227543251859434593490595260277658609414720530282241';
  const rows = toActivityRows([
    item({ at: '2026-10-24T08:00:00Z', platform: 'polymarket', market: { id: tokenId, label: tokenId, icon: '', outcome: 'Up' } }),
    item({ at: '2026-10-24T07:00:00Z', platform: 'polymarket', side: 'sell', market: { id: tokenId, label: '', icon: '' } }),
  ]);
  assert.deepEqual(
    rows.map((row) => row.action),
    ['Bought Up · a Polymarket market', 'Sold · a Polymarket market'],
  );
});

test('Hyperliquid ignores an outcome', () => {
  const [row] = toActivityRows([
    item({ at: '2026-10-24T08:00:00Z', market: { id: 'BTC', label: 'BTC', icon: '', outcome: 'Yes' }, quantity: '0.25' }),
  ]);
  assert.equal(row.action, 'Bought · 0.25 BTC');
});

test('rows map one to one in backend order — merging and the $100 floor are server-side now', () => {
  const rows = toActivityRows([
    item({ at: '2026-10-24T08:00:50Z', quantity: '0.1', notional: '60' }),
    item({ at: '2026-10-24T08:00:10Z', quantity: '0.15', notional: '10200' }),
  ]);
  assert.deepEqual(
    rows.map((r) => [r.action, r.amount]),
    [
      ['Bought · 0.1 BTC', '~$60'],
      ['Bought · 0.15 BTC', '~$10.2K'],
    ],
  );
});

test('load more appends older rows and skips ones already shown', () => {
  const a = item({ at: '2026-10-24T08:00:30Z' });
  const b = item({ at: '2026-10-24T08:00:20Z' });
  const c = item({ at: '2026-10-24T08:00:10Z' });
  assert.deepEqual(
    appendPage([a, b], [b, c]).map((x) => x.eventId),
    [a.eventId, b.eventId, c.eventId],
  );
});

test('a refresh puts the new first page on top and keeps rows loaded with load more', () => {
  const fresh = item({ at: '2026-10-24T09:00:00Z' });
  const a = item({ at: '2026-10-24T08:00:30Z' });
  const older = item({ at: '2026-10-24T07:00:00Z' });
  assert.deepEqual(
    mergeRefresh([a, older], [fresh, a]).map((x) => x.eventId),
    [fresh.eventId, a.eventId, older.eventId],
  );
});

test('quantities and amounts format for the row', () => {
  assert.equal(formatQuantity(120), '120');
  assert.equal(formatQuantity(0.123456), '0.1235');
  assert.equal(formatQuantity(12345.6), '12,346');
  assert.equal(formatApproxUsd(3210), '~$3.2K');
  assert.equal(formatApproxUsd(2_400_000), '~$2.4M');
});
