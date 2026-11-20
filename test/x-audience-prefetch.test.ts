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
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z]+$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const { runVerifierPreflight, VerifierPreflightError } = await import(
  '../src/background/verifier-preflight.ts'
);
const { isSupportedPrefetchOperation } = await import('../src/verify/x-graphql-prefetch.ts');

const AUDIENCE = { id: 'x_analytics_audience' } as never;
const PAGE = { status: 200, jfTag: 'AgE', body: 'YmluYXJ5' };
const GUIDE = 'https://x.com/i/account_analytics/audience';

function readReturns(value: Record<string, unknown>): void {
  (globalThis as Record<string, unknown>).__preflightRead = async () => ({ ok: true, status: 200, value });
}

test('audience prefetch operation is registered', () => {
  assert.equal(isSupportedPrefetchOperation('audienceOverviewDataQuery'), true);
  assert.equal(isSupportedPrefetchOperation('accountOverviewDailyQuery'), true);
  assert.equal(isSupportedPrefetchOperation('notARealOperation'), false);
});

test('audience preflight does NOT cross-check the linked account (unlike overview)', async () => {
  // Signed in as a different X than the Kaito-linked one: the overview verifier
  // throws account_mismatch here; audience has no crossCheckPrivyIdentity, so it
  // must pass. It also must not hand off the creator-rewards page.
  readReturns({ viewerId: '7', overview: { ok: true, status: 200, errors: [] }, creatorRewards: PAGE });
  const pages: unknown[] = [];
  await runVerifierPreflight(AUDIENCE, GUIDE, undefined, {
    linkedAccountId: '42',
    onXCreatorRewardsPage: (page) => pages.push(page),
  });
  assert.equal(pages.length, 0);
});

test('audience preflight still gates on Premium', async () => {
  readReturns({
    viewerId: '42',
    overview: { ok: false, status: 200, errors: ['Authorization: Denied by access control'] },
  });
  await assert.rejects(
    runVerifierPreflight(AUDIENCE, GUIDE, undefined, { linkedAccountId: '42' }),
    (error: unknown) =>
      error instanceof VerifierPreflightError && error.code === 'unsupported_account_type',
  );
});

test('audience preflight still requires a signed-in x.com session', async () => {
  readReturns({ reason: 'not_signed_in' });
  await assert.rejects(
    runVerifierPreflight(AUDIENCE, GUIDE, undefined, {}),
    (error: unknown) =>
      error instanceof VerifierPreflightError && error.code === 'third_party_login_required',
  );
});
