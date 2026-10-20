import assert from 'node:assert/strict';
import test from 'node:test';

import { navigationEndsProof } from '../src/shared/verifier-url.ts';

const GUIDE = 'https://x.com/i/account_analytics';

test('the guide route and its sub-routes keep the proof', () => {
  assert.equal(navigationEndsProof('https://x.com/i/account_analytics', GUIDE, false), false);
  assert.equal(navigationEndsProof('https://x.com/i/account_analytics/content', GUIDE, true), false);
});

test('same-origin routing without a new document keeps the proof', () => {
  assert.equal(navigationEndsProof('https://x.com/home', GUIDE, false), false);
  assert.equal(navigationEndsProof('https://x.com/someone/status/1', GUIDE, false), false);
});

test('a new document outside the guide route ends the proof', () => {
  assert.equal(navigationEndsProof('https://x.com/home', GUIDE, true), true);
  assert.equal(navigationEndsProof('https://x.com/i/flow/login', GUIDE, true), true);
});

test('leaving the origin ends the proof either way', () => {
  assert.equal(navigationEndsProof('https://www.google.com/', GUIDE, false), true);
  assert.equal(navigationEndsProof('https://www.google.com/', GUIDE, true), true);
});
