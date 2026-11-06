import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

const stub = (source: string) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/lib/env') return stub('export const ENV = {};');
    if (specifier === '@/shared/storage') {
      return stub('const item = { getValue: async () => null, watch: () => () => {} }; export const meCacheItem = item, sessionItem = item, verifySnapshotItem = item;');
    }
    if (specifier === './catalog') {
      return stub('export const buildTasks = () => [], statusFor = () => undefined, statusEquals = () => true;');
    }
    if (specifier === './messaging') return stub('export const sendVerifyMessage = async () => undefined;');
    if (specifier.startsWith('@/')) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { errorDescription, errorHeadline, resultKindForError } = await import('../src/verify/controller.ts');

test('a missing site permission names the fix instead of asking to log in', () => {
  assert.equal(errorHeadline('permission_required'), 'Site access required');
  const description = errorDescription('permission_required', 'Polymarket');
  assert.match(description, /Allow/);
  assert.match(description, /Polymarket/);
  assert.doesNotMatch(description, /logged in/);
  assert.equal(resultKindForError('permission_required'), 'failed');
});

test('a wallet with no platform account says so instead of asking to log in', () => {
  assert.equal(errorHeadline('platform_account_not_found'), 'No account for this wallet');
  const description = errorDescription('platform_account_not_found', 'Lighter');
  assert.match(description, /has no Lighter account/);
  assert.doesNotMatch(description, /logged in/);
  assert.equal(resultKindForError('platform_account_not_found'), 'failed');
});
