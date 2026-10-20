import assert from 'node:assert/strict';
import { test } from 'node:test';
import { timeSpentDisplay } from '../src/recommend-follow/format-time-spent.ts';

test('nothing tracked says desktop only', () => {
  for (const seconds of [null, 0]) {
    assert.deepEqual(timeSpentDisplay(seconds), {
      value: '—',
      caption: 'Tracked on desktop only',
      empty: true,
    });
  }
});

test('tracked time keeps the 24h caption', () => {
  assert.deepEqual(timeSpentDisplay(5400), {
    value: '1 hr 30 min',
    caption: 'Last 24h · Updates every 5 min',
    empty: false,
  });
});
