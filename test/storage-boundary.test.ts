import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const sharedStoragePath = new URL('../src/shared/storage.ts', import.meta.url);
const backgroundStoragePath = new URL(
  '../src/background/auth-intent-storage.ts',
  import.meta.url,
);

test('keeps the pending-auth session item out of content-shared storage', () => {
  const sharedStorage = readFileSync(sharedStoragePath, 'utf8');

  assert.doesNotMatch(sharedStorage, /session:kaito\.pendingAuthIntents/);
  assert.equal(existsSync(backgroundStoragePath), true);

  const backgroundStorage = readFileSync(backgroundStoragePath, 'utf8');
  assert.match(backgroundStorage, /session:kaito\.pendingAuthIntents/);
});
