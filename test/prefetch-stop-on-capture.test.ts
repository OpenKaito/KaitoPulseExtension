import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { mock } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const CAPTURED = 'data-kaito-proof-captured';
const TEARDOWN = 'kaito-proof-runtime-teardown-v1';

const attrs = new Map<string, string>();
const listeners = new Map<string, Set<(event: Event) => void>>();
const fakeDocument = {
  documentElement: {
    hasAttribute: (name: string) => attrs.has(name),
    setAttribute: (name: string, value: string) => void attrs.set(name, value),
    removeAttribute: (name: string) => void attrs.delete(name),
  },
  addEventListener: (type: string, fn: (event: Event) => void) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)!.add(fn);
  },
  removeEventListener: (type: string, fn: (event: Event) => void) => {
    listeners.get(type)?.delete(fn);
  },
};
const fakeLocation = { hostname: '' };

type Call = { url: string; settle: () => void };
let calls: Call[] = [];
let holdNext = false;
const fakeFetch = (input: RequestInfo | URL) => {
  const url = input instanceof Request ? input.url : String(input);
  if (!holdNext) {
    calls.push({ url, settle: () => undefined });
    return Promise.resolve(new Response('{}'));
  }
  holdNext = false;
  return new Promise<Response>((resolve) => {
    calls.push({ url, settle: () => resolve(new Response('{}')) });
  });
};

Object.assign(globalThis, {
  window: globalThis,
  document: fakeDocument,
  location: fakeLocation,
  sessionStorage: { getItem: (key: string) => (key === 'kaito.proofArmed' ? '1' : null) },
  MutationObserver: class {
    observe() {}
    disconnect() {}
  },
  defineUnlistedScript: (definition: { main: () => void }) => definition,
  fetch: fakeFetch,
});

mock.timers.enable({ apis: ['setTimeout'] });

const variational = (await import('../src/entrypoints/variational-verify-prefetch.ts')).default as {
  main: () => void;
};
const lighter = (await import('../src/entrypoints/lighter-verify-prefetch.ts')).default as {
  main: () => void;
};

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve));
};
const advance = async (ms: number, step = 500) => {
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    mock.timers.tick(step);
    await flush();
  }
};
const teardown = () => {
  for (const fn of [...(listeners.get(TEARDOWN) ?? [])]) fn(new Event(TEARDOWN));
};
const reset = (hostname: string) => {
  teardown();
  attrs.clear();
  calls = [];
  holdNext = false;
  fakeLocation.hostname = hostname;
};
const count = (fragment: string) => calls.filter(({ url }) => url.includes(fragment)).length;

const L1 = `0x${'a'.repeat(40)}`;
const API = 'https://mainnet.zklighter.elliot.ai';
const seedLighterSession = async () => {
  await window.fetch(`${API}/api/v1/account?by=l1_address&value=${L1}`, {
    headers: { authorization: '1:42:signed' },
  });
  await window.fetch(`${API}/api/v1/referral/points?l1_address=${L1}`);
  calls = [];
};

test('variational keeps the full schedule when no capture signal arrives', async () => {
  reset('omni.variational.io');
  variational.main();
  await advance(60_000);
  assert.equal(calls.length, 12 * 4 + 2);
  assert.equal(count('/api/rewards/vip'), 2);
});

test('variational stops firing once the page is marked captured', async () => {
  reset('omni.variational.io');
  variational.main();
  await advance(1_000);
  assert.equal(calls.length, 5);
  await advance(2_000);
  assert.equal(calls.length, 9);
  fakeDocument.documentElement.setAttribute(CAPTURED, '1');
  await advance(60_000);
  assert.equal(calls.length, 9);
});

test('variational teardown clears a capture mark so the next run starts over', async () => {
  reset('omni.variational.io');
  fakeDocument.documentElement.setAttribute(CAPTURED, '1');
  variational.main();
  await advance(10_000);
  assert.equal(calls.length, 0);
  teardown();
  fakeDocument.documentElement.removeAttribute(CAPTURED);
  variational.main();
  await advance(1_000);
  assert.equal(calls.length, 5);
});

test('lighter keeps the full schedule when no capture signal arrives', async () => {
  reset('app.lighter.xyz');
  lighter.main();
  await seedLighterSession();
  await advance(80_000);
  assert.equal(count('/referral/userReferrals'), 10);
  assert.equal(count('/api/v1/account?'), 3);
  assert.equal(count('/referral/get?'), 0);
});

test('lighter stops between requests of one round once captured', async () => {
  reset('app.lighter.xyz');
  lighter.main();
  await seedLighterSession();
  holdNext = true;
  await advance(2_000);
  assert.deepEqual(
    calls.map(({ url }) => new URL(url).pathname),
    ['/api/v1/referral/userReferrals'],
  );
  fakeDocument.documentElement.setAttribute(CAPTURED, '1');
  calls[0].settle();
  await advance(80_000);
  assert.equal(calls.length, 1);
});

test('lighter stops at the next round once captured', async () => {
  reset('app.lighter.xyz');
  lighter.main();
  await seedLighterSession();
  await advance(2_000);
  assert.equal(calls.length, 2);
  fakeDocument.documentElement.setAttribute(CAPTURED, '1');
  await advance(80_000);
  assert.equal(calls.length, 2);
  teardown();
});

test('lighter hook left wrapped by the page after teardown no longer records the session', async () => {
  reset('app.lighter.xyz');
  lighter.main();
  const hooked = window.fetch;
  const wrapper = (input: RequestInfo | URL, init?: RequestInit) => hooked(input, init);
  window.fetch = wrapper as typeof fetch;
  teardown();
  assert.equal(window.fetch, wrapper);
  await seedLighterSession();
  lighter.main();
  await advance(20_000);
  assert.equal(count('/referral/userReferrals'), 0);
  teardown();
  window.fetch = fakeFetch as typeof fetch;
  mock.timers.reset();
});
