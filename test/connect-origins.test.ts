import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_CONNECT_ORIGIN,
  toMatchPatterns,
  toOriginList,
} from '../src/shared/connect-origins.ts';

test('falls back to the production origin when unset or blank', () => {
  for (const value of [undefined, '', '   ', ',,']) {
    assert.deepEqual(toOriginList(value), [DEFAULT_CONNECT_ORIGIN]);
    assert.deepEqual(toMatchPatterns(value), ['https://kaito.ai/*', 'https://*.kaito.ai/*']);
  }
});

test('a single origin keeps the previous behaviour', () => {
  assert.deepEqual(toOriginList('https://kaito.ai'), ['https://kaito.ai']);
  assert.deepEqual(toMatchPatterns('https://kaito.ai'), [
    'https://kaito.ai/*',
    'https://*.kaito.ai/*',
  ]);
});

test('a comma-separated list binds every origin, order preserved', () => {
  const raw = 'https://kaito.ai, https://preview.example.com ,http://localhost:4001';
  assert.deepEqual(toOriginList(raw), [
    'https://kaito.ai',
    'https://preview.example.com',
    'http://localhost:4001',
  ]);
  assert.deepEqual(toMatchPatterns(raw), [
    'https://kaito.ai/*',
    'https://*.kaito.ai/*',
    'https://preview.example.com/*',
    'https://*.preview.example.com/*',
    // Match patterns carry no port: http://localhost/* already matches :4001.
    'http://localhost/*',
  ]);
});

test('entry 0 stays the canonical site (ENV.connectOrigin)', () => {
  assert.equal(toOriginList('https://yaps.kaito.ai,https://kaito.ai')[0], 'https://yaps.kaito.ai');
});

test('duplicate origins collapse', () => {
  assert.deepEqual(toOriginList('https://kaito.ai,https://kaito.ai/'), ['https://kaito.ai']);
  assert.deepEqual(toMatchPatterns('https://kaito.ai,https://kaito.ai/board'), [
    'https://kaito.ai/*',
    'https://*.kaito.ai/*',
  ]);
});

test('an IP host gets no subdomain wildcard', () => {
  assert.deepEqual(toMatchPatterns('http://127.0.0.1:4001'), ['http://127.0.0.1/*']);
});
