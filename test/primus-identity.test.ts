import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { ensurePrimusIdentity } from '../src/background/primus-identity.ts';
import { removePrimusInstallSideEffects } from '../scripts/primus-privacy.ts';

const valid = JSON.stringify({ id: 'synthetic-id', token: 'synthetic-token' });
function setup(initial?: string, register?: () => Promise<void>) {
  let value = initial;
  let registrations = 0;
  Object.assign(globalThis, {
    chrome: { storage: { local: {
      get: async () => ({ userInfo: value }),
      remove: async () => { value = undefined; },
    } } },
    __kaitoInitializePrimusIdentity: async () => {
      registrations += 1;
      if (register) await register();
      else value = valid;
    },
  });
  return { count: () => registrations, value: () => value };
}

test('first verification initializes once; later verifications reuse the identity', async () => {
  const state = setup();
  await Promise.all([ensurePrimusIdentity(), ensurePrimusIdentity()]);
  assert.equal(state.count(), 1);
  assert.equal(state.value(), valid);
  await ensurePrimusIdentity();
  assert.equal(state.count(), 1);
});

test('an existing Primus identity does not register again', async () => {
  const state = setup(valid);
  await ensurePrimusIdentity();
  assert.equal(state.count(), 0);
});

test('malformed or incomplete identity is recovered before verification', async () => {
  for (const invalid of ['undefined', '{}', '{"id":"synthetic"}', 'null']) {
    const state = setup(invalid);
    await ensurePrimusIdentity();
    assert.equal(state.value(), valid);
    assert.equal(state.count(), 1);
  }
});

test('swallowed vendor registration failure rejects immediately and can be retried', async () => {
  const state = setup(undefined, async () => {});
  await assert.rejects(ensurePrimusIdentity(), /primus_identity_initialization_failed/);
  assert.equal(state.count(), 1);
  const recovered = setup();
  await ensurePrimusIdentity();
  assert.equal(recovered.count(), 1);
});

test('install drops only the telemetry; the exported initializer re-runs identity registration', async () => {
  const source = 'chrome.runtime.onInstalled.addListener(async({reason:e})=>{if(e===chrome.runtime.OnInstalledReason.INSTALL){register();report({eventType:"EXTENSION_INSTALL",rawData:""}),start({reqMethodName:"start"})}})';
  const calls: string[] = [];
  let listener!: (details: { reason: string }) => Promise<void>;
  const context = vm.createContext({
    chrome: { runtime: {
      onInstalled: { addListener: (fn: typeof listener) => { listener = fn; } },
      OnInstalledReason: { INSTALL: 'install' },
    } },
    register: async () => { calls.push('register'); },
    report: () => { calls.push('report'); },
    start: () => { calls.push('start'); },
  });
  vm.runInContext(removePrimusInstallSideEffects(source), context);
  await listener({ reason: 'install' });
  // The telemetry call is the only one the patch drops; identity and warm-up run.
  assert.deepEqual(calls, ['register', 'start']);
  await vm.runInContext('globalThis.__kaitoInitializePrimusIdentity()', context);
  assert.deepEqual(calls, ['register', 'start', 'register']);
});
