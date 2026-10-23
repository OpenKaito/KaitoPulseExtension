import { hoverCardToPopoverData } from '@/signal/social-card-map';
import { normalizeHyperliquidWire, normalizePolymarketWire } from '@/shared/social-card';
import type { HoverCardResult, HyperliquidBlock, PolymarketBlock } from '@/shared/social-card';

const DAY = 86_400_000;

function hl(
  wallet: string,
  value: number,
  pnl: number,
  upnl: number,
  positions: number,
  series: Array<[number, number]>,
): HyperliquidBlock {
  return {
    wallet,
    accountValue: value,
    pnlAllTime: pnl,
    uPnl: upnl,
    positionsCount: positions,
    positions: [],
    pnlSeries: {
      '1D': [],
      '1W': [],
      '1M': [],
      ALL: series.map(([t, v]) => ({ t, v })),
    },
  };
}

function pm(
  name: string,
  value: number,
  pnl: number,
  predictions: number,
  positions: number,
): PolymarketBlock {
  return {
    profile: { name },
    positionsValue: value,
    pnlAllTime: pnl,
    predictions,
    positionsCount: positions,
    markets: [],
    pnlSeries: { '1d': [], '1w': [], '1m': [], '1y': [], ytd: [], all: [] },
  };
}

const results: string[] = [];
function check(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  results.push(
    `${a === e ? 'PASS' : 'FAIL'}  ${label}${a === e ? '' : `\n        got ${a}\n        want ${e}`}`,
  );
}

const card = (over: Partial<HoverCardResult>): HoverCardResult => ({
  twitterId: '1',
  smartFollowers: null,
  hyperliquid: null,
  polymarket: null,
  meta: { partial: false, sources: { sf: 'ok', hyperliquid: 'ok', polymarket: 'ok' } },
  ...over,
});

const single = hoverCardToPopoverData(
  card({
    hyperliquid: hl('0xaaaa000000000000000000000000000000001111', 100, -5, -1, 2, [
      [DAY, 10],
      [2 * DAY, 20],
    ]),
  }),
);
check('singular wire -> 1 account', single.hyperliquid?.accounts.length, 1);
check('singular aggregate == the account', single.hyperliquid?.accountValue, '$100.00');
check(
  'singular series untouched',
  single.hyperliquid?.charts.ALL.map((p) => p.v),
  [10, 20],
);
check('singular addressShort', single.hyperliquid?.accounts[0].addressShort, '0xaaaa…1111');

const arr = hoverCardToPopoverData(
  card({
    hyperliquid: [
      hl('0xaaaa000000000000000000000000000000001111', 400_000, -10_000, -20, 6, [
        [DAY, 100],
        [3 * DAY, 300],
      ]),
      hl('0xbbbb000000000000000000000000000000002222', 55_426.97, -4_023.09, -3.09, 0, [
        [2 * DAY, 50],
      ]),
    ],
  }),
);
check('array -> 2 accounts', arr.hyperliquid?.accounts.length, 2);
check('summed account value', arr.hyperliquid?.accountValue, '$455,426.97');
check('summed pnl', arr.hyperliquid?.profitLoss, '-$14,023.09');
check('summed upnl', arr.hyperliquid?.upnl, '-$23.09');
check('summed positions count', arr.hyperliquid?.positionsTotal, 6);

check('aligned series timestamps', arr.hyperliquid?.charts.ALL.length, 3);
check(
  'aligned series values',
  arr.hyperliquid?.charts.ALL.map((p) => p.v),
  [100, 150, 350],
);
check('compareValues uses the aggregate', arr.compareValues?.hyperliquid, 455_426.97);
check(
  'chips mark only wallets with positions',
  [
    (arr.hyperliquid?.accounts[0].positionsTotal ?? 0) > 0,
    (arr.hyperliquid?.accounts[1].positionsTotal ?? 0) > 0,
  ],
  [true, false],
);

const group = hoverCardToPopoverData(
  card({
    hyperliquid: {
      accounts: [
        hl('0xaaaa000000000000000000000000000000001111', 1, 1, 1, 1, [[DAY, 1]]),
        hl('0xbbbb000000000000000000000000000000002222', 1, 1, 1, 1, [[DAY, 1]]),
      ],
      totals: { accountValue: 999, pnlAllTime: -7, uPnl: 3, positionsCount: 42 },
      pnlSeries: { '1D': [], '1W': [], '1M': [], ALL: [{ t: DAY, v: 777 }] },
    },
  }),
);
check('backend totals win', group.hyperliquid?.accountValue, '$999.00');
check('backend positionsCount wins', group.hyperliquid?.positionsTotal, 42);
check(
  'backend series wins',
  group.hyperliquid?.charts.ALL.map((p) => p.v),
  [777],
);

const pmCard = hoverCardToPopoverData(
  card({ polymarket: [pm('Marlowe', 9_000, 14_000, 500, 3), pm('Alt', 113.22, 23.09, 90, 0)] }),
);
check('pm -> 2 accounts', pmCard.polymarket?.accounts.length, 2);
check('pm summed positions value', pmCard.polymarket?.positionsValue, '$9,113.22');
check('pm summed pnl', pmCard.polymarket?.profitLoss, '$14,023.09');
check('pm summed predictions', pmCard.polymarket?.predictions, '590');
check('pm primary name is accounts[0]', pmCard.polymarket?.name, 'Marlowe');

check('null wire -> null group', normalizeHyperliquidWire(null), null);
check('empty accounts -> null group', normalizeHyperliquidWire({ accounts: [] }), null);
check('empty array -> null group', normalizePolymarketWire([]), null);
const none = hoverCardToPopoverData(card({}));
check('no platform -> undefined card', none.hyperliquid, undefined);
check('no platform -> undefined compareValue', none.compareValues?.hyperliquid, undefined);

console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
if (results.some((r) => r.startsWith('FAIL'))) process.exitCode = 1;
