import assert from 'node:assert/strict';
import test from 'node:test';

import { isTransientTabError, retryTransientTab } from '../src/background/transient-tab-error.ts';

test('isTransientTabError matches tab-drag and missing-window errors', () => {
  assert.equal(
    isTransientTabError(new Error('Tabs cannot be edited right now (user may be dragging a tab).')),
    true,
  );
  assert.equal(isTransientTabError(new Error('No window with id: 5.')), true);
  assert.equal(isTransientTabError(new Error('No tab with id: 9.')), true);
  assert.equal(isTransientTabError(new Error('something else entirely')), false);
});

test('retryTransientTab returns immediately on success', async () => {
  let calls = 0;
  const value = await retryTransientTab(async () => {
    calls++;
    return 'ok';
  });
  assert.equal(value, 'ok');
  assert.equal(calls, 1);
});

test('retryTransientTab does not retry a non-transient error', async () => {
  let calls = 0;
  await assert.rejects(
    retryTransientTab(
      async () => {
        calls++;
        throw new Error('boom');
      },
      { attempts: 5, delayMs: 1 },
    ),
    /boom/,
  );
  assert.equal(calls, 1);
});

test('retryTransientTab recovers when a drag outlasts the first attempts', async () => {
  let calls = 0;
  const value = await retryTransientTab(
    async () => {
      calls++;
      if (calls < 3) throw new Error('Tabs cannot be edited right now (user may be dragging a tab).');
      return 'done';
    },
    { attempts: 6, delayMs: 1 },
  );
  assert.equal(value, 'done');
  assert.equal(calls, 3);
});

test('retryTransientTab gives up after attempts on a persistent transient error', async () => {
  let calls = 0;
  await assert.rejects(
    retryTransientTab(
      async () => {
        calls++;
        throw new Error('No window with id: 1.');
      },
      { attempts: 4, delayMs: 1 },
    ),
    /No window with id/,
  );
  assert.equal(calls, 4);
});
