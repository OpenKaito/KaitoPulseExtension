import assert from 'node:assert/strict';
import test from 'node:test';

import { capConsecutiveByAuthor } from '../src/signal/activity-sidebar/author-cap.ts';

const rows = (hs: string[]): { handle: string }[] => hs.map((handle) => ({ handle }));
const handles = (r: { handle: string }[]): string[] => r.map((x) => x.handle);

test('caps a run of the same author to the max', () => {
  assert.deepEqual(handles(capConsecutiveByAuthor(rows(['a', 'a', 'a', 'a', 'b']), 2)), [
    'a',
    'a',
    'b',
  ]);
});

test('run resets after a different author', () => {
  assert.deepEqual(
    handles(capConsecutiveByAuthor(rows(['a', 'a', 'a', 'b', 'a', 'a', 'a']), 2)),
    ['a', 'a', 'b', 'a', 'a'],
  );
});

test('interspersed authors are never dropped', () => {
  assert.deepEqual(handles(capConsecutiveByAuthor(rows(['a', 'b', 'a', 'b', 'a']), 2)), [
    'a',
    'b',
    'a',
    'b',
    'a',
  ]);
});

test('empty handles are never capped', () => {
  assert.equal(capConsecutiveByAuthor(rows(['', '', '', '']), 2).length, 4);
});

type WRow = { handle: string; w: number };
const wrows = (specs: Array<[string, number]>): WRow[] =>
  specs.map(([handle, w]) => ({ handle, w }));
const weights = (r: WRow[]): number[] => r.map((x) => x.w);

test('keeps the highest-weight rows of a run, not the most recent', () => {
  assert.deepEqual(
    weights(
      capConsecutiveByAuthor(
        wrows([
          ['a', 10],
          ['a', 100],
          ['a', 1000],
        ]),
        2,
        (r) => r.w,
      ),
    ),
    [100, 1000],
  );
});

test('kept rows stay in original (time) order', () => {
  assert.deepEqual(
    weights(
      capConsecutiveByAuthor(
        wrows([
          ['a', 1000],
          ['a', 5],
          ['a', 50],
        ]),
        2,
        (r) => r.w,
      ),
    ),
    [1000, 50],
  );
});

test('equal weights fall back to recency (keep the newest)', () => {
  assert.deepEqual(
    weights(capConsecutiveByAuthor(wrows([['a', 0], ['a', 0], ['a', 0]]), 2, (r) => r.w)),
    [0, 0],
  );
});

test('non-finite weights are treated as lowest (dropped for real values)', () => {
  assert.deepEqual(
    weights(capConsecutiveByAuthor(wrows([['a', NaN], ['a', 1], ['a', 100]]), 2, (r) => r.w)),
    [1, 100],
  );
});
