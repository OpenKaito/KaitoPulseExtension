import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCaptureTrace,
  formatCaptureTrace,
  joinForFallback,
  targetLabel,
} from '../src/shared/capture-trace.ts';

const matches = (url: string, target: string) => new RegExp(`^${target}`).test(url);

const VARIATIONAL = [
  'https://omni\\.variational\\.io/api/points/summary(?:\\?.*)?$',
  'https://omni.variational.io/api/portfolio/timeseries\\?period=one_day&kaito_pf=1$',
  'https://omni.variational.io/api/referrals\\?limit=\\d+&offset=\\d+$',
];

test('labels keep the last two path segments of a target expression', () => {
  assert.deepEqual(VARIATIONAL.map(targetLabel), [
    'points/summary',
    'portfolio/timeseries',
    'api/referrals',
  ]);
});

test('a target nobody requested reads none, and a missing window is called out', () => {
  const trace = createCaptureTrace(VARIATIONAL, matches);
  trace.record('https://omni.variational.io/api/points/summary?kaito_pf=1', { status: 200, at: 1 });
  trace.record('https://omni.variational.io/api/points/summary', { status: 200, at: 2 });
  assert.equal(
    trace.describe(),
    'capture=0[points/summary]:200x2,1[portfolio/timeseries]:none,2[api/referrals]:none window=never',
  );
});

test('requests before the capture window are split out, statuses and errors are tallied', () => {
  const trace = createCaptureTrace(VARIATIONAL, matches);
  trace.record('https://omni.variational.io/api/points/summary', { status: 200, at: 10 });
  trace.openWindow(20);
  trace.openWindow(99);
  trace.record('https://omni.variational.io/api/points/summary?kaito_pf=1', { status: 403, at: 21 });
  trace.record('https://omni.variational.io/api/points/summary?kaito_pf=1', { status: 403, at: 22 });
  trace.record('https://omni.variational.io/api/portfolio/timeseries?period=one_day&kaito_pf=1', {
    error: 'net::ERR_BLOCKED_BY_CLIENT',
    at: 23,
  });
  assert.equal(
    trace.describe(),
    'capture=0[points/summary]:403x2(pre 200),1[portfolio/timeseries]:ERR_BLOCKED_BY_CLIENT,2[api/referrals]:none',
  );
});

test('only hits before the window still say the window never saw the target', () => {
  assert.equal(
    formatCaptureTrace([[{ status: 200, at: 1 }]], 5),
    'capture=0:none(pre 200)',
  );
});

test('the 256-char fallback keeps the diagnostics prefix and cuts the error instead', () => {
  const prefix = 'env=chrome/155 mac mobile=0 ext=1.0.4 | capture=0:none';
  const message = `00013: ${'x'.repeat(400)}`;
  const sent = joinForFallback(prefix, message, 256);
  assert.equal(sent.length, 256);
  assert.ok(sent.startsWith(`${prefix} | 00013: `));
  assert.equal(joinForFallback('', message, 256), message.slice(0, 256));
  assert.equal(joinForFallback('p'.repeat(300), message, 256), 'p'.repeat(256));
});
