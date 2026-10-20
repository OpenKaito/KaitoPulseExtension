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
      return { ...loaded, source: `${loaded.source}\nexport { injectFreshBridgeScripts };` };
    }
    return loaded;
  },
});

type Injection = { files?: string[]; func?: (...args: unknown[]) => unknown; args?: unknown[] };

let documentScope: Record<string, unknown> = {};
const bridgeLoads: number[] = [];
const session: Record<string, unknown> = {};

Object.assign(globalThis, {
  chrome: {
    tabs: { onRemoved: { addListener() {} }, onUpdated: { addListener() {} } },
    storage: {
      local: {},
      session: {
        get: async (key: string) => ({ [key]: session[key] }),
        set: async (items: Record<string, unknown>) => Object.assign(session, items),
      },
    },
    scripting: {
      executeScript: async (injection: Injection & { target: { tabId: number } }) => {
        if (injection.files?.includes('padoZKAttestationJSSDK.bundle.js')) {
          bridgeLoads.push(injection.target.tabId);
        }
        if (!injection.func) return [{ result: undefined }];
        const saved = globalThis as unknown as Record<string, unknown>;
        const previous = Object.fromEntries(Object.keys(documentScope).map((k) => [k, saved[k]]));
        Object.assign(saved, documentScope);
        const result = injection.func(...(injection.args ?? []));
        for (const key of Object.keys(saved)) {
          if (key.startsWith('__kaito')) {
            documentScope[key] = saved[key];
            if (key in previous) saved[key] = previous[key];
            else delete saved[key];
          }
        }
        return [{ result }];
      },
    },
  },
});

const { injectFreshBridgeScripts } = (await import('../src/background/primus-adapter.ts')) as unknown as {
  injectFreshBridgeScripts: (tabId: number) => Promise<void>;
};

test('a document gets one bridge however many times it is injected', async () => {
  documentScope = {};
  bridgeLoads.length = 0;
  await injectFreshBridgeScripts(7);
  await injectFreshBridgeScripts(7);
  await injectFreshBridgeScripts(7);
  assert.deepEqual(bridgeLoads, [7]);
});

test('a new document gets a fresh bridge', async () => {
  documentScope = {};
  bridgeLoads.length = 0;
  await injectFreshBridgeScripts(7);
  documentScope = {};
  await injectFreshBridgeScripts(7);
  assert.deepEqual(bridgeLoads, [7, 7]);
});
