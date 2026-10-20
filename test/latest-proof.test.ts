import assert from 'node:assert/strict';
import test from 'node:test';

import { latestProofByVerifier } from '../src/shared/latest-proof.ts';

const proof = (verifierId: string, proofId: string, verifiedAt: number) =>
  ({ verifierId, proofId, verifiedAt }) as never;

test('a re-verified snapshot keeps its newest proof, whatever order the backend lists them in', () => {
  const map = latestProofByVerifier([
    proof('binance_asset_history', 'new', 2_000),
    proof('binance_asset_history', 'old', 1_000),
    proof('okx_asset_history', 'only', 1_500),
  ]);
  assert.equal((map.binance_asset_history as { proofId: string }).proofId, 'new');
  assert.equal((map.okx_asset_history as { proofId: string }).proofId, 'only');
  const reversed = latestProofByVerifier([proof('x', 'old', 1), proof('x', 'new', 2)]);
  assert.equal((reversed.x as { proofId: string }).proofId, 'new');
});
