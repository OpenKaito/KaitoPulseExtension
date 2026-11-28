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

const { toPostRow, mergeFeedStreams, formatPostDate, fitTagCount, directionTone } = await import(
  '../src/signal/activity-sidebar/rows.ts'
);

type Post = Parameters<typeof toPostRow>[0];
type Trade = NonNullable<Parameters<typeof mergeFeedStreams>[0]>['items'][number];

function post(over: Partial<Post> = {}): Post {
  return {
    eventId: '11',
    source: 'x',
    actor: { twitterId: '1', handle: 'fx_stargazer', avatarUrl: '', name: 'Stargazer' },
    postedAt: '2026-11-04T06:00:00Z',
    url: 'https://x.com/fx_stargazer/status/1234567890123456789',
    title: null,
    summary: 'Entered a BTC long at ~79.8k',
    tags: [
      { assetId: 'crypto:BTC', asset: '$BTC', direction: 'bullish', claimType: 'forward_view', text: 'Bullish on $BTC' },
    ],
    badge: { kind: 'track_record', text: 'Top $BTC caller · 10/13 right' },
    ...over,
  };
}

function trade(eventId: string, eventTime: string): Trade {
  return {
    eventId,
    platform: 'hyperliquid',
    actor: { twitterId: '2', handle: 'fx_alex', avatarUrl: '', name: 'Alex Fixture' },
    market: { id: 'BTC', label: 'BTC', icon: '' },
    side: 'buy',
    price: '68000',
    quantity: '0.25',
    notional: '17000',
    eventTime,
  };
}

const tags = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    assetId: `a${i}`,
    asset: `$A${i}`,
    direction: 'bullish',
    claimType: 'forward_view',
    text: `Bullish on $A${i}`,
  }));

test('X call: in-app tweet link, relative time, one tag keeps its badge', () => {
  const row = toPostRow(post());
  assert.equal(row.href, '/fx_stargazer/status/1234567890123456789');
  assert.equal(row.external, false);
  assert.equal(row.datedTime, false);
  assert.deepEqual(row.tags, [{ text: 'Bullish on $BTC', tone: 'up' }]);
  assert.equal(row.badge, 'Top $BTC caller · 10/13 right');
  assert.equal(row.title, null);
});

test('call direction colours tags like trades: bullish up, bearish down, else neutral', () => {
  assert.equal(directionTone('bullish'), 'up');
  assert.equal(directionTone('Bearish'), 'down');
  assert.equal(directionTone('neutral'), 'neutral');
  assert.equal(directionTone(undefined), 'neutral');
  const row = toPostRow(
    post({
      tags: [
        { assetId: 'crypto:BTC', asset: '$BTC', direction: 'bullish', claimType: 'forward_view', text: 'Bullish on $BTC' },
        { assetId: 'crypto:ETH', asset: '$ETH', direction: 'bearish', claimType: 'forward_view', text: 'Bearish on $ETH' },
      ],
    }),
  );
  assert.deepEqual(
    row.tags,
    [
      { text: 'Bullish on $BTC', tone: 'up' },
      { text: 'Bearish on $ETH', tone: 'down' },
    ],
  );
});

test('several tags: all kept for the one-line fit, and no badge', () => {
  const row = toPostRow(post({ tags: tags(5) }));
  assert.equal(row.tags.length, 5);
  assert.equal(row.badge, null);
});

test('fitTagCount: every tag that fits on the line, +N only when some do not', () => {
  assert.equal(fitTagCount([128, 133], 28, 8, 299), 2);
  assert.equal(fitTagCount([128, 133, 106], 28, 8, 299), 1);
  assert.equal(fitTagCount([100, 105, 60], 28, 8, 299), 3);
  assert.equal(fitTagCount([100, 105, 120, 110], 28, 8, 299), 2);
  assert.equal(fitTagCount([420], 28, 8, 299), 1);
  assert.equal(fitTagCount([420, 90], 28, 8, 299), 1);
  assert.equal(fitTagCount([], 28, 8, 299), 0);
});

test('Substack: article link in a new tab, title, dated', () => {
  const row = toPostRow(
    post({
      source: 'substack',
      url: 'https://cws.substack.com/p/review',
      title: 'CWS Market Review',
      badge: null,
    }),
  );
  assert.equal(row.href, 'https://cws.substack.com/p/review');
  assert.equal(row.external, true);
  assert.equal(row.datedTime, true);
  assert.equal(row.title, 'CWS Market Review');
  assert.equal(formatPostDate('2026-10-28T12:00:00Z'), 'Oct 28');
});

test('X call without a handle falls back to the absolute link', () => {
  const row = toPostRow(post({ actor: { twitterId: '1', handle: '', avatarUrl: '' } }));
  assert.equal(row.href, 'https://x.com/fx_stargazer/status/1234567890123456789');
  assert.equal(row.external, true);
});

test('merge interleaves by time when neither stream has more', () => {
  const { rows, loadMore } = mergeFeedStreams(
    { items: [trade('t1', '2026-11-04T07:00:00Z'), trade('t2', '2026-11-04T05:00:00Z')], nextBefore: null },
    { items: [post({ postedAt: '2026-11-04T06:00:00Z' })], nextBefore: null },
  );
  assert.deepEqual(
    rows.map((r) => r.key),
    ['t1', 'post:11', 't2'],
  );
  assert.equal(loadMore, null);
});

test('merge hides items past the newer page edge and asks for that stream', () => {
  const { rows, loadMore } = mergeFeedStreams(
    { items: [trade('t1', '2026-11-04T07:00:00Z'), trade('t2', '2026-11-01T00:00:00Z')], nextBefore: 'c1' },
    {
      items: [post({ eventId: 'p1', postedAt: '2026-11-04T06:30:00Z' }), post({ eventId: 'p2', postedAt: '2026-11-04T06:00:00Z' })],
      nextBefore: 'c2',
    },
  );
  assert.deepEqual(
    rows.map((r) => r.key),
    ['t1', 'post:p1', 'post:p2'],
  );
  assert.equal(loadMore, 'posts');
});

test('a missing stream (failed or not deployed) leaves the other as is', () => {
  const { rows, loadMore } = mergeFeedStreams(
    { items: [trade('t1', '2026-11-04T07:00:00Z')], nextBefore: 'c1' },
    null,
  );
  assert.deepEqual(
    rows.map((r) => r.key),
    ['t1'],
  );
  assert.equal(loadMore, 'trades');
});

// Distinct authors so the 2-per-author cap never trims a boosted run.
const callPost = (eventId: string, postedAt: string, asset: string, handle: string) =>
  post({
    eventId,
    postedAt,
    actor: { twitterId: eventId, handle, avatarUrl: '', name: handle },
    tags: [
      { assetId: `crypto:${asset}`, asset: `$${asset}`, direction: 'bullish', claimType: 'forward_view', text: `Bullish on $${asset}` },
    ],
  });

test('calls on the viewer’s watched tickers float to the top; time order holds within each group', () => {
  const { rows } = mergeFeedStreams(
    { items: [trade('t1', '2026-11-04T07:00:00Z')], nextBefore: null },
    {
      items: [
        callPost('p-nvda', '2026-11-04T08:00:00Z', 'NVDA', 'sg_nvda'), // newest, not watched
        callPost('p-eth', '2026-11-04T06:00:00Z', 'ETH', 'sg_eth'), // watched
        callPost('p-btc', '2026-11-04T05:00:00Z', 'BTC', 'sg_btc'), // watched, oldest
      ],
      nextBefore: null,
    },
    // No `$` here — exercises the normalisation against the posts' `$BTC`/`$ETH`.
    new Set(['BTC', 'ETH']),
  );
  assert.deepEqual(
    rows.map((r) => r.key),
    ['post:p-eth', 'post:p-btc', 'post:p-nvda', 't1'],
  );
});

test('boosting never drops a watched call via the author cap (cap runs before the boost)', () => {
  // Alice's 3 BTC calls interleave in time with Bob's 2 ETH, so none is a
  // consecutive run — all 5 survive the 2-per-author cap. Boosting BTC must keep
  // all three of Alice's and float them up, not cluster them into a run the cap trims.
  const { rows } = mergeFeedStreams(null, {
    items: [
      callPost('a1', '2026-11-04T09:00:00Z', 'BTC', 'alice'),
      callPost('b1', '2026-11-04T08:00:00Z', 'ETH', 'bob'),
      callPost('a2', '2026-11-04T07:00:00Z', 'BTC', 'alice'),
      callPost('b2', '2026-11-04T06:00:00Z', 'ETH', 'bob'),
      callPost('a3', '2026-11-04T05:00:00Z', 'BTC', 'alice'),
    ],
    nextBefore: null,
  }, new Set(['BTC']));
  assert.deepEqual(
    rows.map((r) => r.key),
    ['post:a1', 'post:a2', 'post:a3', 'post:b1', 'post:b2'],
  );
});

test('an empty watch set leaves the feed in plain reverse-chronological order', () => {
  const { rows } = mergeFeedStreams(
    { items: [trade('t1', '2026-11-04T07:00:00Z')], nextBefore: null },
    { items: [callPost('p-btc', '2026-11-04T05:00:00Z', 'BTC', 'sg_btc')], nextBefore: null },
    new Set(),
  );
  assert.deepEqual(
    rows.map((r) => r.key),
    ['t1', 'post:p-btc'],
  );
});
