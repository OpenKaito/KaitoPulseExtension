import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});

let signalValue: unknown;
Object.assign(globalThis, {
  chrome: {
    storage: {
      local: { get: async (_key: string) => ({ 'kaito.lastCaptureSignal': signalValue }) },
      onChanged: { addListener() {}, removeListener() {} },
    },
  },
});

const { describeCaptureSignal } = (await import('../src/background/capture-signal.ts')) as unknown as {
  describeCaptureSignal: (since?: number) => Promise<string | undefined>;
};

test('no stored signal → undefined (attestor never got a response to prove)', async () => {
  signalValue = undefined;
  assert.equal(await describeCaptureSignal(0), undefined);
});

test('armed capture → stored=<via>/marked=<n>', async () => {
  signalValue = { at: 1000, via: 'change', results: [{ marked: true }, { marked: true }, { marked: false }] };
  assert.equal(await describeCaptureSignal(0), 'stored=change/marked=2');
});

test('signal older than `since` is dropped', async () => {
  signalValue = { at: 500, via: 'initial', results: [{ marked: true }] };
  assert.equal(await describeCaptureSignal(900), undefined);
  assert.equal(await describeCaptureSignal(400), 'stored=initial/marked=1');
});

test('via is sanitized to letters', async () => {
  signalValue = { at: 2000, via: 'change | {x}', results: [] };
  assert.equal(await describeCaptureSignal(0), 'stored=changex/marked=0');
});
