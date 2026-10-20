import assert from 'node:assert/strict';
import test from 'node:test';

import { formatPageState } from '../src/shared/verifier-url.ts';

test('a tab stuck loading on an error reports the network error', () => {
  assert.equal(
    formatPageState({
      url: 'https://polymarket.com/portfolio?x=1',
      loadStatus: 'loading',
      guideUrl: 'https://polymarket.com/portfolio',
      mainFrame: { error: 'net::ERR_CONNECTION_RESET', at: 5_000 },
      since: 4_000,
    }),
    'page=https://polymarket.com/portfolio load=loading net=net::ERR_CONNECTION_RESET',
  );
});

test('a completed main frame reports its http status; one from before the proof is ignored', () => {
  assert.equal(
    formatPageState({
      url: 'https://hub.axisrobotics.ai/login',
      loadStatus: 'complete',
      mainFrame: { status: 403, at: 5_000 },
      since: 4_000,
    }),
    'page=https://hub.axisrobotics.ai/login load=complete http=403',
  );
  assert.equal(
    formatPageState({ url: 'https://x.com/home', loadStatus: 'complete', mainFrame: { status: 200, at: 1 }, since: 4_000 }),
    'page=https://x.com/home load=complete',
  );
});

test('a closed or unknown tab still produces a line', () => {
  assert.equal(formatPageState({ loadStatus: 'closed' }), 'page=unknown load=closed');
});
