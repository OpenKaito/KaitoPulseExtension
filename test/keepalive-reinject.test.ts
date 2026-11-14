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
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (url.endsWith('/background/primus-adapter.ts')) {
      return { ...loaded, source: `${loaded.source}\nexport { watchPrimusInterceptionStart };` };
    }
    return loaded;
  },
});

let storageListener: ((changes: unknown, area: string) => void) | undefined;
const keepaliveTabs: unknown[] = [];
const chrome = {
  tabs: { onRemoved: { addListener() {} }, onUpdated: { addListener() {} } },
  runtime: { connect: () => ({ onDisconnect: { addListener() {} }, disconnect() {} }) },
  storage: {
    local: { set: async () => {} },
    onChanged: {
      addListener: (fn: (changes: unknown, area: string) => void) => { storageListener = fn; },
      removeListener: () => { storageListener = undefined; },
    },
  },
  scripting: {
    executeScript: async ({ target, func }: { target: { tabId: number }; func: Function }) => {
      if (func.toString().includes('kaitoAttestationKeepAlive')) keepaliveTabs.push(target?.tabId);
      return [{ result: undefined }];
    },
  },
};
Object.assign(globalThis, { chrome, window: {} });

const { watchPrimusInterceptionStart } = (await import('../src/background/primus-adapter.ts')) as unknown as {
  watchPrimusInterceptionStart: (tabId: number, template?: unknown) => () => void;
};

const fireReady = (tabId: number) =>
  storageListener?.(
    { kaitoPageDecodeInitDebug: { newValue: { stage: 'data_source_tab_ready', tabId } } },
    'local',
  );
const settle = () => new Promise((r) => setImmediate(r));

test('data_source_tab_ready re-injects the keep-alive into the fresh tab, even for a non-X data source', async () => {
  keepaliveTabs.length = 0;
  const stop = watchPrimusInterceptionStart(42, { dataSource: 'polymarket' });
  assert.ok(storageListener, 'registers a storage.onChanged listener');
  fireReady(77);
  await settle();
  assert.deepEqual(keepaliveTabs, [77], 're-injected into the data-source tab Primus reported');
  stop();
});

test('an unrelated storage change does not re-inject', async () => {
  keepaliveTabs.length = 0;
  const stop = watchPrimusInterceptionStart(42, { dataSource: 'polymarket' });
  storageListener?.({ someOtherKey: { newValue: 1 } }, 'local');
  await settle();
  assert.equal(keepaliveTabs.length, 0);
  stop();
});
