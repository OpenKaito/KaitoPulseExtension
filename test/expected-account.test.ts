import assert from 'node:assert/strict';
import test from 'node:test';

const store = new Map<string, unknown>();
(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    session: {
      set: async (items: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(items)) store.set(k, v);
      },
      get: async (key: string) => (store.has(key) ? { [key]: store.get(key) } : {}),
      remove: async (key: string) => {
        store.delete(key);
      },
    },
  },
};

const {
  NEW_ACCOUNT_INTENT,
  cleanExpectedAccountId,
  clearExpectedAccount,
  expectedAccountFor,
  setExpectedAccount,
  updatesExistingAccount,
} =
  await import('../src/background/expected-account.ts');

test('Update stores the account for its verifier only', async () => {
  await setExpectedAccount('variational_portfolio', 'company-a');
  assert.equal(await expectedAccountFor('variational_portfolio'), 'company-a');
  assert.equal(await expectedAccountFor('okx_asset_history'), undefined);
});

test('a plain verify clears the expectation, so Verify another account stays free', async () => {
  await setExpectedAccount('variational_portfolio', 'company-a');
  await setExpectedAccount('variational_portfolio', undefined);
  assert.equal(await expectedAccountFor('variational_portfolio'), undefined);
});

test('clearing after a successful submit only touches that verifier', async () => {
  await setExpectedAccount('variational_portfolio', 'company-a');
  await clearExpectedAccount('okx_asset_history');
  assert.equal(await expectedAccountFor('variational_portfolio'), 'company-a');
  await clearExpectedAccount('variational_portfolio');
  assert.equal(await expectedAccountFor('variational_portfolio'), undefined);
});

test('an expectation older than 30 minutes is dropped', async () => {
  await setExpectedAccount('variational_portfolio', 'company-a');
  const stored = store.get('kaito.expectedAccount') as { at: number };
  stored.at -= 31 * 60 * 1000;
  assert.equal(await expectedAccountFor('variational_portfolio'), undefined);
});

test('only a short non-empty string from the page is accepted', () => {
  assert.equal(cleanExpectedAccountId('  company-a '), 'company-a');
  assert.equal(cleanExpectedAccountId(''), undefined);
  assert.equal(cleanExpectedAccountId(42), undefined);
  assert.equal(cleanExpectedAccountId('x'.repeat(300)), undefined);
});

test('Verify another account forwards its intent untouched and is not an Update', async () => {
  await setExpectedAccount('variational_portfolio', cleanExpectedAccountId(NEW_ACCOUNT_INTENT));
  assert.equal(await expectedAccountFor('variational_portfolio'), NEW_ACCOUNT_INTENT);
  assert.equal(updatesExistingAccount(NEW_ACCOUNT_INTENT), false);
  assert.equal(updatesExistingAccount(undefined), false);
  assert.equal(updatesExistingAccount('company-a'), true);
});
