import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mergeEntries,
  removeEntry,
  splitFresh,
  type TtlCacheMap,
  type TtlCachePolicy,
} from '../src/shared/ttl-cache.ts';

interface Value {
  n: number | null;
}

const policy: TtlCachePolicy<Value> = {
  positiveTtlMs: 30 * 60_000,
  negativeTtlMs: 10 * 60_000,
  maxEntries: 3,
  isComplete: (v) => v.n != null,
};

const NOW = 1_000_000_000;

test('splitFresh serves fresh entries and reports the rest as misses', () => {
  const map: TtlCacheMap<Value> = {
    fresh: { v: { n: 1 }, t: NOW - 60_000 },
    stale: { v: { n: 2 }, t: NOW - policy.positiveTtlMs - 1 },
    unknown: { v: { n: 3 }, t: NOW },
  };

  const { hits, misses } = splitFresh(map, ['fresh', 'stale', 'missing'], NOW, policy);

  assert.deepEqual(hits, { fresh: { n: 1 } });
  assert.deepEqual(misses, ['stale', 'missing']);
});

test('splitFresh expires null and incomplete values on the negative TTL', () => {
  const justInside = NOW - policy.negativeTtlMs + 1;
  const justOutside = NOW - policy.negativeTtlMs - 1;
  const map: TtlCacheMap<Value> = {
    negFresh: { v: null, t: justInside },
    negStale: { v: null, t: justOutside },
    incompleteFresh: { v: { n: null }, t: justInside },
    incompleteStale: { v: { n: null }, t: justOutside },
  };

  const { hits, misses } = splitFresh(
    map,
    ['negFresh', 'negStale', 'incompleteFresh', 'incompleteStale'],
    NOW,
    policy,
  );

  assert.deepEqual(Object.keys(hits).sort(), ['incompleteFresh', 'negFresh']);
  assert.deepEqual(misses, ['negStale', 'incompleteStale']);
});

test('splitFresh treats a future timestamp (clock skew) as a miss', () => {
  const map: TtlCacheMap<Value> = { skewed: { v: { n: 1 }, t: NOW + 5_000 } };

  const { hits, misses } = splitFresh(map, ['skewed'], NOW, policy);

  assert.deepEqual(hits, {});
  assert.deepEqual(misses, ['skewed']);
});

test('mergeEntries stamps updates, drops expired entries, and does not mutate the input', () => {
  const map: TtlCacheMap<Value> = {
    keep: { v: { n: 1 }, t: NOW - 60_000 },
    expired: { v: { n: 2 }, t: NOW - policy.positiveTtlMs - 1 },
  };
  const snapshot = structuredClone(map);

  const next = mergeEntries(map, { added: { n: 3 }, negative: null }, NOW, policy);

  assert.deepEqual(map, snapshot);
  assert.deepEqual(Object.keys(next).sort(), ['added', 'keep', 'negative']);
  assert.deepEqual(next.added, { v: { n: 3 }, t: NOW });
  assert.deepEqual(next.negative, { v: null, t: NOW });
});

test('mergeEntries evicts the oldest entries beyond maxEntries', () => {
  const map: TtlCacheMap<Value> = {
    oldest: { v: { n: 1 }, t: NOW - 3_000 },
    older: { v: { n: 2 }, t: NOW - 2_000 },
    old: { v: { n: 3 }, t: NOW - 1_000 },
  };

  const next = mergeEntries(map, { newest: { n: 4 } }, NOW, policy);

  assert.equal(Object.keys(next).length, policy.maxEntries);
  assert.equal(next.oldest, undefined);
  assert.deepEqual(Object.keys(next).sort(), ['newest', 'old', 'older']);
});

test('removeEntry returns a new map without the id and is a no-op for unknown ids', () => {
  const map: TtlCacheMap<Value> = { a: { v: { n: 1 }, t: NOW } };

  const removed = removeEntry(map, 'a');
  assert.deepEqual(removed, {});
  assert.deepEqual(map, { a: { v: { n: 1 }, t: NOW } });

  assert.equal(removeEntry(map, 'missing'), map);
});
