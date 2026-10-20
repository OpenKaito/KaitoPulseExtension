import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

const values = new Map<string, unknown>();
const privateValues = new Map<string, unknown>();
let failPrivateWrite = false;
let failPreference = false;
let preferenceGate: Promise<void> | undefined;
let preferenceStarted = () => {};
const item = (key: string, fallback: unknown = null) => ({
  getValue: async () => values.get(key) ?? fallback,
  setValue: async (value: unknown) => { values.set(key, value); },
  removeValue: async () => { values.delete(key); },
  watch: () => () => {},
});
const fixtures = {
  storage: {
    sessionItem: item('kaito.session'),
    meCacheItem: item('me'), lastResultItem: item('kaito.lastResult'),
    activeProofProgressItem: item('progress'), verifySnapshotItem: item('snapshot'),
    bootstrapFreshAtItem: item('fresh'),
    activityInsightsConsentItem: item('consent', 'unset'),
    activityInsightsDisablePendingItem: item('pending', false),
    attnFingerprintItem: item('fp'), deviceFingerprintItem: item('deviceFp'),
    attnPendingEventsItem: item('events', []), attnPendingServeEventsItem: item('serves', []),
    attnOpenSpanSnapshotItem: item('spans'),
  },
  privateStorage: {
    readPrivateValue: async (key: string) => privateValues.get(key),
    writePrivateValue: async (key: string, value: unknown) => {
      if (failPrivateWrite) throw new Error('disk unavailable');
      privateValues.set(key, value);
    },
    removePrivateValue: async (key: string) => { privateValues.delete(key); },
  },
  api: { putActivityInsightsPreference: async (_token: string, enabled: boolean) => {
    assert.equal(await fixtures.storage.activityInsightsConsentItem.getValue(), enabled ? 'granted' : 'declined');
    if (!enabled) assert.equal(values.has('fp'), false);
    const shouldFail = failPreference;
    preferenceStarted();
    await preferenceGate;
    if (shouldFail) throw new Error('offline');
    return { enabled };
  } },
  authedCall: (fn: (token: string) => unknown) => fn('synthetic'),
  updateActivityInsightsEnabled: async (enabled: boolean) => { values.set('serverEnabled', enabled); },
};
Object.assign(globalThis, {
  __privacyFixtures: fixtures,
  chrome: { storage: { local: {
    get: async (keys: string[]) => Object.fromEntries(keys.map((key) => [key, values.get(key)])),
    remove: async (key: string) => { values.delete(key); },
  } } },
});

const dataModule = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;
const fixtureModule = (group: string, keys: string[]) => dataModule(
  `export const {${keys.join(',')}} = globalThis.__privacyFixtures.${group};`,
);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/shared/storage' || (specifier === './storage' && context.parentURL?.includes('activity-consent'))) {
      return { url: fixtureModule('storage', Object.keys(fixtures.storage)), shortCircuit: true };
    }
    if (specifier === '@/background/private-storage') {
      return { url: fixtureModule('privateStorage', Object.keys(fixtures.privateStorage)), shortCircuit: true };
    }
    if (specifier === '@/lib/api') {
      return { url: dataModule('export const api = globalThis.__privacyFixtures.api;'), shortCircuit: true };
    }
    if (specifier === './worker-core') {
      return { url: dataModule('export const {authedCall,updateActivityInsightsEnabled} = globalThis.__privacyFixtures;'), shortCircuit: true };
    }
    if (specifier === '@/signal/logger') {
      return { url: dataModule('export const createLogger = () => ({error(){}});'), shortCircuit: true };
    }
    if (specifier === './authed-error') {
      return { url: dataModule('export const toAuthedError = () => ({error:"offline"});'), shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    if (specifier === './attention/buffer') return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});

test('existing sessions migrate without logout; failed migration retains recoverable credentials', async () => {
  const session = { sessionToken: 'synthetic', signedInAt: 123 };
  const attestation = { data: 'synthetic proof' };
  values.set('kaito.session', session);
  values.set('kaito.lastAttestation', attestation);
  values.set('kaito.lastResult', { verifierId: 'test', attestation });
  const storage = await import('../src/lib/client-storage.ts');
  failPrivateWrite = true;
  await assert.rejects(storage.getStoredSession(), /disk unavailable/);
  assert.deepEqual(values.get('kaito.session'), session);
  failPrivateWrite = false;
  assert.deepEqual(await storage.getStoredSession(), session);
  assert.deepEqual(values.get('kaito.session'), { signedInAt: 123 });
  assert.equal(values.has('kaito.lastAttestation'), false);
  assert.deepEqual(values.get('kaito.lastResult'), { verifierId: 'test' });
  assert.deepEqual(await storage.getLastAttestation(), attestation);
  await storage.setStoredSession({ sessionToken: 'replacement', signedInAt: 456 });
  assert.deepEqual(values.get('kaito.session'), { signedInAt: 456 });
  await storage.clearStoredSession();
  assert.equal(await storage.getStoredSession(), undefined);
  assert.equal(await storage.getLastAttestation(), undefined);
  assert.equal(values.has('kaito.session'), false);
});

test('failed opt-out purges data, blocks stale consent and queued writes, then allows explicit opt-in', async () => {
  const { handleSetActivityInsightsPreference } = await import('../src/background/activity-insights-handlers.ts');
  const { readActivityConsent } = await import('../src/shared/activity-consent.ts');
  const { recordAttentionEvents } = await import('../src/background/attention/buffer.ts');
  values.set('consent', 'granted');
  values.set('fp', { ua: 'synthetic' });
  values.set('deviceFp', 'synthetic');
  values.set('events', [{ eventId: 'old' }]);
  failPreference = true;
  const result = await handleSetActivityInsightsPreference(false);
  assert.ok(result.error);
  assert.deepEqual(values.get('events'), []);
  assert.equal(values.has('fp'), false);
  values.set('consent', 'granted');
  assert.equal(await readActivityConsent(), 'declined');
  await recordAttentionEvents([], [], { ua: 'late' } as never);
  assert.equal(values.has('fp'), false);
  failPreference = false;
  await handleSetActivityInsightsPreference(true);
  assert.equal(await readActivityConsent(), 'granted');
  await recordAttentionEvents([], [], { ua: 'new' } as never);
  assert.deepEqual(values.get('fp'), { ua: 'new' });
  await handleSetActivityInsightsPreference(false);
  assert.equal(await readActivityConsent(), 'declined');
  assert.equal(values.get('pending'), false);
});

test('an older opt-in response cannot undo a newer failed opt-out', async () => {
  const { handleSetActivityInsightsPreference } = await import('../src/background/activity-insights-handlers.ts');
  const { readActivityConsent } = await import('../src/shared/activity-consent.ts');
  let release!: () => void;
  preferenceGate = new Promise<void>((resolve) => { release = resolve; });
  const started = new Promise<void>((resolve) => { preferenceStarted = resolve; });
  failPreference = false;
  const enable = handleSetActivityInsightsPreference(true);
  await started;
  failPreference = true;
  const disable = handleSetActivityInsightsPreference(false);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(await readActivityConsent(), 'declined');
  release();
  await enable;
  assert.ok((await disable).error);
  assert.equal(await readActivityConsent(), 'declined');
  assert.equal(values.get('pending'), true);
  preferenceGate = undefined;
  preferenceStarted = () => {};
});
