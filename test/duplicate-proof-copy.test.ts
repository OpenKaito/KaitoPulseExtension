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

const { errorDescription, errorHeadline } = await import('../src/verify/controller.ts');

test('an account already in the Kaito list points at its row, not at a retry', () => {
  assert.equal(errorHeadline('duplicate_proof'), 'Already in your list');
  const description = errorDescription('duplicate_proof', 'Polymarket', 'duplicate_proof');
  assert.match(description, /already in your Kaito list/);
  assert.match(description, /Re-verify it from its row/);
  assert.match(description, /Polymarket/);
});

test('a replayed proof keeps its own wording', () => {
  const description = errorDescription('duplicate_proof', 'Polymarket', 'duplicate_taskid');
  assert.match(description, /already submitted/);
});
