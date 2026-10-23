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

const ADDRESS = '0x8def7c1b4e0a6f3d9c85a2b71f4e0d3c6a9b2dae';

function hl(wallet: string, upnl: number): HyperliquidBlock {
  return {
    wallet,
    accountValue: 100,
    pnlAllTime: 10,
    uPnl: upnl,
    positionsCount: 1,
    positions: [],
    pnlSeries: { '1D': [], '1W': [], '1M': [], ALL: [] },
  };
}

function pm(name: string, predictions: number): PolymarketBlock {
  return {
    profile: { name },
    positionsValue: 100,
    pnlAllTime: 10,
    predictions,
    positionsCount: 1,
    markets: [],
    pnlSeries: { '1d': [], '1w': [], '1m': [], '1y': [], ytd: [], all: [] },
  };
}

function wallet(over: Partial<HoverCardWallet>): HoverCardWallet {
  return { platform: 'polymarket', address: null, scraped: false, ...over };
}

function total(over: Partial<HoverCardPlatformTotal>): HoverCardPlatformTotal {
  return {
    platform: 'polymarket',
    valueLabel: 'Positions Value',
    totalAccounts: 4,
    publicAccounts: 2,
    valueUsd: 100,
    pnlUsd: 10,
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

const hlTotal = (over: Partial<HoverCardPlatformTotal>): HoverCardPlatformTotal =>
  total({ platform: 'hyperliquid', valueLabel: 'Account Value', ...over });

check(
  "platform Total UPnL comes from the platform total, not the served wallet's",
  hoverCardToPopoverData(
    card({ hyperliquid: hl(ADDRESS, 12), tradingPlatformTotals: [hlTotal({ upnlUsd: 8_650.02 })] }),
  ).hyperliquid?.upnl,
  '$8,650.02',
);

check(
  'a platform with no upnl at all renders as no-total, not $0.00',
  hoverCardToPopoverData(
    card({ hyperliquid: hl(ADDRESS, 12), tradingPlatformTotals: [hlTotal({ upnlUsd: null })] }),
  ).hyperliquid?.upnl,
  '-',
);

check(
  'an older backend without the field falls back to summing the blocks',
  hoverCardToPopoverData(
    card({ hyperliquid: hl(ADDRESS, 12), tradingPlatformTotals: [hlTotal({})] }),
  ).hyperliquid?.upnl,
  '$12.00',
);

check(
  'Predictions comes from the platform total',
  hoverCardToPopoverData(
    card({
      polymarket: pm('Marlowe', 3),
      tradingPlatformTotals: [total({ predictionsCount: 590 })],
    }),
  ).polymarket?.predictions,
  '590',
);

check(
  'no predictions figure renders as no-total, not zero predictions',
  hoverCardToPopoverData(
    card({
      polymarket: pm('Marlowe', 3),
      tradingPlatformTotals: [total({ predictionsCount: null })],
    }),
  ).polymarket?.predictions,
  '-',
);

check(
  'an older backend falls back to the summed count',
  hoverCardToPopoverData(card({ polymarket: pm('Marlowe', 3), tradingPlatformTotals: [total({})] }))
    .polymarket?.predictions,
  '3',
);

const chips = hoverCardToPopoverData(
  card({
    polymarket: pm('Marlowe', 3),
    tradingWallets: [
      wallet({ address: ADDRESS, ordinal: 1, addressRevealed: true, displayName: 'Marlowe' }),
      wallet({ ordinal: 2, addressRevealed: false, hasPositions: true, displayName: 'Quillon' }),
      wallet({
        ordinal: 5,
        addressRevealed: false,
        displayName: '',
        avatarUrl: 'https://example.test/a.png',
      }),
    ],
  }),
).polymarket?.accounts;

check('the three published wallets keep the backend order', chips?.slice(0, 3).length, 3);
check('a revealed wallet shows the name Polymarket has for it', chips?.[0].name, 'Marlowe');
check('an anonymous wallet keeps its ordinal, never the served name', chips?.[1].name, 'Address 2');
check('an anonymous wallet gets no avatar either', chips?.[2].avatarUrl, undefined);
check('the ordinal gap is preserved', chips?.[2].name, 'Address 5');

check('a Polymarket block no wallet can claim still takes a chip of its own', chips?.length, 4);

const unserved = hoverCardToPopoverData(
  card({
    polymarket: pm('Marlowe', 3),
    tradingWallets: [
      wallet({ address: ADDRESS, ordinal: 1, addressRevealed: true, displayName: 'Marlowe' }),
      wallet({
        address: '0x1111000000000000000000000000000000002222',
        ordinal: 2,
        addressRevealed: true,
        displayName: 'Quillon',
        avatarUrl: 'https://example.test/a.png',
      }),
    ],
  }),
).polymarket?.accounts;

check('a revealed wallet with no served block still shows its name', unserved?.[1].name, 'Quillon');
check('… and its avatar', unserved?.[1].avatarUrl, 'https://example.test/a.png');
check('… while its figures stay unknown rather than zero', unserved?.[1].positionsValue, '-');
check('… and it is marked as having no detail yet', unserved?.[1].hasDetail, false);

const nameless = hoverCardToPopoverData(
  card({
    polymarket: pm('Marlowe', 3),
    tradingWallets: [
      wallet({ address: ADDRESS, ordinal: 1, addressRevealed: true }),
      wallet({
        address: '0x1111000000000000000000000000000000002222',
        ordinal: 2,
        addressRevealed: true,
        displayName: '',
      }),
    ],
  }),
).polymarket?.accounts;

check(
  'a wallet Polymarket has no name for falls back to its address',
  nameless?.[1].name,
  '0x1111…2222',
);

console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
if (results.some((r) => r.startsWith('FAIL'))) process.exitCode = 1;
