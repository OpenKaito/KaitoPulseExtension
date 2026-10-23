import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (/\.png(\?|$)/.test(url)) return { format: 'module', source: 'export default "";', shortCircuit: true };
    return nextLoad(url, context);
  },
});

const { accountLabelFor } = await import('../src/popup/format/platforms.ts');

test('an exchange UID is masked like My Credentials, so the eye has something to reveal', () => {
  assert.equal(accountLabelFor('binance', '1234567890'), '1234****7890');
  assert.equal(accountLabelFor('bybit', '987654321'), '9876****4321');
  assert.equal(accountLabelFor('gate', '12345678'), '12****78');
  assert.equal(accountLabelFor('variational', '00000000-0000-4000-8000-00000000abcd'), '0000****abcd');
});

test('a wallet address keeps its usual shortening', () => {
  assert.equal(accountLabelFor('lighter', '0xabcdef0000000000000000000000000000abcdef'), '0xabcd…cdef');
});

const { accountLabel } = await import('../src/popup/data/from-trading-summary.ts');

test('Polymarket and FOMO rows are named by their served display name', () => {
  assert.equal(
    accountLabel({ platform: 'fomo', accountId: '00000000-0000-4000-8000-0000000000f0', displayName: 'Bramblegoat' }),
    'Bramblegoat',
  );
  assert.equal(
    accountLabel({ platform: 'polymarket', accountId: '0x2222222222222222222222222222222222222222', displayName: 'Marlowe' }),
    'Marlowe',
  );
});

test('a blank name falls back to the id, and wallet platforms keep the address', () => {
  assert.equal(
    accountLabel({ platform: 'polymarket', accountId: '0x2222222222222222222222222222222222222222', displayName: '  ' }),
    '0x2222…2222',
  );
  assert.equal(
    accountLabel({ platform: 'pumpfun', accountId: 'FxPump1111111111111111111111111111111111111', displayName: 'degen' }),
    accountLabelFor('pumpfun', 'FxPump1111111111111111111111111111111111111'),
  );
});

const { buildPlatformCluster } = await import('../src/shared/platform-cluster.ts');

test('four platforms show as marks; a fifth collapses them into a count', () => {
  assert.equal(buildPlatformCluster(['hyperliquid', 'polymarket', 'fomo', 'pumpfun']).collapsed, false);
  const five = buildPlatformCluster(['hyperliquid', 'polymarket', 'fomo', 'pumpfun', 'variational', 'variational']);
  assert.equal(five.collapsed, true);
  assert.equal(five.icons.length, 5);
});
