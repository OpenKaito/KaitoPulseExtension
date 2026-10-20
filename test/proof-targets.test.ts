import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkProofTargetUrl,
  optionalProofTargetPatterns,
} from '../src/shared/proof-targets.ts';

/** checkProofTargetUrl warns on every rejection; silence it so the run stays readable. */
function withoutWarnings<T>(fn: () => T): T {
  const original = console.warn;
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.warn = original;
  }
}

test('the API subdomains the templates capture are covered', () => {
  for (const url of [
    'https://gamma-api.polymarket.com/positions',
    'https://mainnet.zklighter.elliot.ai/api/v1/account',
  ]) {
    assert.equal(checkProofTargetUrl(url), url, `${url} must be a declared proof target`);
  }
});

test('a guide URL that is not a proof target is rejected', () => {
  // hyperliquid_wallet's guide — the reason the three new platforms admit
  // referral verifiers only: this host is not, and should not be, capturable.
  assert.equal(withoutWarnings(() => checkProofTargetUrl('https://kaito.ai/settings/wallet')), null);
});

test('non-https and undeclared hosts are rejected', () => {
  assert.equal(withoutWarnings(() => checkProofTargetUrl('http://polymarket.com/portfolio')), null);
  assert.equal(withoutWarnings(() => checkProofTargetUrl('https://example.com/')), null);
  for (const url of ['https://www.binance.com/en/my/dashboard', 'https://pump.fun/profile', 'https://fomo.family/']) {
    assert.equal(withoutWarnings(() => checkProofTargetUrl(url)), null, `${url} is not launched`);
  }
});

test('the optional host patterns still match the release manifest gate', () => {
  // Pinned at scripts/verify-release-manifest.mjs — a new PROOF_TARGETS entry
  // must be added there in the same change, or the release build fails.
  assert.deepEqual(new Set(optionalProofTargetPatterns()), new Set([
    'https://*.polymarket.com/*',
    'https://hub.axisrobotics.ai/*',
    'https://omni.variational.io/*',
    'https://app.lighter.xyz/*',
    'https://mainnet.zklighter.elliot.ai/*',
  ]));
});
