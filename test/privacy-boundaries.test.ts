import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { removePrimusInstallSideEffects } from '../scripts/primus-privacy.ts';
import { canAccessMessage } from '../src/background/message-access.ts';
import {
  clearDebugRequests,
  finishDebugRequest,
  getDebugRequestSnapshot,
  startDebugRequest,
} from '../src/background/debug-log.ts';

test('vendor install registers its identity and warms up the engine but reports nothing; updates still clean up', async () => {
  const source = 'chrome.runtime.onInstalled.addListener(async({reason:e,version:t})=>{if(e===chrome.runtime.OnInstalledReason.INSTALL){register();report({eventType:"EXTENSION_INSTALL",rawData:""}),start({reqMethodName:"start"})}else e===chrome.runtime.OnInstalledReason.UPDATE&&await chrome.storage.local.remove(["activeRequestAttestation"])})';
  let listener: (details: { reason: string }) => Promise<void>;
  const calls: unknown[] = [];
  vm.runInNewContext(removePrimusInstallSideEffects(source), {
    chrome: {
      runtime: {
        onInstalled: { addListener: (fn: typeof listener) => { listener = fn; } },
        OnInstalledReason: { INSTALL: 'install', UPDATE: 'update' },
      },
      storage: { local: { remove: (keys: string[]) => { calls.push([...keys]); } } },
    },
    register: () => calls.push('register'),
    report: () => calls.push('report'),
    start: () => calls.push('start'),
  });
  await listener!({ reason: 'install' });
  assert.deepEqual(calls, ['register', 'start']);
  await listener!({ reason: 'update' });
  assert.deepEqual(calls, ['register', 'start', ['activeRequestAttestation']]);
  assert.throws(() => removePrimusInstallSideEffects('changed vendor'), /mismatch/);
  assert.throws(() => removePrimusInstallSideEffects(source + source), /mismatch/);
});

test('diagnostics omit session, proof and attention payloads while retaining request status', () => {
  clearDebugRequests();
  for (const path of ['/sessions', '/proof/submit', '/attention/events']) {
    const id = startDebugRequest({
      source: 'extension-api', method: 'POST',
      url: `https://example.invalid/api/v1/extension${path}`,
      requestBody: { secret: 'synthetic', nested: 'private payload' },
    });
    finishDebugRequest(id, { status: 200, ok: true, responseBody: { sessionToken: 'synthetic' } });
  }
  for (const entry of getDebugRequestSnapshot().entries) {
    assert.equal(entry.status, 200);
    assert.equal(entry.requestBody, undefined);
    assert.equal(entry.responseBody, undefined);
  }
});

test('diagnostics redact nested secrets before truncation and keep ordinary debugging fields', () => {
  clearDebugRequests();
  const id = startDebugRequest({
    source: 'extension-api', method: 'GET',
    url: 'https://example.invalid/data?access_token=synthetic',
    requestBody: { count: 2, nested: { authorization: 'synthetic', fp: { ua: 'private' } } },
  });
  finishDebugRequest(id, { responseBody: { sessionToken: 'synthetic', padding: 'a'.repeat(210_000) } });
  const entry = getDebugRequestSnapshot().entries[0];
  assert.equal(JSON.stringify(entry).includes('synthetic'), false);
  assert.deepEqual(entry.requestBody, { count: 2, nested: { authorization: '[redacted]', fp: '[redacted]' } });
  clearDebugRequests();
  assert.deepEqual(getDebugRequestSnapshot().entries, []);
});

test('content scripts retain verification operations but cannot read privileged diagnostics', () => {
  const id = 'test-extension';
  const content = { id, url: 'https://kaito.ai/verification-hub', tab: { id: 1 } };
  const extension = { id, url: `chrome-extension://${id}/options.html` };
  for (const action of ['startProof', 'cancelProof', 'unbindPlatform', 'getState']) {
    assert.equal(canAccessMessage(action, content as chrome.runtime.MessageSender, id), true);
  }
  for (const action of ['getDebugRequests', 'exportLastAttestation', 'resetSession']) {
    assert.equal(canAccessMessage(action, content as chrome.runtime.MessageSender, id), false);
    assert.equal(canAccessMessage(action, extension, id), true);
  }
  assert.equal(canAccessMessage('getState', { id: 'another-extension' }, id), false);
  assert.equal(canAccessMessage('getDebugRequests', { id, url: 'https://test-extension/options.html' }, id), false);
});
