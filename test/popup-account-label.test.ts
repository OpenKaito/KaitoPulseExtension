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
  assert.equal(accountLabelFor('binance', '1263592333'), '1263****2333');
  assert.equal(accountLabelFor('bybit', '589773246'), '5897****3246');
  assert.equal(accountLabelFor('gate', '60921775'), '60****75');
  assert.equal(accountLabelFor('variational', '1211cad0-8582-4802-b951-dbd56e0e2da7'), '1211****2da7');
});

test('a wallet address keeps its usual shortening', () => {
  assert.equal(accountLabelFor('lighter', '0xb381c6f56bb4842b725a34237946dbc6aa933518'), '0xb381…3518');
});

const { accountLabel } = await import('../src/popup/data/from-trading-summary.ts');

test('Polymarket and FOMO rows are named by their served display name', () => {
  assert.equal(
    accountLabel({ platform: 'fomo', accountId: 'b8d2fc11-0000-0000-0000-00000000bf0', displayName: 'PoorGoat' }),
    'PoorGoat',
  );
  assert.equal(
    accountLabel({ platform: 'polymarket', accountId: '0xed107a85a4585a381e48c7f7ca4144909e7dd2e5', displayName: 'Pranjal' }),
    'Pranjal',
  );
});

test('a blank name falls back to the id, and wallet platforms keep the address', () => {
  assert.equal(
    accountLabel({ platform: 'polymarket', accountId: '0xed107a85a4585a381e48c7f7ca4144909e7dd2e5', displayName: '  ' }),
    '0xed10…d2e5',
  );
  assert.equal(
    accountLabel({ platform: 'pumpfun', accountId: '4Be9CvxqSXY3bR1ndZxnWqmvG2x7Spv6hjXbVbiaha7t', displayName: 'degen' }),
    accountLabelFor('pumpfun', '4Be9CvxqSXY3bR1ndZxnWqmvG2x7Spv6hjXbVbiaha7t'),
  );
});

const { buildPlatformCluster } = await import('../src/shared/platform-cluster.ts');

test('four platforms show as marks; a fifth collapses them into a count', () => {
  assert.equal(buildPlatformCluster(['hyperliquid', 'polymarket', 'fomo', 'pumpfun']).collapsed, false);
  const five = buildPlatformCluster(['hyperliquid', 'polymarket', 'fomo', 'pumpfun', 'variational', 'variational']);
  assert.equal(five.collapsed, true);
  assert.equal(five.icons.length, 5);
});
