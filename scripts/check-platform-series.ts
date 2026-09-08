import { hoverCardToPopoverData } from '@/signal/social-card-map';
import type {
  HoverCardPlatformTotal,
  HoverCardResult,
  HoverCardWallet,
  HyperliquidBlock,
  PolymarketBlock,
} from '@/shared/social-card';

const results: string[] = [];
function check(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  results.push(
    `${a === e ? 'PASS' : 'FAIL'}  ${label}${a === e ? '' : `\n        got ${a}\n        want ${e}`}`,
  );
}

const DAY = 86_400_000;

const FIRST = '0x7be1000000000000000000000000000000cc80d8';
const SECOND = '0x2b1d000000000000000000000000000000ff2e0d';

const PICKED_WALLET_PNL = 1_375_579.88;
const PLATFORM_PNL = -1_613_603.37;

function hl(wallet: string): HyperliquidBlock {
  return {
    wallet,
    accountValue: 21_526_456.2,
    pnlAllTime: PICKED_WALLET_PNL,
    uPnl: 161_384.23,
    positionsCount: 3,
    positions: [],

    pnlSeries: {
      '1D': [],
      '1W': [],
      '1M': [],
      ALL: [
        { t: DAY, v: 400_000 },
        { t: 2 * DAY, v: PICKED_WALLET_PNL },
      ],
    },
  };
}

function pm(): PolymarketBlock {
  return {
    profile: { name: 'Pranjal' },
    positionsValue: 9_113.22,
    pnlAllTime: 14_023.09,
    predictions: 590,
    positionsCount: 2,
    markets: [],
    pnlSeries: {
      '1d': [],
      '1w': [],
      '1m': [],
      '1y': [],
      ytd: [],
      all: [{ t: DAY, v: 12_000 } as unknown as { t: number; p: number }],
    },
  };
}

function wallet(over: Partial<HoverCardWallet>): HoverCardWallet {
  return { platform: 'hyperliquid', address: null, scraped: false, ...over };
}

function hlTotal(over: Partial<HoverCardPlatformTotal>): HoverCardPlatformTotal {
  return {
    platform: 'hyperliquid',
    valueLabel: 'Account Value',
    totalAccounts: 4,
    publicAccounts: 2,
    valueUsd: 21_526_456.2,
    pnlUsd: PLATFORM_PNL,
    ...over,
  };
}

function pmTotal(over: Partial<HoverCardPlatformTotal>): HoverCardPlatformTotal {
  return {
    platform: 'polymarket',
    valueLabel: 'Positions Value',
    totalAccounts: 2,
    publicAccounts: 2,
    valueUsd: 9_113.22,
    pnlUsd: 14_023.09,
    ...over,
  };
}

const card = (over: Partial<HoverCardResult>): HoverCardResult => ({
  twitterId: '1',
  smartFollowers: null,
  hyperliquid: null,
  polymarket: null,
  meta: { partial: false, sources: { sf: 'ok', hyperliquid: 'ok', polymarket: 'ok' } },
  ...over,
});

const PLATFORM_SERIES = {
  '1D': [{ t: DAY, v: -1_000 }],
  '1W': [],
  '1M': [],
  ALL: [
    { t: DAY, v: -2_990_000 },
    { t: 2 * DAY, v: PLATFORM_PNL },
  ],
};

const TWO_WALLETS = [
  wallet({ address: FIRST, ordinal: 1, addressRevealed: true, hasPositions: true }),
  wallet({ address: SECOND, ordinal: 2, addressRevealed: true }),
];

/**
 * The platform card's chart used to read `HyperliquidBlock.pnlSeries` — the ONE
 * wallet the backend picked by size. On a multi-wallet owner that drew wallet A
 * under a heading and a P&L figure that count every wallet: the measured pair was
 * +1,375,579.88 against -1,613,603.37, opposite signs two orders apart. The chart
 * now comes from `tradingPlatformTotals[].pnlSeries`, which is the same set of
 * addresses as `pnlUsd`.
 */
const served = hoverCardToPopoverData(
  card({
    hyperliquid: hl(FIRST),
    tradingWallets: TWO_WALLETS,
    tradingPlatformTotals: [hlTotal({ pnlSeries: PLATFORM_SERIES })],
  }),
).hyperliquid;

check(
  'the platform chart plots the platform series, not the picked wallet’s',
  served?.charts.ALL.map((p) => p.v),
  [-2_990_000, PLATFORM_PNL],
);
check(
  'its last ALL point is the same figure printed above it',
  [served?.charts.ALL.at(-1)?.label, served?.profitLoss],
  ['-$1,613,603.37', '-$1,613,603.37'],
);
check('every window keeps its toggle, empty ones included', Object.keys(served?.charts ?? {}), [
  '1D',
  '1W',
  '1M',
  'ALL',
]);
check(
  'a window with no points stays empty rather than borrowing another',
  served?.charts['1W'],
  [],
);

/**
 * Without the field there is no platform-scoped curve, so a multi-wallet card
 * draws none: this is the guard that kept the mismatched chart off the card
 * before the backend served one, and it has to survive a backend that predates
 * the field.
 */
const absent = hoverCardToPopoverData(
  card({
    hyperliquid: hl(FIRST),
    tradingWallets: TWO_WALLETS,
    tradingPlatformTotals: [hlTotal({})],
  }),
).hyperliquid;

check('an older backend draws no chart on a multi-wallet card', absent?.charts, {});
check('… while the figures above it are unaffected', absent?.profitLoss, '-$1,613,603.37');

const empty = hoverCardToPopoverData(
  card({
    hyperliquid: hl(FIRST),
    tradingWallets: TWO_WALLETS,
    tradingPlatformTotals: [hlTotal({ pnlSeries: { '1D': [], '1W': [], '1M': [], ALL: [] } })],
  }),
).hyperliquid;

check('a series with no points in any window draws no chart', empty?.charts, {});

/**
 * One wallet, and the block is that wallet: block and platform cover the same
 * addresses, so the block's curve is still the right one to fall back to when
 * ClickHouse has no points but the platform API did.
 */
const single = hoverCardToPopoverData(
  card({
    hyperliquid: hl(FIRST),
    tradingWallets: [
      wallet({ address: FIRST, ordinal: 1, addressRevealed: true, hasPositions: true }),
    ],
    tradingPlatformTotals: [hlTotal({ totalAccounts: 1, publicAccounts: 1 })],
  }),
).hyperliquid;

check(
  'a single-wallet card still falls back to that wallet’s own curve',
  single?.charts.ALL.map((p) => p.v),
  [400_000, PICKED_WALLET_PNL],
);

const singleServed = hoverCardToPopoverData(
  card({
    hyperliquid: hl(FIRST),
    tradingWallets: [
      wallet({ address: FIRST, ordinal: 1, addressRevealed: true, hasPositions: true }),
    ],
    tradingPlatformTotals: [
      hlTotal({ totalAccounts: 1, publicAccounts: 1, pnlSeries: PLATFORM_SERIES }),
    ],
  }),
).hyperliquid;

check(
  'and the served platform series wins over it wherever both exist',
  singleServed?.charts.ALL.map((p) => p.v),
  [-2_990_000, PLATFORM_PNL],
);

/**
 * Polymarket's windows travel lowercase on the wire and are shown under the same
 * uppercase toggles as Hyperliquid's. The points themselves arrive as `{t, v}`
 * for both platforms — the BFF renames Polymarket's `p` before it leaves.
 */
const pmServed = hoverCardToPopoverData(
  card({
    polymarket: pm(),
    tradingWallets: [
      wallet({ platform: 'polymarket', address: FIRST, ordinal: 1, addressRevealed: true }),
      wallet({ platform: 'polymarket', address: SECOND, ordinal: 2, addressRevealed: true }),
    ],
    tradingPlatformTotals: [
      pmTotal({
        pnlSeries: {
          '1d': [{ t: DAY, v: 300 }],
          '1w': [],
          '1m': [],
          all: [{ t: DAY, v: 14_023.09 }],
        },
      }),
    ],
  }),
).polymarket;

check(
  'Polymarket windows are read by their wire keys',
  pmServed?.charts['1D'].map((p) => p.v),
  [300],
);
check('… and exposed under the display labels', Object.keys(pmServed?.charts ?? {}), [
  '1D',
  '1W',
  '1M',
  'ALL',
]);
check(
  '… with the ALL window matching the platform figure',
  pmServed?.charts.ALL.at(-1)?.label,
  '$14,023.09',
);

console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
if (results.some((r) => r.startsWith('FAIL'))) process.exitCode = 1;
