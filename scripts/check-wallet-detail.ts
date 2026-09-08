import type { WalletDetailPages, WalletDetailResult } from '@/shared/wallet-detail';
import { mergeWalletDetailPage, walletDetailOutcomeFor } from '@/shared/wallet-detail';

const results: string[] = [];
function check(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  results.push(
    `${a === e ? 'PASS' : 'FAIL'}  ${label}${a === e ? '' : `\n        got ${a}\n        want ${e}`}`,
  );
}

check('404 is a refusal, not an outage', walletDetailOutcomeFor(404), 'withheld');
check('503 is retryable', walletDetailOutcomeFor(503), 'unavailable');
check('500 is retryable', walletDetailOutcomeFor(500), 'unavailable');
check('429 is retryable', walletDetailOutcomeFor(429), 'unavailable');
check('network error is retryable', walletDetailOutcomeFor(0), 'unavailable');

function page(over: Partial<WalletDetailResult>): WalletDetailResult {
  return {
    platform: 'hyperliquid',
    address: '0xaaaa000000000000000000000000000000001111',
    total: 4,
    offset: 0,
    limit: 2,
    hasMore: true,
    batchId: 77,
    summary: { accountValue: 100, uPnl: 1, pnlAllTime: 2, positionsCount: 4 },
    ...over,
  };
}

const first = mergeWalletDetailPage(null, page({}), ['BTC', 'ETH']);
check('first page -> merged', first.status, 'merged');
check('first page rows', first.status === 'merged' ? first.pages : null, {
  batchId: 77,
  rows: ['BTC', 'ETH'],
  total: 4,
  hasMore: true,
});

const held = first.status === 'merged' ? first.pages : (null as WalletDetailPages<string> | null);

const second = mergeWalletDetailPage(held, page({ offset: 2, hasMore: false }), ['SOL', 'HYPE']);
check('next page appends', second.status === 'merged' ? second.pages : null, {
  batchId: 77,
  rows: ['BTC', 'ETH', 'SOL', 'HYPE'],
  total: 4,
  hasMore: false,
});

check(
  'a new crawler batch restarts instead of stitching',
  mergeWalletDetailPage(held, page({ offset: 2, batchId: 78 }), ['SOL', 'HYPE']).status,
  'restart',
);

check(
  'a gap in the offsets restarts too',
  mergeWalletDetailPage(held, page({ offset: 3 }), ['HYPE']).status,
  'restart',
);

const refetched = mergeWalletDetailPage(held, page({ total: 3, hasMore: false }), ['BTC', 'DOGE']);
check(
  'offset 0 replaces what was held rather than doubling it',
  refetched.status === 'merged' ? refetched.pages : null,
  { batchId: 77, rows: ['BTC', 'DOGE'], total: 3, hasMore: false },
);

const shrunk = mergeWalletDetailPage(held, page({ offset: 1, total: 2, hasMore: false }), ['DOGE']);
check(
  'a re-read of a page already held overwrites its tail',
  shrunk.status === 'merged' ? shrunk.pages : null,
  { batchId: 77, rows: ['BTC', 'DOGE'], total: 2, hasMore: false },
);

const empty = mergeWalletDetailPage(null, page({ total: 0, hasMore: false }), []);
check(
  'covered but flat -> an empty page, not a restart',
  empty.status === 'merged' ? empty.pages : null,
  { batchId: 77, rows: [], total: 0, hasMore: false },
);

console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
if (results.some((r) => r.startsWith('FAIL'))) process.exitCode = 1;
