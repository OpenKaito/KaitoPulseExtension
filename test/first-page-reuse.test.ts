import assert from 'node:assert/strict';
import test from 'node:test';

import { createFirstPageReuse } from '../src/background/first-page-reuse.ts';

function setup() {
  let clock = 0;
  let calls = 0;
  const reuse = createFirstPageReuse<number>(60_000, () => clock);
  const load = async () => ++calls;
  return { reuse, load, tick: (ms: number) => (clock += ms), calls: () => calls };
}

test('reopening within 60s reuses the first page', async () => {
  const { reuse, load, tick, calls } = setup();
  assert.equal(await reuse.get('token-a', load), 1);
  tick(59_000);
  assert.equal(await reuse.get('token-a', load), 1);
  assert.equal(calls(), 1);
});

test('refetches once 60s have passed', async () => {
  const { reuse, load, tick, calls } = setup();
  await reuse.get('token-a', load);
  tick(60_000);
  assert.equal(await reuse.get('token-a', load), 2);
  assert.equal(calls(), 2);
});

test('another session never sees the cached page', async () => {
  const { reuse, load, calls } = setup();
  await reuse.get('token-a', load);
  assert.equal(await reuse.get('token-b', load), 2);
  assert.equal(calls(), 2);
});

test('a failed load is not cached', async () => {
  const reuse = createFirstPageReuse<number>(60_000, () => 0);
  let fail = true;
  let n = 0;
  const load = async () => {
    n += 1;
    if (fail) throw new Error('network');
    return n;
  };
  await assert.rejects(reuse.get('token-a', load));
  fail = false;
  assert.equal(await reuse.get('token-a', load), 2);
});
