import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/lib/env') {
      return { url: 'data:text/javascript,export const logDev = () => {};', shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});

Object.assign(globalThis, {
  chrome: { tabs: { onRemoved: { addListener() {} }, onUpdated: { addListener() {} } }, storage: { local: {} } },
});

const { formatAlgorithmDebug } = (await import('../src/background/primus-adapter.ts')) as unknown as {
  formatAlgorithmDebug: (debug: unknown) => string | undefined;
};

test('no debug / no details → undefined', () => {
  assert.equal(formatAlgorithmDebug(undefined), undefined);
  assert.equal(formatAlgorithmDebug({}), undefined);
  assert.equal(formatAlgorithmDebug({ details: {} }), undefined);
});

test('offline RUNNING carries the 00014 boundary (phase + elapsed)', () => {
  // offline is the MPC proof-generation phase; RUNNING at ~128s is exactly a 00014.
  assert.equal(
    formatAlgorithmDebug({ details: { offline: { statusDescription: 'RUNNING', elapsed: 128 } } }),
    'algo=offline:RUNNING/128s',
  );
});

test('all three phases render in order', () => {
  assert.equal(
    formatAlgorithmDebug({
      details: {
        initialization: { statusDescription: 'DONE', elapsed: 1 },
        offline: { statusDescription: 'RUNNING', elapsed: 128 },
        online: { statusDescription: 'DONE', elapsed: 2 },
      },
    }),
    'algo=init:DONE/1s offline:RUNNING/128s online:DONE/2s',
  );
});

test('elapsed as a string is parsed and rounded; missing elapsed is omitted', () => {
  assert.equal(
    formatAlgorithmDebug({ details: { offline: { statusDescription: 'RUNNING', elapsed: '127.6' } } }),
    'algo=offline:RUNNING/128s',
  );
  assert.equal(
    formatAlgorithmDebug({ details: { online: { statusDescription: 'DONE' } } }),
    'algo=online:DONE',
  );
});

test('statusDescription is sanitized so it cannot break the diagnostics delimiters', () => {
  assert.equal(
    formatAlgorithmDebug({ details: { offline: { statusDescription: 'run | plain {x}', elapsed: 5 } } }),
    'algo=offline:run_plain_x_/5s',
  );
});
