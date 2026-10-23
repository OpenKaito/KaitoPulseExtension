import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

const STUB = `data:text/javascript,${encodeURIComponent(
  'export const readJsonFromVerifierPage = (...args) => globalThis.__preflightRead(...args);',
)}`;
const ENV_STUB = `data:text/javascript,${encodeURIComponent('export const logDev = () => {};')}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './primus-adapter') return { url: STUB, shortCircuit: true };
    if (specifier === '@/lib/env') return { url: ENV_STUB, shortCircuit: true };
    if (specifier.startsWith('@/')) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { runVerifierPreflight, VerifierPreflightError } = await import(
  '../src/background/verifier-preflight.ts'
);

const X_ANALYTICS = { id: 'x_analytics_overview' } as never;
const PAGE = { status: 200, jfTag: 'AgE', body: 'YmluYXJ5' };

function readReturns(value: Record<string, unknown>): void {
  (globalThis as Record<string, unknown>).__preflightRead = async () => ({
    ok: true,
    status: 200,
    value,
  });
}

test('hands the creator-rewards page off with the X id the preflight checked', async () => {
  readReturns({ viewerId: '42', overview: { ok: true, status: 200, errors: [] }, creatorRewards: PAGE });
  const pages: unknown[] = [];
  await runVerifierPreflight(X_ANALYTICS, 'https://x.com/i/account_analytics', undefined, {
    linkedAccountId: '42',
    onXCreatorRewardsPage: (page) => pages.push(page),
  });
  assert.deepEqual(pages, [{ twitterId: '42', jfTag: 'AgE', body: 'YmluYXJ5' }]);
});

test('still hands the page off when the account is not Premium (that page is wanted too)', async () => {
  readReturns({
    viewerId: '42',
    overview: { ok: false, status: 200, errors: ['Authorization: Denied by access control'] },
    creatorRewards: PAGE,
  });
  const pages: unknown[] = [];
  await assert.rejects(
    runVerifierPreflight(X_ANALYTICS, 'https://x.com/i/account_analytics', undefined, {
      linkedAccountId: '42',
      onXCreatorRewardsPage: (page) => pages.push(page),
    }),
    (error: unknown) => error instanceof VerifierPreflightError && error.code === 'unsupported_account_type',
  );
  assert.equal(pages.length, 1);
});

test('does not hand off a page read as a different X account than the linked one', async () => {
  readReturns({ viewerId: '7', overview: { ok: true, status: 200, errors: [] }, creatorRewards: PAGE });
  const pages: unknown[] = [];
  await assert.rejects(
    runVerifierPreflight(X_ANALYTICS, 'https://x.com/i/account_analytics', undefined, {
      linkedAccountId: '42',
      onXCreatorRewardsPage: (page) => pages.push(page),
    }),
    (error: unknown) => error instanceof VerifierPreflightError && error.code === 'account_mismatch',
  );
  assert.equal(pages.length, 0);
});

test('reports an unread page instead of handing it off', async () => {
  for (const [creatorRewards, status] of [
    [null, undefined],
    [{ status: 403 }, 403],
  ] as const) {
    readReturns({ viewerId: '42', overview: { ok: true, status: 200, errors: [] }, creatorRewards });
    const pages: unknown[] = [];
    const unread: unknown[] = [];
    await runVerifierPreflight(X_ANALYTICS, 'https://x.com/i/account_analytics', undefined, {
      linkedAccountId: '42',
      onXCreatorRewardsPage: (page) => pages.push(page),
      onXCreatorRewardsUnread: (s) => unread.push(s),
    });
    assert.equal(pages.length, 0);
    assert.deepEqual(unread, [status]);
  }
});

test('reports nothing about the page when the X account is not the linked one', async () => {
  readReturns({ viewerId: '7', overview: { ok: true, status: 200, errors: [] }, creatorRewards: null });
  const unread: unknown[] = [];
  await assert.rejects(
    runVerifierPreflight(X_ANALYTICS, 'https://x.com/i/account_analytics', undefined, {
      linkedAccountId: '42',
      onXCreatorRewardsUnread: (s) => unread.push(s),
    }),
  );
  assert.equal(unread.length, 0);
});

test('the web app sees the page outcome next to the verification error', async () => {
  const { toExternalLastResult } = await import('../src/shared/messages.ts');
  const result = toExternalLastResult({
    verifierId: 'x_analytics_overview',
    requestId: 'r1',
    finishedAt: 1,
    creatorRewards: 'stored',
    error: { message: 'x_analytics_requires_premium', code: 'unsupported_account_type' },
  });
  assert.equal(result?.creatorRewards, 'stored');
  assert.equal(result?.ok, false);
  assert.equal(
    'creatorRewards' in (toExternalLastResult({ verifierId: 'v', requestId: 'r', finishedAt: 1 }) ?? {}),
    false,
  );
});
