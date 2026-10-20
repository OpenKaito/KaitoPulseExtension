import assert from 'node:assert/strict';
import test from 'node:test';

import type { ExtensionVerifier } from '../src/shared/contracts.ts';
import { CATEGORY_TABS, buildTasks, consentFields, tasksInCategory } from '../src/verify/catalog.ts';

const NOW = 1_700_000_000_000;

const verifier = (over: Partial<ExtensionVerifier> & { id: string; platform: string }) => ({
  name: over.id,
  guide: { url: 'https://example.com/', message: 'Sign in.' },
  ...over,
});

const categoryOf = (id: string, verifiers: ExtensionVerifier[]): string | undefined =>
  buildTasks(verifiers, {}, NOW).find((t) => t.id === id)?.category;

test('the trading card carries the referral verification: no separate Polymarket, Variational or Lighter referral card', () => {
  const tasks = buildTasks(
    [
      verifier({ id: 'polymarket_wallet', platform: 'polymarket' }),
      verifier({ id: 'polymarket_referral', platform: 'polymarket', category: 'referral' }),
      verifier({ id: 'variational_portfolio', platform: 'variational', category: 'portfolio' }),
      verifier({ id: 'variational_referral', platform: 'variational', category: 'referral' }),
      verifier({ id: 'lighter_wallet', platform: 'lighter', category: 'wallet_ownership' }),
      verifier({ id: 'lighter_referral', platform: 'lighter', category: 'referral' }),
    ],
    {},
    NOW,
  );

  assert.deepEqual(
    tasksInCategory(tasks, 'trading')
      .filter((t) => t.verifier)
      .map((t) => t.id)
      .sort(),
    ['lighter_wallet', 'polymarket_wallet', 'variational_portfolio'],
  );
  assert.deepEqual(tasksInCategory(tasks, 'referral'), []);
});

test('an explicit non-referral category also overrides the platform default', () => {
  assert.equal(
    categoryOf('polymarket_social', [
      verifier({ id: 'polymarket_social', platform: 'polymarket', category: 'social' }),
    ]),
    'social',
  );
  assert.equal(
    categoryOf('x_trade', [verifier({ id: 'x_trade', platform: 'x', category: 'trading' })]),
    'trading',
  );
});

test('an absent category falls back to the platform catalog category', () => {
  assert.equal(
    categoryOf('x_analytics_overview', [
      verifier({ id: 'x_analytics_overview', platform: 'x' }),
    ]),
    'social',
  );
  assert.equal(
    categoryOf('polymarket_wallet', [verifier({ id: 'polymarket_wallet', platform: 'polymarket' })]),
    'trading',
  );
});

test("a platform with no catalog entry falls back to 'trading'", () => {
  assert.equal(
    categoryOf('axis_account', [verifier({ id: 'axis_account', platform: 'axis' })]),
    'trading',
  );
});

test('an unrecognised wire category does not move a card', () => {
  assert.equal(
    categoryOf('axis_account', [
      verifier({ id: 'axis_account', platform: 'axis', category: 'social_analytics' }),
    ]),
    'trading',
  );
  assert.equal(
    categoryOf('x_analytics_overview', [
      verifier({ id: 'x_analytics_overview', platform: 'x', category: 'social_analytics' }),
    ]),
    'social',
  );
  assert.equal(
    categoryOf('polymarket_wallet', [
      verifier({ id: 'polymarket_wallet', platform: 'polymarket', category: 'portfolio' }),
    ]),
    'trading',
  );
});

test('placeholder tasks carry a category too', () => {
  const tasks = buildTasks([], {}, NOW);
  assert.ok(tasks.length > 0);
  for (const task of tasks) {
    assert.ok(task.category, `${task.id} must resolve a category`);
  }
  assert.equal(tasks.find((t) => t.id === 'platform:polymarket')?.category, 'trading');
});

test('the tab strip gains Referral without reordering the rest', () => {
  assert.deepEqual(
    CATEGORY_TABS.map((t) => t.id),
    ['all', 'trading', 'social', 'referral'],
  );
});

test("the All tab keeps a task whose category has no tab", () => {
  const tasks = buildTasks([verifier({ id: 'x_ai', platform: 'x', category: 'ai' })], {}, NOW);
  assert.equal(tasks.find((t) => t.id === 'x_ai')?.category, 'ai');
  assert.deepEqual(tasksInCategory(tasks, 'all'), tasks);
});

test('each trading card\'s consent names the referral data it now carries', () => {
  const tasks = buildTasks(
    [
      verifier({ id: 'polymarket_wallet', platform: 'polymarket', category: 'wallet_ownership' }),
      verifier({ id: 'variational_portfolio', platform: 'variational', category: 'portfolio' }),
      verifier({ id: 'lighter_wallet', platform: 'lighter', category: 'wallet_ownership' }),
    ],
    {},
    NOW,
  );
  const verifies = (id: string) => String(tasks.find((t) => t.id === id)?.meta.detail.verifies);

  assert.match(verifies('polymarket_wallet'), /^Proxy wallet ownership · referral signups/);
  assert.match(verifies('variational_portfolio'), /^Account value .*referred users .*referred trading volume .*points$/);
  assert.match(verifies('lighter_wallet'), /^Wallet address · referred users .*read afterwards from Lighter$/);
});

test('perp trading verifiers land in Trading, the Hyperliquid referral card in Referral', () => {
  // The backend sends proof categories (`portfolio`, `wallet_ownership`), which
  // are not tabs, so these cards take the platform's category. lighter and
  // variational used to be `referral` platforms: lighter_wallet and
  // variational_portfolio sat in the Referral tab saying "Verify your referrals".
  const trading: Array<[string, string, string]> = [
    ['lighter_wallet', 'lighter', 'wallet_ownership'],
    ['variational_portfolio', 'variational', 'portfolio'],
  ];
  const referral: Array<[string, string]> = [['hyperliquid_referral', 'hyperliquid']];
  const tasks = buildTasks(
    [
      ...trading.map(([id, platform, category]) => verifier({ id, platform, category })),
      ...referral.map(([id, platform]) => verifier({ id, platform, category: 'referral' })),
    ],
    {},
    NOW,
  );
  const task = (id: string) => tasks.find((t) => t.id === id);
  const copy = (id: string) =>
    `${task(id)?.meta.cardTitle} ${task(id)?.meta.cardSubtitle} ${task(id)?.meta.detail.verifies}`;

  for (const [id] of trading) {
    assert.equal(task(id)?.category, 'trading', id);
    // lighter_wallet proves the address only; its numbers are read afterwards.
    if (id !== 'lighter_wallet') assert.match(String(task(id)?.meta.detail.verifies), /account value/i, id);
  }
  for (const [id] of referral) {
    assert.equal(task(id)?.category, 'referral', id);
    assert.match(copy(id), /referr/i, id);
    assert.doesNotMatch(copy(id), /account value|PnL|holdings|positions/i, `${id} inherited the trading copy`);
  }
  // A referral card whose wire has no category still goes to Referral.
  assert.equal(
    categoryOf('hyperliquid_referral', [verifier({ id: 'hyperliquid_referral', platform: 'hyperliquid' })]),
    'referral',
  );
  // Consent lists everything shared, including what is read after the ownership proof.
  assert.match(String(task('lighter_wallet')?.meta.detail.verifies), /^Wallet address · .*read afterwards from Lighter$/);
});

test('consent always names the stored account id, once', () => {
  assert.deepEqual(consentFields('Account value · holdings'), ['Account value', 'Holdings', 'Account ID']);
  assert.deepEqual(consentFields('Referred users · account ID'), ['Referred users', 'Account ID']);
  assert.equal(consentFields('Wallet address · positions').filter((f) => /account id/i.test(f)).length, 0);
});

test('a verified snapshot card offers an update; live and unverified cards do not', async () => {
  const { isSnapshotUpdate } = await import('../src/verify/catalog.ts');
  const proof = { proofId: 'p', verifiedAt: NOW } as never;
  const tasks = buildTasks(
    [
      verifier({ id: 'variational_portfolio', platform: 'variational', category: 'portfolio' }),
      verifier({ id: 'lighter_wallet', platform: 'lighter', category: 'wallet_ownership' }),
      verifier({ id: 'hyperliquid_referral', platform: 'hyperliquid', category: 'referral' }),
    ],
    {
      variational_portfolio: proof,
      lighter_wallet: proof,
      hyperliquid_referral: proof,
    },
    NOW,
  );
  const update = (id: string) => isSnapshotUpdate(tasks.find((t) => t.id === id)!);
  assert.equal(update('variational_portfolio'), true);
  // Lighter's value is read live from the proven address; nothing to refresh.
  assert.equal(update('lighter_wallet'), false);
  // A referral card on a snapshot platform keeps ✓ Verified.
  assert.equal(update('hyperliquid_referral'), false);
});
