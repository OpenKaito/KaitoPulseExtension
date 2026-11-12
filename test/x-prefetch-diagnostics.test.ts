import assert from 'node:assert/strict';
import test from 'node:test';

import {
  environmentTag,
  formatPrefetchDiagnostics,
  prefetchOperationsFor,
} from '../src/verify/x-graphql-prefetch-diagnostics.ts';
import { redactFailureMessage } from '../src/shared/verifier-url.ts';

test('a prefetch that never got credentials says so', () => {
  assert.equal(
    formatPrefetchDiagnostics({
      accountOverviewDailyQuery: { auth: false, tid: false, fired: 0, skip: 'no_auth_after_wait' },
    }),
    'prefetch=accountOverviewDailyQuery{auth=0 tid=0 fired=0 skip=no_auth_after_wait}',
  );
});

test('a fired prefetch reports query id source, status and the X error', () => {
  assert.equal(
    formatPrefetchDiagnostics({
      accountOverviewDailyQuery: {
        auth: true,
        tid: true,
        csrf: true,
        qid: 'pinned',
        bundles: 0,
        results: [{ status: 403, at: 1, xerr: 'Authorization: Denied by access control: "<script>"' }],
      },
    }),
    'prefetch=accountOverviewDailyQuery{auth=1 tid=1 ct0=1 qid=pinned bundles=0 fired=1 status=403 xerr=Authorization: Denied by access control: "<script>"}',
  );
});

test('response wire size is reported when the server sent Content-Length', () => {
  assert.equal(
    formatPrefetchDiagnostics({
      accountOverviewDailyQuery: {
        auth: true,
        tid: true,
        fired: 1,
        results: [{ status: 200, at: 1, bytes: 91500 }],
      },
    }),
    'prefetch=accountOverviewDailyQuery{auth=1 tid=1 fired=1 status=200 bytes=91500}',
  );
});

test('missing or malformed snapshots produce nothing', () => {
  assert.equal(formatPrefetchDiagnostics(undefined), undefined);
  assert.equal(formatPrefetchDiagnostics('x'), undefined);
  assert.equal(formatPrefetchDiagnostics({}), undefined);
});

test('environment tag distinguishes mobile android chrome from desktop', () => {
  assert.equal(
    environmentTag(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
      '1.0.4',
    ),
    'env=chrome/141 android mobile=1 ext=1.0.4',
  );
  assert.equal(
    environmentTag(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
      '1.0.4',
    ),
    'env=edge/141 mac mobile=0 ext=1.0.4',
  );
});

test('the snapshot keeps characters redaction relies on, so a later redaction pass still sees them', () => {
  const line = formatPrefetchDiagnostics({
    Viewer: {
      auth: true,
      tid: true,
      results: [{ status: 200, at: 1, xerr: 'mail alice@example.com auth_token=abc123' }],
    },
  });
  assert.ok(line?.includes('alice@example.com'));
  assert.ok(line?.includes('auth_token=abc123'));
});

test('control characters and the field delimiters are neutralised', () => {
  const line = formatPrefetchDiagnostics({
    Viewer: { auth: true, tid: true, fired: 1, results: [{ status: 200, at: 1, xerr: 'a\nb}c|d,e' }] },
  });
  assert.equal(line, 'prefetch=Viewer{auth=1 tid=1 fired=1 status=200 xerr=a b c d e}');
});

test('entries and responses recorded before this proof started are left out', () => {
  const snapshot = {
    Viewer: { auth: true, tid: true, fired: 1, at: 1_000, results: [{ status: 200, at: 1_000 }] },
    accountOverviewDailyQuery: {
      auth: true,
      tid: true,
      at: 6_000,
      results: [
        { status: 200, at: 2_000 },
        { status: 403, at: 5_000, xerr: 'Denied' },
        { status: 'network_error', at: 6_000 },
      ],
    },
  };
  assert.equal(
    formatPrefetchDiagnostics(snapshot, 4_000),
    'prefetch=accountOverviewDailyQuery{auth=1 tid=1 fired=2 status=403 xerr=Denied status=network_error}',
  );
  assert.equal(formatPrefetchDiagnostics(snapshot, 9_000), undefined);
});

test('a page-tampered snapshot cannot make the formatter throw', () => {
  const hostile = {
    qid: [1],
    results: [null, 7, { status: { valueOf: 1 }, at: 1, xerr: Symbol('x') }],
  };
  assert.equal(
    formatPrefetchDiagnostics({ accountOverviewDailyQuery: hostile }),
    'prefetch=accountOverviewDailyQuery{qid= fired=1 status= xerr=}',
  );
  assert.equal(
    formatPrefetchDiagnostics({ accountOverviewDailyQuery: { results: 'nope' } }),
    'prefetch=accountOverviewDailyQuery{fired=0}',
  );
});

test('a pending request counts as fired for this proof, an earlier proof does not', () => {
  assert.equal(
    formatPrefetchDiagnostics(
      {
        accountOverviewDailyQuery: {
          auth: true,
          tid: true,
          skip: 'no_auth_after_wait',
          at: 5_000,
          results: [
            { status: 200, at: 1_000 },
            { status: 'pending', at: 5_000 },
          ],
        },
      },
      4_000,
    ),
    'prefetch=accountOverviewDailyQuery{auth=1 tid=1 fired=1 skip=no_auth_after_wait status=pending}',
  );
});

test('an axis entry without auth fields renders only what it recorded', () => {
  assert.equal(
    formatPrefetchDiagnostics(
      { axisMe: { at: 5_000, results: [{ status: 401, at: 5_000 }] } },
      4_000,
    ),
    'prefetch=axisMe{fired=1 status=401}',
  );
  assert.equal(
    formatPrefetchDiagnostics({ axisMe: { at: 5_000, skip: 'waiting_for_arm', results: [] } }, 4_000),
    'prefetch=axisMe{fired=0 skip=waiting_for_arm}',
  );
});

test('only the operations a verifier owns are rendered', () => {
  const snapshot = {
    accountOverviewDailyQuery: { at: 5_000, results: [{ status: 200, at: 5_000 }] },
    injected: { at: 5_000, results: [{ status: 200, at: 5_000, xerr: 'customer 1234' }] },
  };
  assert.equal(
    formatPrefetchDiagnostics(snapshot, 4_000, prefetchOperationsFor('x_analytics_overview')),
    'prefetch=accountOverviewDailyQuery{fired=1 status=200}',
  );
  assert.equal(formatPrefetchDiagnostics(snapshot, 4_000, prefetchOperationsFor('polymarket_wallet')), undefined);
});

test('the bearer source is reported', () => {
  assert.equal(
    formatPrefetchDiagnostics(
      { accountOverviewDailyQuery: { auth: false, tid: false, bearer: 'public', at: 5_000, results: [{ status: 200, at: 5_000 }] } },
      4_000,
    ),
    'prefetch=accountOverviewDailyQuery{auth=0 tid=0 bearer=public fired=1 status=200}',
  );
});

test('the rendered diagnostics survive failure-message redaction', () => {
  const line = formatPrefetchDiagnostics({
    accountOverviewDailyQuery: { auth: true, tid: true, csrf: true, qid: 'pinned', bearer: 'page', bundles: 1, at: 5, results: [{ status: 200, at: 5 }] },
  });
  assert.equal(redactFailureMessage(line ?? ''), line);
});
