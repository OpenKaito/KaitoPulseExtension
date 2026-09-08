import { hoverCardToPopoverData } from '@/signal/social-card-map';
import type {
  HoverCardResult,
  HyperliquidBlock,
  HyperliquidMarginMode,
  HyperliquidPosition,
} from '@/shared/social-card';

const results: string[] = [];
function check(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  results.push(
    `${a === e ? 'PASS' : 'FAIL'}  ${label}${a === e ? '' : `\n        got ${a}\n        want ${e}`}`,
  );
}

function position(leverage: number, marginMode?: HyperliquidMarginMode): HyperliquidPosition {
  return {
    coin: 'BTC',
    side: 'long',
    leverage,
    ...(marginMode === undefined ? {} : { marginMode }),
    entryPx: 1,
    marginUsed: 1,
    liquidationPx: 1,
    positionValue: 1,
    markPx: 1,
    funding: 0,
    unrealizedPnl: 0,
  };
}

function block(positions: HyperliquidPosition[]): HyperliquidBlock {
  return {
    wallet: '0xaaaa000000000000000000000000000000001111',
    accountValue: 100,
    pnlAllTime: 0,
    uPnl: 0,
    positionsCount: positions.length,
    positions,
    pnlSeries: { '1D': [], '1W': [], '1M': [], ALL: [] },
  };
}

function leverageLabels(positions: HyperliquidPosition[]): string[] {
  const card: HoverCardResult = {
    twitterId: '1',
    smartFollowers: null,
    hyperliquid: block(positions),
    polymarket: null,
    meta: { partial: false, sources: { sf: 'ok', hyperliquid: 'ok', polymarket: 'ok' } },
  };
  return (hoverCardToPopoverData(card).hyperliquid?.accounts[0].positions ?? []).map(
    (p) => p.leverage,
  );
}

check('cross -> parenthesised', leverageLabels([position(15, 'cross')]), ['15X (Cross)']);
check('isolated -> parenthesised', leverageLabels([position(15, 'isolated')]), ['15X (Isolated)']);
check('empty string -> bare leverage', leverageLabels([position(15, '')]), ['15X']);
check('absent -> bare leverage', leverageLabels([position(15)]), ['15X']);
check(
  'unknown value -> bare leverage, not passed through',
  leverageLabels([position(15, 'portfolio' as HyperliquidMarginMode)]),
  ['15X'],
);
check(
  'per-position, not per-account',
  leverageLabels([position(10, 'cross'), position(5, 'isolated'), position(3, '')]),
  ['10X (Cross)', '5X (Isolated)', '3X'],
);

console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
if (results.some((r) => r.startsWith('FAIL'))) process.exitCode = 1;
