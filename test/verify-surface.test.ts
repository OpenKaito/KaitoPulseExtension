import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { verifySurfaceKey } from '../src/shared/verify-surface.ts';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '../shared/verify-surface') return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});
const { openVerifyWindow, returnToOriginTabAfterVerify } = await import('../src/background/popup-window.ts');

function browser() {
  const values = new Map<string, unknown>();
  const calls: Array<[string, unknown]> = [];
  const chrome = {
    runtime: { getURL: (path: string) => `chrome-extension://test/${path}` },
    storage: { session: {
      set: async (items: Record<string, unknown>) => {
        for (const [key, value] of Object.entries(items)) values.set(key, value);
      },
      get: async (key: string) => ({ [key]: values.get(key) }),
      remove: async (key: string) => { values.delete(key); },
    } },
    sidePanel: { open: async (options: unknown) => { calls.push(['open', options]); } },
    windows: {
      getLastFocused: async () => ({ id: 7 }),
      create: async (options: unknown) => { calls.push(['createWindow', options]); return { id: 11 }; },
      update: async (id: number, options: unknown) => { calls.push(['focus', { id, options }]); },
    },
    tabs: {
      create: async (options: unknown) => { calls.push(['createTab', options]); },
      get: async (id: number) => ({ id, windowId: 7 }),
      update: async (id: number, options: unknown) => { calls.push(['activate', { id, options }]); },
    },
  };
  Object.assign(globalThis, { chrome });
  return { chrome, values, calls };
}

test('opens the global panel in the sender window before storage resolves', async () => {
  const { chrome, calls } = browser();
  let release!: () => void;
  chrome.storage.session.set = () => new Promise<void>((resolve) => { release = resolve; });
  const pending = openVerifyWindow('polymarket', 12, 9);
  assert.deepEqual(calls, [['open', { windowId: 9 }]]);
  release();
  await pending;
  assert.equal(calls.length, 1);
});

test('a rejected user gesture opens the original popup with the source window context', async () => {
  const { chrome, values, calls } = browser();
  chrome.sidePanel.open = async () => { throw new Error('user gesture required'); };
  await openVerifyWindow('polymarket', 12, 9);
  assert.deepEqual(calls, [['createWindow', {
    url: 'chrome-extension://test/verify-window.html?surface=popup&ownerWindowId=9',
    type: 'popup', width: 420, height: 720, focused: true,
  }]]);
  assert.equal((values.get(verifySurfaceKey(9)) as { verifierId: string }).verifierId, 'polymarket');
});

test('returning from one panel preserves the other window request', async () => {
  const { values, calls } = browser();
  await openVerifyWindow('polymarket', 12, 9);
  await openVerifyWindow('x_analytics_overview', 13, 10);
  await returnToOriginTabAfterVerify(9);
  assert.equal(values.has(verifySurfaceKey(9)), false);
  assert.equal(values.has(verifySurfaceKey(10)), true);
  assert.deepEqual(calls.slice(-2), [
    ['activate', { id: 12, options: { active: true } }],
    ['focus', { id: 7, options: { focused: true } }],
  ]);
});

test('closing after the origin tab disappears still clears the completed request', async () => {
  const { chrome, values, calls } = browser();
  await openVerifyWindow('polymarket', 12, 9);
  chrome.tabs.get = async () => { throw new Error('No tab'); };
  await returnToOriginTabAfterVerify(9);
  assert.equal(values.has(verifySurfaceKey(9)), false);
  assert.deepEqual(calls, [['open', { windowId: 9 }]]);
});

test('an unavailable sidePanel API falls back to a popup', async () => {
  const { chrome, calls } = browser();
  Reflect.deleteProperty(chrome, 'sidePanel');
  await openVerifyWindow('polymarket', 12, 9);
  assert.equal(calls[0]?.[0], 'createWindow');
});

test('a synchronous sidePanel exception falls back to a popup', async () => {
  const { chrome, calls } = browser();
  chrome.sidePanel.open = () => { throw new Error('unavailable'); };
  await openVerifyWindow('polymarket', 12, 9);
  assert.equal(calls[0]?.[0], 'createWindow');
});

test('on Android the fallback surface is an ordinary tab, not a popup window that pins itself over the page', async () => {
  const { chrome, calls } = browser();
  chrome.sidePanel.open = async () => { throw new Error('unsupported'); };
  Object.assign(chrome.runtime, { getPlatformInfo: async () => ({ os: 'android' }) });
  await openVerifyWindow('x_analytics_overview', 12, 9);
  assert.deepEqual(calls, [['createTab', {
    url: 'chrome-extension://test/verify-window.html?surface=popup&ownerWindowId=9',
    active: true,
  }]]);
});
