import assert from 'node:assert/strict';
import test from 'node:test';

import { budgetPausedUntil } from '../src/shared/budget-backoff.ts';

const now = Date.UTC(2026, 9, 4, 23, 19, 10);

test('a day-budget 429 pauses for an hour, independent of the device clock', () => {
  const body = { reason: 'handle_budget_exceeded', window: 'day', retry_after_seconds: 86400 };
  assert.equal(budgetPausedUntil({ status: 429, body }, now), now + 3_600_000);
});

test('a minute-budget 429 pauses for the server-provided seconds', () => {
  const body = { reason: 'handle_budget_exceeded', window: 'minute', retry_after_seconds: 60 };
  assert.equal(budgetPausedUntil({ status: 429, body }, now), now + 60_000);
});

test('a 429 without a usable retry window falls back to one minute', () => {
  assert.equal(budgetPausedUntil({ status: 429, body: 'Too Many Requests' }, now), now + 60_000);
  assert.equal(budgetPausedUntil({ status: 429, body: { retry_after_seconds: 0 } }, now), now + 60_000);
});

test('other failures do not pause', () => {
  assert.equal(budgetPausedUntil({ status: 500, body: { window: 'day' } }, now), undefined);
  assert.equal(budgetPausedUntil(new Error('network'), now), undefined);
  assert.equal(budgetPausedUntil(undefined, now), undefined);
});
