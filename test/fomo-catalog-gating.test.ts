import assert from 'node:assert/strict';
import test from 'node:test';

import type { ExtensionVerifier } from '../src/shared/contracts.ts';
import { buildTasks } from '../src/verify/catalog.ts';

const NOW = 1_700_000_000_000;

const fomoVerifier: ExtensionVerifier = {
  id: 'fomo_ownership',
  platform: 'fomo',
  name: 'fomo Account',
  guide: { url: 'https://fomo.family/', message: 'Sign in to fomo.' },
};

test('fomo shows no placeholder card when the backend omits it', () => {
  const tasks = buildTasks([], {}, NOW);
  const fomoTasks = tasks.filter(
    (t) => t.meta.platform === 'fomo' || t.id === 'platform:fomo' || t.id === 'fomo_ownership',
  );
  assert.equal(fomoTasks.length, 0, 'fomo must not surface without a live verifier');
});

test('fomo renders with zktls meta when the backend returns it', () => {
  const tasks = buildTasks([fomoVerifier], {}, NOW);
  const fomo = tasks.filter((t) => t.meta.platform === 'fomo');
  assert.equal(fomo.length, 1);
  assert.equal(fomo[0].id, 'fomo_ownership');
  assert.equal(fomo[0].meta.kind, 'zktls');
  assert.ok(fomo[0].verifier, 'the live verifier must be bound so the card is runnable');
});
