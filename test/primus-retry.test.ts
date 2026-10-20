import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import vm from 'node:vm';
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
      return { ...loaded, source: `${loaded.source}\nexport { executeAttestation };` };
    }
    return loaded;
  },
});

const timers = new Map<number, () => void>();
const messages = new Set<(event: unknown) => void>();
const teardown = new Set<() => void>();
let timerId = 0;
let posted = 0;
const schedule = (fn: () => void) => { timers.set(++timerId, fn); return timerId; };
const clear = (id: number) => { timers.delete(id); };
const page = {
  location: { href: 'https://polymarket.com/portfolio' },
  setTimeout: schedule,
  setInterval: schedule,
  addEventListener: (_: string, fn: (event: unknown) => void) => messages.add(fn),
  removeEventListener: (_: string, fn: (event: unknown) => void) => messages.delete(fn),
  postMessage: () => { posted += 1; },
};
const chrome = {
  tabs: { onRemoved: { addListener() {} }, onUpdated: { addListener() {} } },
  storage: { local: { set: async () => {} } },
  scripting: { executeScript: async ({ func, args }: { func: Function; args: unknown[] }) => {
    const result = await vm.runInNewContext(`(${func.toString()})(...args)`, {
      args, chrome, window: page, location: page.location, console: { log() {} },
      clearTimeout: clear, clearInterval: clear,
      document: {
        addEventListener: (_: string, fn: () => void) => teardown.add(fn),
        removeEventListener: (_: string, fn: () => void) => teardown.delete(fn),
      },
    });
    return [{ result }];
  } },
};
Object.assign(globalThis, { chrome });
const { executeAttestation } = await import('../src/background/primus-adapter.ts') as unknown as {
  executeAttestation: (tabId: number, payload: unknown) => Promise<unknown>;
};
const send = (name: string, params: unknown) => {
  for (const fn of messages) fn({ data: { target: 'padoZKAttestationJSSDK', name, params } });
};
const ready = () => new Promise<void>((resolve) => setImmediate(resolve));

test('failed attempt removes capture timers and listeners; a second attempt can succeed', async () => {
  const first = executeAttestation(1, { attRequest: {} });
  const rejected = assert.rejects(first, /synthetic_failure/);
  await ready();
  send('initAttestationRes', { result: true });
  const staleCallbacks = [...timers.values()];
  send('startAttestationRes', { result: false, errorData: { code: 'synthetic_failure' } });
  await rejected;
  assert.equal(timers.size, 0);
  assert.equal(messages.size, 0);
  assert.equal(teardown.size, 0);
  const count = posted;
  // A queued trigger can outlive clearTimeout once its callback has been dispatched.
  staleCallbacks.at(-1)?.();
  assert.equal(posted, count);

  const second = executeAttestation(2, { attRequest: {} });
  await ready();
  send('initAttestationRes', { result: true });
  send('startAttestationRes', { result: true, data: { proof: 'synthetic' } });
  assert.equal((await second as { proof: string }).proof, 'synthetic');
  assert.equal(timers.size, 0);
  assert.equal(messages.size, 0);
});

test('runtime teardown settles the page bridge before the next retry', async () => {
  const attempt = executeAttestation(3, { attRequest: {} });
  const rejected = assert.rejects(attempt, /verification_interrupted/);
  await ready();
  send('initAttestationRes', { result: true });
  for (const fn of teardown) fn();
  await rejected;
  assert.equal(timers.size, 0);
  assert.equal(messages.size, 0);
  assert.equal(teardown.size, 0);
});
