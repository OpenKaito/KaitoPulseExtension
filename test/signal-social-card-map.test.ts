import assert from 'node:assert/strict';

process.env.TZ = 'UTC';
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

const { hoverCardToPopoverData, mapAccountPlatform } = await import(
  '../src/signal/social-card-map.ts'
);
const { boundPlatforms, popoverLayout } = await import('../src/signal/platforms.ts');
const { count, countOrDash, usd, usdSigned, dataAsOfLabel } = await import(
  '../src/signal/shared/format.ts'
);

type Total = Parameters<typeof mapAccountPlatform>[2];
type Wallet = NonNullable<Parameters<typeof mapAccountPlatform>[1]>[number];

const total = (over: Partial<NonNullable<Total>> & { platform: string }): NonNullable<Total> => ({
  valueLabel: 'Account Value',
  totalAccounts: 1,
  publicAccounts: 1,
  valueUsd: null,
  pnlUsd: null,
  ...over,
});

const chip = (over: Partial<Wallet> & { platform: string }): Wallet => ({
  address: null,
  scraped: false,
  ...over,
});

test('format helpers print the dash for missing figures', () => {
  assert.equal(usd(null), '-');
  assert.equal(usd(undefined), '-');
  assert.equal(usd(Number.NaN), '-');
  assert.equal(usd(-1234.5), '-$1,234.50');
  assert.equal(usdSigned(null), '-');
  assert.equal(usdSigned(12), '+$12.00');
  assert.equal(count(null), '-');
  assert.equal(count(1200), '1,200');
  assert.equal(countOrDash(undefined), '-');
});

test('dataAsOfLabel reads ISO strings and epoch seconds, ignores junk', () => {
  assert.equal(dataAsOfLabel('2026-09-28T12:00:00Z'), 'as of Sep 28, 12:00');
  assert.equal(dataAsOfLabel(1_790_000_000), 'as of Sep 21, 14:13');
  assert.equal(dataAsOfLabel(null), undefined);
  assert.equal(dataAsOfLabel('not a date'), undefined);
});

test('an exchange account is named by the masked id KEBS serves, the ordinal only as a fallback', () => {
  const block = mapAccountPlatform(
    'binance',
    [chip({ platform: 'binance', ordinal: 1, maskedAccountId: '1263****2333' })],
    total({ platform: 'binance', valueUsd: 7.84 }),
  );
  assert.ok(block);
  assert.equal(block.heading, '1263****2333');
  assert.equal(block.accounts[0].label, '1263****2333');
});

test('a new platform total maps to a block, missing values as dash', () => {
  const block = mapAccountPlatform(
    'binance',
    [chip({ platform: 'binance', ordinal: 1 }), chip({ platform: 'okx', ordinal: 1 })],
    total({ platform: 'binance', valueUsd: 1500, upnlUsd: -20, positionsCount: 3 }),
  );
  assert.ok(block);
  assert.equal(block.heading, 'Account 1');
  assert.equal(block.aggregate, false);
  assert.equal(block.accountValue, '$1,500.00');
  assert.equal(block.profitLoss, '-');
  assert.equal(block.upnl, '-$20.00');
  assert.equal(block.upnlNegative, true);
  assert.equal(block.positionsCount, 3);
  assert.deepEqual(block.accounts, [
    { label: 'Account 1', address: null, anonymous: true, hasPositions: false },
  ]);
  assert.deepEqual(block.charts, {});
  assert.equal(block.dataAsOf, undefined);
});

test('several accounts aggregate; snapshot platforms carry their as-of date', () => {
  const block = mapAccountPlatform(
    'okx',
    [chip({ platform: 'okx', ordinal: 1 }), chip({ platform: 'okx', ordinal: 2 })],
    total({ platform: 'okx', totalAccounts: 2, pnlUsd: 99, dataAsOf: '2026-09-27T12:00:00Z' }),
  );
  assert.ok(block);
  assert.equal(block.heading, '2 OKX Accounts');
  assert.equal(block.aggregate, true);
  assert.equal(block.profitLoss, '$99.00');
  assert.equal(block.dataAsOf, 'as of Sep 27, 12:00');
});

test('a crawler platform prints no as-of line; a served source overrides the default', () => {
  const lighter = mapAccountPlatform(
    'lighter',
    [chip({ platform: 'lighter', address: '0xabcdef0123456789' })],
    total({ platform: 'lighter', dataAsOf: '2026-09-27T12:00:00Z' }),
  );
  assert.equal(lighter?.dataAsOf, undefined);
  assert.equal(lighter?.heading, '0xabcd…6789');
  const attested = mapAccountPlatform(
    'lighter',
    undefined,
    total({ platform: 'lighter', source: 'attestation', dataAsOf: '2026-09-27T12:00:00Z' }),
  );
  assert.equal(attested?.dataAsOf, 'as of Sep 27, 12:00');
});

test('pnl series reads either key case and drops empty windows', () => {
  const block = mapAccountPlatform(
    'variational',
    undefined,
    total({
      platform: 'variational',
      pnlSeries: {
        '1d': [
          { t: 1, v: 1 },
          { t: 2, v: 2 },
        ],
        ALL: [{ t: 1, v: 5 }],
        '1W': [],
      },
    }),
  );
  assert.deepEqual(Object.keys(block?.charts ?? {}), ['1D', 'ALL']);
  assert.equal(block?.charts['1D']?.[1]?.label, '$2.00');
});

test('no total and no chips means no block', () => {
  assert.equal(mapAccountPlatform('bybit', [], undefined), undefined);
});

const baseResult = {
  twitterId: '1',
  smartFollowers: null,
  hyperliquid: null,
  polymarket: null,
  meta: { partial: false, sources: { sf: 'ok', hyperliquid: 'miss', polymarket: 'miss' } },
} as const;

test("pump.fun's third cell is its lifetime buy volume from the platform total", () => {
  const data = hoverCardToPopoverData({
    ...baseResult,
    tradingPlatformTotals: [
      total({ platform: 'pumpfun', totalAccounts: 3, positionsCount: 6530, buyVolume: 152384.18 }),
    ],
  });
  const pump = data.pumpfun;
  assert.ok(pump);
  assert.equal(pump.countLabel, 'Buy Volume');
  assert.equal(pump.trades, usd(152384.18));
});

test('pump.fun without a served buy volume shows a dash, not $0', () => {
  const data = hoverCardToPopoverData({
    ...baseResult,
    tradingPlatformTotals: [total({ platform: 'pumpfun', totalAccounts: 3, positionsCount: 6530 })],
  });
  assert.equal(data.pumpfun?.trades, '-');
});

test('every published pump.fun chip carries its address, so it can load its own positions', () => {
  const data = hoverCardToPopoverData({
    ...baseResult,
    tradingWallets: [
      chip({ platform: 'pumpfun', address: '4Be9CvAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAha7t', scraped: true }),
      chip({ platform: 'pumpfun', address: 'DaumenBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', scraped: true }),
    ],
    tradingPlatformTotals: [total({ platform: 'pumpfun', totalAccounts: 2, positionsCount: 9522 })],
  });
  const pump = data.pumpfun;
  assert.ok(pump);
  assert.deepEqual(
    pump.accounts.map((a) => a.address),
    ['4Be9CvAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAha7t', 'DaumenBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'],
  );
});

test("fomo's third cell is the platform's position count", () => {
  const data = hoverCardToPopoverData({
    ...baseResult,
    tradingPlatformTotals: [total({ platform: 'fomo', positionsCount: 394 })],
  });
  assert.equal(data.fomo?.countLabel, 'Positions');
  assert.equal(data.fomo?.trades, count(394));
});

test('variational points and inline positions reach the card', () => {
  const block = mapAccountPlatform(
    'variational',
    [
      chip({
        platform: 'variational',
        address: null,
        maskedAccountId: 'a1b2****c9d0',
        hasPositions: true,
        positions: [
          {
            symbol: 'BTC-PERP',
            side: 'short',
            size: 2.4,
            entryPrice: 64200,
            markPrice: 67850,
            positionValue: 162840,
            unrealizedPnl: -8760,
            liquidationPrice: null,
            leverage: null,
            margin: null,
          },
        ],
      }),
    ],
    total({ platform: 'variational', points: 1000 }),
  );
  assert.equal(block?.points, count(1000));
  assert.equal(
    mapAccountPlatform('variational', [], total({ platform: 'variational', points: 0.041739 }))?.points,
    '0.04',
  );
  const position = block?.accounts[0]?.positions?.[0];
  assert.equal(position?.side, 'Short');
  assert.equal(position?.entry, usd(64200));
  assert.equal(position?.mark, usd(67850));
  assert.equal(position?.size, usd(162840));
  assert.equal(position?.pnl, usdSigned(-8760));
  assert.equal(position?.leverage, '-');
});

test('variational without points or positions keeps both absent', () => {
  const block = mapAccountPlatform(
    'variational',
    [chip({ platform: 'variational', address: null, maskedAccountId: 'a1b2****c9d0' })],
    total({ platform: 'variational' }),
  );
  assert.equal(block?.points, undefined);
  assert.equal(block?.accounts[0]?.positions, undefined);
});

test('hover card data carries every bound platform and its category', () => {
  const data = hoverCardToPopoverData({
    ...baseResult,
    tradingPlatformTotals: [
      total({ platform: 'polymarket', valueUsd: 10 }),
      total({ platform: 'binance', valueUsd: 1 }),
      total({ platform: 'bybit', valueUsd: 2, category: 'cex' }),
      total({ platform: 'lighter', valueUsd: 3, category: 'cex' }),
      total({ platform: 'okx', valueUsd: 4 }),
    ],
  });
  const bound = boundPlatforms(data);
  assert.deepEqual(bound, ['polymarket', 'binance', 'okx', 'bybit', 'lighter']);
  const layout = popoverLayout(bound, data.platformCategories);
  assert.deepEqual(
    layout.kind === 'tabs' ? layout.tabs.map((t) => [t.category, t.platforms]) : null,
    [
      ['cex', ['lighter', 'binance', 'okx', 'bybit']],
      ['prediction', ['polymarket']],
    ],
  );
});

test('polymarket series from the platform total reaches the summary charts', () => {
  const data = hoverCardToPopoverData({
    ...baseResult,
    tradingPlatformTotals: [
      total({
        platform: 'polymarket',
        totalAccounts: 2,
        pnlUsd: 5,
        pnlSeries: {
          '1d': [
            { t: 1, v: 1 },
            { t: 2, v: 3 },
          ],
          all: [{ t: 1, v: 4 }],
        },
      }),
    ],
  });
  assert.deepEqual(Object.keys(data.polymarket?.charts ?? {}), ['1D', '1W', '1M', 'ALL']);
  assert.equal(data.polymarket?.charts['1D']?.length, 2);
});

test('polymarket platform series is read in either key case', () => {
  const data = hoverCardToPopoverData({
    ...baseResult,
    tradingPlatformTotals: [
      total({
        platform: 'polymarket',
        totalAccounts: 2,
        pnlUsd: 5,
        pnlSeries: { '1D': [{ t: 1, v: 1 }], ALL: [{ t: 1, v: 4 }, { t: 2, v: 5 }] },
      }),
    ],
  });
  assert.equal(data.polymarket?.charts['1D']?.length, 1);
  assert.equal(data.polymarket?.charts.ALL?.length, 2);
});

const { hasChartPoints, servedPeriod } = await import('../src/signal/shared/chart-periods.ts');

test('a window with no points is never the one a chart opens on', () => {
  const point = { t: 1, v: 1, label: '$1.00', time: 'Sep 28' };
  const charts = { '1D': [point], '1W': [], '1M': [], ALL: [] };
  assert.equal(servedPeriod(charts, 'ALL'), '1D');
  assert.equal(servedPeriod({ ...charts, '1W': [point] }, 'ALL'), '1W');
  assert.equal(servedPeriod({ ALL: [point] }, 'ALL'), 'ALL');
});

test('a curve that is 0 in every window, or empty, is not drawn', () => {
  const at = (v: number) => ({ t: 1, v, label: `$${v}`, time: 'Oct 20' });
  assert.equal(hasChartPoints({ '1D': [], '1W': [], '1M': [], ALL: [] }), false);
  assert.equal(hasChartPoints({ '1D': [at(0), at(0), at(0)], '1W': [at(0)], '1M': [], ALL: [] }), false);
  assert.equal(hasChartPoints({ '1D': [at(0)], ALL: [at(0), at(-1.49)] }), true);
});

test('the platform total can cover more accounts than are listed as chips', () => {
  const block = mapAccountPlatform(
    'bybit',
    [chip({ platform: 'bybit', ordinal: 1 })],
    total({ platform: 'bybit', totalAccounts: 3, valueUsd: 10 }),
  );
  assert.ok(block);
  assert.equal(block.aggregate, true);
  assert.equal(block.heading, '3 Bybit Accounts');
});

const { platformMetricsByPlatform } = await import('../src/signal/social-card-map.ts');

test('referral and points land on each platform block; a 0 is kept, withheld figures are left out', () => {
  assert.deepEqual(
    platformMetricsByPlatform({
      referral: {
        referredUsers: 131,
        referredVolume: null,
        platforms: [
          { platform: 'hyperliquid', referredUsers: 128, referredVolume: 1000 },
          { platform: 'polymarket', referredUsers: 0, referredVolume: null },
          { platform: 'okx', referredUsers: null, referredVolume: null },
          { platform: 'kraken', referredUsers: 9, referredVolume: null },
        ],
      },
      points: [{ platform: 'variational', points: 12940 }],
    }),
    {
      hyperliquid: { referredTraders: '128', referredVolume: '$1,000' },
      polymarket: { referredTraders: '0' },
      variational: { points: '12,940' },
    },
  );
  assert.equal(platformMetricsByPlatform({}), undefined);
  const data = hoverCardToPopoverData({
    ...baseResult,
    referral: { referredUsers: 2, referredVolume: null, platforms: [{ platform: 'lighter', referredUsers: 2, referredVolume: null }] },
  });
  assert.deepEqual(data.platformMetrics, { lighter: { referredTraders: '2' } });
});

const { tokenRow } = await import('../src/signal/social-card-map.ts');

test('a holding without a cost basis or unrealized PnL shows neither, not a 0.00% change', () => {
  const row = tokenRow({
    tokenAddress: 'Mint',
    symbol: 'USDC',
    amount: 12.5,
    value: 12.5,
    costBasis: null,
    currentMarketCap: 0,
    unrealizedPnl: null,
  });
  assert.equal(row.changePct, '');
  assert.equal(row.pnl, '-');
  assert.equal(row.changeNegative, false);
});

test('a holding with a basis keeps its change', () => {
  const row = tokenRow({
    tokenAddress: 'Mint',
    symbol: 'BIG',
    amount: 1,
    value: 150,
    costBasis: 100,
    currentMarketCap: 0,
    unrealizedPnl: 50,
  });
  assert.equal(row.changePct, '50.00%');
  assert.equal(row.changeNegative, false);
});

const { lighterPositionRow } = await import('../src/signal/shared/format.ts');

test('a Lighter position maps onto the perp row, deriving mark from value / size', () => {
  const row = lighterPositionRow({
    symbol: 'ETH',
    accountIndex: 1,
    side: 'short',
    size: 2,
    entryPx: 2500,
    positionValue: 5200,
    unrealizedPnl: -200,
    realizedPnl: null,
    liquidationPx: null,
    leverage: 5,
    marginMode: 'cross',
    allocatedMargin: null,
  });
  assert.equal(row.pair, 'ETH');
  assert.equal(row.side, 'Short');
  assert.equal(row.mark, usd(2600));
  assert.equal(row.size, usd(5200));
  assert.equal(row.pnl, usdSigned(-200));
  assert.equal(row.liqPrice, 'N/A');
  assert.equal(row.margin, '-');
  assert.equal(row.funding, '-');
});

test('a Variational chip carries its tier label and the position funding', () => {
  const block = mapAccountPlatform(
    'variational',
    [
      chip({
        platform: 'variational',
        ordinal: 1,
        maskedAccountId: '1211****2da7',
        tier: { name: 'Gold', pointsRate: 1.02 },
        positions: [
          {
            symbol: 'P-DRAM-USDC',
            side: 'long',
            size: 0.008,
            entryPrice: 62.6,
            markPrice: 57.5,
            positionValue: 0.46,
            unrealizedPnl: -0.04,
            liquidationPrice: 41.8,
            leverage: 10,
            margin: 0.046,
            funding: -0.00696,
          },
        ],
      }),
    ],
    total({ platform: 'variational', valueUsd: 0.11 }),
  );
  assert.ok(block);
  assert.equal(block.accounts[0].tier, 'Gold · 1.02× points');
  assert.equal(block.accounts[0].positions?.[0].funding, '-$0.01');
  assert.equal(block.accounts[0].positions?.[0].margin, '$0.05');
});

const { attestedPositionRow, leverageLabel } = await import('../src/signal/shared/format.ts');

test('stacked position lines: margin · leverage, quantity in the base asset, entry → mark', () => {
  const row = attestedPositionRow({
    symbol: 'P-BTC-USDC',
    side: 'long',
    size: 2.4,
    entryPrice: 64200,
    markPrice: 67850,
    positionValue: 162840,
    unrealizedPnl: 8760,
    liquidationPrice: null,
    leverage: 12,
    margin: 38200,
  });
  assert.equal(row.quantity, '2.4 BTC');
  assert.equal(row.value, '$162.8K');
  assert.equal(row.detail, 'Margin $38.2K · 12×');
  assert.equal(row.entryMark, 'Avg entry $64,200 → $67,850');
  assert.equal(row.leverage, '12×');
});

test('an option reads in contracts with the premium paid', () => {
  const row = attestedPositionRow({
    symbol: 'ETH-27JUN27-4000-C',
    side: 'long',
    size: 12,
    entryPrice: 186,
    markPrice: 241,
    positionValue: 2892,
    unrealizedPnl: 660,
    liquidationPrice: null,
    leverage: null,
    margin: null,
    instrumentType: 'option',
  });
  assert.equal(row.quantity, '12 contracts');
  assert.equal(row.detail, 'Premium paid $2,232');
  assert.equal(row.entryMark, 'Avg entry $186 → $241');
});

test('a Lighter position carries its margin mode', () => {
  const row = lighterPositionRow({
    symbol: 'ETH',
    accountIndex: 1,
    side: 'short',
    size: 40,
    entryPx: 3420,
    positionValue: 131600,
    unrealizedPnl: 5200,
    realizedPnl: null,
    liquidationPx: null,
    leverage: 8,
    marginMode: 'cross',
    allocatedMargin: 16400,
  });
  assert.equal(row.quantity, '40 ETH');
  assert.equal(row.detail, 'Margin $16.4K · 8× cross');
  assert.equal(leverageLabel(8, 'cross'), '8× (Cross)');
});

test('referral totals map to the two header tiles, each with the platforms that served it', () => {
  const data = hoverCardToPopoverData({
    ...baseResult,
    referral: {
      referredUsers: 94,
      referredVolume: 2955,
      platforms: [
        { platform: 'hyperliquid', referredUsers: 46, referredVolume: 2955 },
        { platform: 'polymarket', referredUsers: 48, referredVolume: null },
      ],
    },
  });
  assert.deepEqual(data.referralTotals, {
    referredUsers: { text: count(94), platforms: ['hyperliquid', 'polymarket'] },
    referredVolume: { text: usd(2955, 0), platforms: ['hyperliquid'] },
  });
});

test('a withheld referral total is left out, not shown as 0; a served 0 is kept', () => {
  const hidden = hoverCardToPopoverData({
    ...baseResult,
    referral: { referredUsers: 0, referredVolume: null, platforms: [] },
  });
  assert.deepEqual(hidden.referralTotals, {
    referredUsers: { text: count(0), platforms: [] },
  });
  assert.equal(hoverCardToPopoverData({ ...baseResult }).referralTotals, undefined);
});

test('the All-Time P&L total prints as the main site does: no sign on zero, cents under a dollar', () => {
  const text = (value: number, fxApproximate = false) =>
    hoverCardToPopoverData({
      ...baseResult,
      tradingPlatforms: ['hyperliquid'],
      allTimePnl: { value, fxApproximate, currency: 'USD', coveredAccounts: 1, totalAccounts: 1 },
    } as never).totals?.allTimePnl?.text;
  assert.equal(text(0), '$0');
  assert.equal(text(0.33), '+$0.33');
  assert.equal(text(-1.49), '-$1');
  assert.equal(text(-25068.77), '-$25,069');
  assert.equal(text(670717.97, true), '≈+$670,718');
});

test('totals marks follow the display order, not the served value order, as on the main site', () => {
  const data = hoverCardToPopoverData({
    ...baseResult,
    tradingPlatforms: ['pumpfun', 'lighter', 'hyperliquid', 'polymarket'],
    accountValue: { bucket: '10M+', currency: 'USD', coveredAccounts: 1, totalAccounts: 1, platforms: null },
    allTimePnl: { value: -1, fxApproximate: false, currency: 'USD', coveredAccounts: 1, totalAccounts: 1 },
    referral: {
      referredUsers: 1,
      referredVolume: 2,
      platforms: [
        { platform: 'variational', referredUsers: 1, referredVolume: 1 },
        { platform: 'hyperliquid', referredUsers: 0, referredVolume: 1 },
      ],
    },
  } as never);
  const order = ['hyperliquid', 'polymarket', 'pumpfun', 'lighter'];
  assert.deepEqual(data.totals?.accountValue?.platforms, order);
  assert.deepEqual(data.totals?.allTimePnl?.platforms, order);
  assert.deepEqual(data.referralTotals?.referredVolume?.platforms, ['hyperliquid', 'variational']);
});

const { isGeneratedAddressName } = await import('../src/signal/social-card-map.ts');

test("Polymarket's generated username (address + timestamp) is not a name", () => {
  assert.equal(isGeneratedAddressName('0xC962f94367fcfcd5D663954512dD775981D6966e-1787019743805'), true);
  assert.equal(isGeneratedAddressName('0xc962f94367fcfcd5d663954512dd775981d6966e'), true);
  assert.equal(isGeneratedAddressName('pplabu'), false);
  assert.equal(isGeneratedAddressName('0xBuilder'), false);
  assert.equal(isGeneratedAddressName(null), false);
});
