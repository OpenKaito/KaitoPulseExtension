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
      return { ...loaded, source: `${loaded.source}\nexport { waitForTabReady, waitForTabToSettle, waitForTabToOpen };` };
    }
    return loaded;
  },
});

let status = 'loading';
const chrome = {
  tabs: {
    get: async (id: number) => ({ id, status, url: 'https://x.com/i/account_analytics' }),
    onUpdated: { addListener() {}, removeListener() {} },
    onRemoved: { addListener() {} },
  },
  scripting: { executeScript: async () => [{ result: { state: 'loading', href: 'about:blank' } }] },
  storage: { local: { set: async () => {} } },
};
Object.assign(globalThis, { chrome });
const { waitForTabReady, waitForTabToSettle, waitForTabToOpen } = (await import(
  '../src/background/primus-adapter.ts'
)) as unknown as {
  waitForTabReady: (tabId: number, deadline?: number) => Promise<void>;
  waitForTabToSettle: (tabId: number, openDeadline?: number) => Promise<void>;
  waitForTabToOpen: (
    tabId: number,
    onSlow?: () => void,
    budget?: { openMs: number; slowAfterMs: number },
  ) => Promise<void>;
};

test('a page that never loads fails at the given deadline', async () => {
  const startedAt = Date.now();
  await assert.rejects(waitForTabReady(1, startedAt + 200), /verifier_tab_load_timeout/);
  assert.ok(Date.now() - startedAt < 1_500);
});

test('settling shares the opening deadline instead of starting a fresh wait', async () => {
  const startedAt = Date.now();
  await assert.rejects(waitForTabToSettle(1, startedAt + 200), /verifier_tab_load_timeout/);
  assert.ok(Date.now() - startedAt < 1_500);
});

test('a page that is already loaded returns without waiting', async () => {
  status = 'complete';
  const startedAt = Date.now();
  await waitForTabReady(1, startedAt + 5_000);
  assert.ok(Date.now() - startedAt < 200);
  status = 'loading';
});

test('a slow page gets the soft hint first and only fails at the open budget', async () => {
  let slowAt = 0;
  const startedAt = Date.now();
  await assert.rejects(
    waitForTabToOpen(1, () => (slowAt = Date.now() - startedAt), { openMs: 400, slowAfterMs: 100 }),
    /verifier_tab_load_timeout/,
  );
  assert.ok(slowAt >= 90 && slowAt < 400, `soft hint at ${slowAt} ms`);
  assert.ok(Date.now() - startedAt >= 390);
});

test('a page that loads before the hint never shows it', async () => {
  status = 'complete';
  let slow = false;
  await waitForTabToOpen(1, () => (slow = true), { openMs: 10_000, slowAfterMs: 3_000 });
  await new Promise((r) => setTimeout(r, 2_000));
  assert.equal(slow, false);
  status = 'loading';
});
