import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCaptureTrace,
  formatTargetCheck,
  refineTargetDataMissing,
} from '../src/shared/capture-trace.ts';

const matches = (url: string, target: string) => new RegExp(`^${target}`).test(url);

const VARIATIONAL_TARGETS = [
  'https://omni.variational.io/api/portfolio/timeseries\\?period=one_day&kaito_pf=1$',
  'https://omni.variational.io/api/referrals\\?limit=\\d+&offset=\\d+$',
];
const LIGHTER_ACCOUNT = 'https://mainnet.zklighter.elliot.ai/api/v1/account\\?by=l1_address&value=.*';

test('every target answering 401 reads as a platform login problem', () => {
  const trace = createCaptureTrace(VARIATIONAL_TARGETS, matches);
  trace.openWindow(1);
  trace.record('https://omni.variational.io/api/portfolio/timeseries?period=one_day&kaito_pf=1', { status: 401, at: 2 });
  trace.record('https://omni.variational.io/api/referrals?limit=1&offset=0', { status: 401, at: 3 });
  assert.equal(
    refineTargetDataMissing('variational_portfolio', trace.outcomes(), undefined),
    'third_party_login_required',
  );
});

test('a target that also answered 2xx is not a login problem', () => {
  const trace = createCaptureTrace(VARIATIONAL_TARGETS, matches);
  trace.record('https://omni.variational.io/api/referrals?limit=1&offset=0', { status: 401, at: 1 });
  trace.record('https://omni.variational.io/api/referrals?limit=1&offset=0', { status: 200, at: 2 });
  assert.equal(refineTargetDataMissing('variational_portfolio', trace.outcomes(), undefined), undefined);
});

test('the readiness replay alone can show the 401', () => {
  const checks = { targets: { [VARIATIONAL_TARGETS[1]]: { outcome: 'http401', at: 5 } } };
  assert.equal(refineTargetDataMissing('polymarket_wallet', [], checks, 0), 'third_party_login_required');
  assert.equal(refineTargetDataMissing('polymarket_wallet', [], checks, 6), undefined);
});

test('Lighter v1/account answering only 400 or ERR_FAILED means no Lighter account', () => {
  const trace = createCaptureTrace([LIGHTER_ACCOUNT], matches);
  trace.record('https://mainnet.zklighter.elliot.ai/api/v1/account?by=l1_address&value=0xabc', { error: 'net::ERR_FAILED', at: 1 });
  trace.record('https://mainnet.zklighter.elliot.ai/api/v1/account?by=l1_address&value=0xabc', { status: 400, at: 2 });
  assert.equal(refineTargetDataMissing('lighter_wallet', trace.outcomes(), undefined), 'platform_account_not_found');
  assert.equal(refineTargetDataMissing('polymarket_wallet', trace.outcomes(), undefined), undefined);
});

test('nothing seen means no refinement', () => {
  assert.equal(refineTargetDataMissing('lighter_wallet', [{ label: 'v1/account', outcomes: [] }], undefined), undefined);
});

test('the check segment names the outcome, the missing path and the key names found', () => {
  const record = {
    targets: {
      'https://x.com/i/api/graphql/abc/AccountOverviewQuery': {
        outcome: 'path_missing',
        missing: ['$.data.result.metrics'],
        found: '$.data.result',
        keys: 'timeline/errors',
        n: 3,
        at: 10,
      },
      'https://old/a': { outcome: 'http401', at: 1 },
    },
  };
  assert.equal(
    formatTargetCheck(record, 5),
    'check=abc/AccountOverviewQuery:path_missingx3;missing=$.data.result.metrics;found=$.data.result;keys=timeline/errors',
  );
  assert.equal(formatTargetCheck(undefined), undefined);
  assert.equal(
    formatTargetCheck({ targets: { 'https://h/a/b': { outcome: 'path_missing', keys: 'x|y, z', at: 1 } } }),
    'check=a/b:path_missing;keys=x_y__z',
  );
});
