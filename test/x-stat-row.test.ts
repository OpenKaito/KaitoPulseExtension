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

const { buildXStatRow } = await import('../src/signal/profile/x-stat-row.ts');

type AnyData = Parameters<typeof buildXStatRow>[0];

const stat = (label: string, value: string, extra: Record<string, unknown> = {}) => ({
  label,
  value,
  ...extra,
});

const TOTALS = { accountValue: { tier: 1, label: '1+', platforms: [] }, platforms: [] } as never;

const base = (over: Partial<AnyData>): AnyData =>
  ({
    smartFollowers: [],
    topSmartFollowers: [],
    smartFollowerTotal: stat('Total Smart followers', '12,456'),
    smartFollowerCategories: [stat('Crypto', '880', { rank: '#1' })],
    verifiedFollowers: stat('Verified followers', '880', { verifiedBadge: true }),
    activeFollowers: stat('Active followers', '1,200'),
    homeTimelineImpressions: stat('Home Timeline Impressions', '2,456'),
    ...over,
  }) as AnyData;

test('both: socials row is Total · Verified · Home Timeline Impressions, trading drops to its own row', () => {
  const row = buildXStatRow(base({ profileCardMode: 'both', totals: TOTALS }));
  assert.equal(row.tradingOwnRow, true);
  assert.deepEqual(
    row.stats.map((s) => s.label),
    ['Verified followers', 'Home Timeline Impressions'],
  );
  assert.ok(row.totals, 'trading totals present (rendered on row two)');
  // Active is not a cell in `both`; it stays behind the caret.
  assert.ok(row.panel.some((s) => s.label === 'Active followers'));
  assert.ok(row.panel.some((s) => s.label === 'Crypto'));
});

test('both: a missing Home Timeline Impressions keeps its slot as a dash', () => {
  const row = buildXStatRow(base({ profileCardMode: 'both', totals: TOTALS, homeTimelineImpressions: undefined }));
  assert.deepEqual(
    row.stats.map((s) => s.label),
    ['Verified followers', 'Home Timeline Impressions'],
  );
  assert.equal(row.stats[1].value, '-');
});

test('x_only: single row Total · Verified · Active · Home Timeline Impressions, no trading', () => {
  const row = buildXStatRow(base({ profileCardMode: 'x_only' }));
  assert.equal(row.tradingOwnRow, false);
  assert.deepEqual(
    row.stats.map((s) => s.label),
    ['Verified followers', 'Active followers', 'Home Timeline Impressions'],
  );
  assert.equal(row.totals, undefined);
});

test('trading_only: unchanged — top segment then inline trading cells, no HTI', () => {
  const row = buildXStatRow(
    base({
      profileCardMode: 'trading_only',
      totals: TOTALS,
      topSegment: stat('Crypto', '880', { rank: '#1' }),
    }),
  );
  assert.equal(row.tradingOwnRow, false);
  assert.ok(!row.stats.some((s) => s.label === 'Home Timeline Impressions'));
  assert.ok(row.totals);
});
