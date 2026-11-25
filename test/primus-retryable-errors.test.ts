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
      return {
        ...loaded,
        source: `${loaded.source}\nexport { isRetryableAttestationError, isTransientInitAttestationError, isSlowTimeoutAttestationError };`,
      };
    }
    return loaded;
  },
});

Object.assign(globalThis, {
  chrome: { tabs: { onRemoved: { addListener() {} }, onUpdated: { addListener() {} } }, storage: { local: {} } },
});
const { isRetryableAttestationError, isTransientInitAttestationError, isSlowTimeoutAttestationError } =
  (await import('../src/background/primus-adapter.ts')) as unknown as {
    isRetryableAttestationError: (error: unknown) => boolean;
    isTransientInitAttestationError: (error: unknown) => boolean;
    isSlowTimeoutAttestationError: (error: unknown) => boolean;
  };

test('transient Primus and upstream failures are retried', () => {
  for (const message of [
    'primus_attestation_failed: 30004: {"retdesc":"ParseJsonError"}',
    'unknown_error 10003 run_client do_offline exception: [PrimusServerNetworkError] recv error',
    'timeout 00014 The process did not respond within 2 minutes. Please try again later.',
    '50003 run_client do_offline exception: [PlainThreadException]run plain client exception',
    '30001: run_client do_online exception: [ResponseException]response http status code error:429, url:app.okx.com/x',
    '30001: [ResponseException]response http status code error:503, url:www.bitget.com/v1/x',
  ]) {
    assert.equal(isRetryableAttestationError(new Error(message)), true, message);
  }
});

test('failures a retry cannot fix are not retried', () => {
  for (const message of [
    'target_data_missing 00013 Target data missing. Please check that the JSON path',
    '30001: [ResponseException]response http status code error:401, url:www.binance.com/bapi/x',
    '30001: [ResponseException]response http status code error:403, url:app.okx.com/x',
    'verifier_platform_not_supported:mexc',
  ]) {
    assert.equal(isRetryableAttestationError(new Error(message)), false, message);
  }
});

test('an uninitialised algorithm is a bounded transient retry, separate from the general set', () => {
  const err = new Error('primus_start_failed: primus_algorithm_not_initialized');
  assert.equal(isTransientInitAttestationError(err), true);
  assert.equal(isSlowTimeoutAttestationError(err), false);
  assert.equal(isRetryableAttestationError(err), false);
  assert.equal(isTransientInitAttestationError(new Error('primus_bridge_unavailable')), false);
  assert.equal(isTransientInitAttestationError(new Error('verification_interrupted: tab closed')), false);
});
