import assert from 'node:assert/strict';
import test from 'node:test';

import type { ExtensionVerifier } from '../src/shared/contracts.ts';
import { buildTasks } from '../src/verify/catalog.ts';

const NOW = 1_700_000_000_000;

const HL_REFERRAL: ExtensionVerifier = {
  id: 'hyperliquid_referral',
  name: 'Hyperliquid Referrals',
  platform: 'hyperliquid',
  category: 'referral',
  guide: { url: 'https://kaito.ai/settings/wallet', message: 'Verify your wallet.' },
  routes: ['hyperliquid_public_read'],
};

test('the Hyperliquid referral card renders in the referral tab', () => {
  const task = buildTasks([HL_REFERRAL], {}, NOW).find((t) => t.id === HL_REFERRAL.id);

  assert.ok(task);
  assert.equal(task.category, 'referral');
  assert.equal(task.meta.platform, 'hyperliquid');
});

// Nothing in this route touches the user's Hyperliquid session, so copy asking
// for a login sends someone without a wallet binding to do the one thing that
// cannot help.
test('🛑 the card asks for a verified wallet, not a Hyperliquid login', () => {
  const task = buildTasks([HL_REFERRAL], {}, NOW).find((t) => t.id === HL_REFERRAL.id);

  assert.ok(task);
  assert.equal(task.meta.kind, 'server_read');
  assert.match(task.meta.detail.requirement, /verified Hyperliquid wallet/i);
  assert.doesNotMatch(task.meta.detail.requirement, /signed-in|sign in|log in/i);
  assert.ok(
    task.meta.detail.steps.every((step) => !/zktls/i.test(step)),
    'steps must not describe a zkTLS attestation that does not happen',
  );
});
