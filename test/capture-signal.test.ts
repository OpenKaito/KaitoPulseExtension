import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});

type Listener = (changes: Record<string, { newValue?: unknown }>, area: string) => void;
const storageListeners = new Set<Listener>();
const local = new Map<string, unknown>();
const pages = new Map<number, Map<string, string>>();
const unreachable = new Set<number>();
let injectionDelayMs = 0;
const pageAttrs = (tabId: number) => {
  if (!pages.has(tabId)) pages.set(tabId, new Map());
  return pages.get(tabId)!;
};
const setLocal = (key: string, value: unknown) => {
  local.set(key, value);
  for (const fn of [...storageListeners]) fn({ [key]: { newValue: value } }, 'local');
};

Object.assign(globalThis, {
  chrome: {
    storage: {
      local: {
        get: async (key: string) => (local.has(key) ? { [key]: local.get(key) } : {}),
        set: async (items: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(items)) local.set(key, value);
        },
      },
      onChanged: {
        addListener: (fn: Listener) => storageListeners.add(fn),
        removeListener: (fn: Listener) => storageListeners.delete(fn),
      },
    },
    scripting: {
      executeScript: async ({
        target,
        func,
        args,
      }: {
        target: { tabId: number };
        func: Function;
        args: unknown[];
      }) => {
        const delay = injectionDelayMs;
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        if (unreachable.has(target.tabId)) throw new Error(`No tab with id: ${target.tabId}.`);
        const attrs = pageAttrs(target.tabId);
        const documentElement = {
          setAttribute: (name: string, value: string) => attrs.set(name, value),
          removeAttribute: (name: string) => attrs.delete(name),
          hasAttribute: (name: string) => attrs.has(name),
        };
        const result = vm.runInNewContext(`(${func.toString()})(...args)`, {
          args,
          document: { documentElement },
        });
        return [{ result }];
      },
    },
  },
});

const { LAST_CAPTURE_SIGNAL_STORAGE_KEY, watchPrimusCaptureComplete } = await import(
  '../src/background/capture-signal.ts'
);
const { PROOF_CAPTURED_ATTR } = await import('../src/shared/proof-arming.ts');

const settle = async () => {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setImmediate(resolve));
};
const captured = (tabId: number) => pageAttrs(tabId).has(PROOF_CAPTURED_ATTR);
const fresh = () => {
  local.clear();
  pages.clear();
  unreachable.clear();
  injectionDelayMs = 0;
};

test('Primus capturing after the watch starts marks the verifier tab', async () => {
  fresh();
  const stop = watchPrimusCaptureComplete(7);
  await settle();
  setLocal('kaitoPageDecodeInitDebug', { stage: 'init_received' });
  for (const fn of [...storageListeners]) fn({ beginAttest: { newValue: '1' } }, 'session');
  await settle();
  assert.equal(captured(7), false);
  setLocal('beginAttest', '1');
  await settle();
  assert.equal(captured(7), true);
  stop();
  assert.equal(storageListeners.size, 0);
});

test('Primus having captured before the watch starts still marks the tab', async () => {
  fresh();
  local.set('beginAttest', '1');
  const stop = watchPrimusCaptureComplete(8);
  await settle();
  assert.equal(captured(8), true);
  assert.equal((local.get(LAST_CAPTURE_SIGNAL_STORAGE_KEY) as { via: string }).via, 'initial');
  stop();
});

test('a capture right after the watch starts is not undone by the stale-mark clear', async () => {
  fresh();
  pageAttrs(9).set(PROOF_CAPTURED_ATTR, '1');
  injectionDelayMs = 20;
  const stop = watchPrimusCaptureComplete(9);
  setLocal('beginAttest', '1');
  await new Promise((resolve) => setTimeout(resolve, 120));
  await settle();
  assert.equal(captured(9), true);
  stop();
});

test('a new attempt clears a mark left by the previous one', async () => {
  fresh();
  pageAttrs(10).set(PROOF_CAPTURED_ATTR, '1');
  const stop = watchPrimusCaptureComplete(10);
  await settle();
  assert.equal(captured(10), false);
  stop();
});

test('clearing or other values of beginAttest never mark the page', async () => {
  fresh();
  const stop = watchPrimusCaptureComplete(11);
  await settle();
  setLocal('beginAttest', undefined);
  setLocal('beginAttest', '0');
  setLocal('activeRequestAttestation', '{}');
  await settle();
  assert.equal(captured(11), false);
  assert.equal(local.has(LAST_CAPTURE_SIGNAL_STORAGE_KEY), false);
  stop();
});

test('the verifier tab is marked even when Primus reports another data source tab', async () => {
  fresh();
  unreachable.add(1837856553);
  const stop = watchPrimusCaptureComplete(12);
  await settle();
  setLocal('kaitoPageDecodeInitDebug', { stage: 'data_source_tab_ready', tabId: 1837856553 });
  setLocal('beginAttest', '1');
  await settle();
  assert.equal(captured(12), true);
  const signal = local.get(LAST_CAPTURE_SIGNAL_STORAGE_KEY) as {
    via: string;
    results: { tabId: number; marked?: boolean; error?: string }[];
  };
  assert.equal(signal.via, 'change');
  assert.deepEqual(signal.results[0], { tabId: 12, marked: true });
  assert.equal(signal.results[1].tabId, 1837856553);
  assert.match(signal.results[1].error ?? '', /No tab with id/);
  stop();
});

test('the tab Primus reports is marked too when it is a different page', async () => {
  fresh();
  const stop = watchPrimusCaptureComplete(13);
  await settle();
  setLocal('kaitoPageDecodeInitDebug', { stage: 'data_source_tab_ready', tabId: 14 });
  setLocal('beginAttest', '1');
  await settle();
  assert.equal(captured(13), true);
  assert.equal(captured(14), true);
  stop();
});

test('a stopped watch ignores a late signal', async () => {
  fresh();
  const stop = watchPrimusCaptureComplete(15);
  await settle();
  stop();
  setLocal('beginAttest', '1');
  await settle();
  assert.equal(captured(15), false);
});
