import { hoverCardToFollowerStats, hoverCardToUserInfoData } from '@/signal/social-card-map';
import { buildXStatRow } from '@/signal/profile/x-stat-row';
import { hasServedTotals } from '@/signal/shared/totals';
import type {
  HoverCardCategory,
  HoverCardResult,
  HoverCardSocialFollowers,
  ProfileCardMode,
} from '@/shared/social-card';

const results: string[] = [];
function check(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  results.push(
    `${a === e ? 'PASS' : 'FAIL'}  ${label}${a === e ? '' : `\n        got ${a}\n        want ${e}`}`,
  );
}

const CRYPTO: HoverCardCategory = { key: 'crypto', label: 'Crypto', count: 300, rank: 7 };
const AI: HoverCardCategory = { key: 'ai', label: 'AI', count: 900, rank: 3 };
const EQUITY: HoverCardCategory = { key: 'equity_trading', label: 'Equity', count: 100, rank: 12 };

const FOLLOWERS: HoverCardSocialFollowers = {
  twitterId: '1',
  total: 48_200,
  verified: 880,
  active: 1_200,
  verifiedAt: '2026-08-13T00:00:00.000Z',
};

const TRADING = {
  accountValue: {
    bucket: '10M+',
    currency: 'USD',
    coveredAccounts: 1,
    totalAccounts: 1,
    coveredPlatforms: 1,
  },
  allTimePnl: {
    value: 9_097_494,
    currency: 'USD',
    coveredAccounts: 1,
    totalAccounts: 1,
    coveredPlatforms: 1,
    basis: 'platform_all_time' as const,
    completeness: 'complete',
    coversFrom: null,
    coversTo: null,
  },
  tradingPlatforms: ['hyperliquid'],
};

const card = (over: Partial<HoverCardResult>): HoverCardResult => ({
  twitterId: '1',
  smartFollowers: {
    total: 1_300,

    categories: [CRYPTO, AI, EQUITY],
    topSegment: AI,
    topFollowers: [],
  },
  hyperliquid: null,
  polymarket: null,
  meta: { partial: false, sources: { sf: 'ok', hyperliquid: 'ok', polymarket: 'ok' } },
  ...over,
});

function row(over: Partial<HoverCardResult>): {
  labels: string[];
  totals: boolean;
  hasHidden: boolean;
} {
  const built = buildXStatRow(hoverCardToUserInfoData(card(over)));
  return {
    labels: [...(built.total ? [built.total.label] : []), ...built.stats.map((s) => s.label)],
    totals: built.totals != null,
    hasHidden: built.hasHidden,
  };
}

function mode(m: ProfileCardMode, over: Partial<HoverCardResult> = {}): Partial<HoverCardResult> {
  return { profileCardMode: m, ...over };
}

check(
  'both -> Verified followers beside the two trading cells',
  row(mode('both', { ...TRADING, socialFollowers: FOLLOWERS })),
  { labels: ['Total Smart followers', 'Verified followers'], totals: true, hasHidden: true },
);

check(
  'trading_only -> the server-picked segment, not categories[0]',
  row(mode('trading_only', TRADING)),
  { labels: ['Total Smart followers', 'AI Smart followers'], totals: true, hasHidden: true },
);

check(
  'x_only -> segment + the verification pair, no trading cells',
  row(mode('x_only', { socialFollowers: FOLLOWERS })),
  {
    labels: [
      'Total Smart followers',
      'AI Smart followers',
      'Verified followers',
      'Active followers',
    ],
    totals: false,
    hasHidden: true,
  },
);

check('none -> the plain sector row', row(mode('none')), {
  labels: ['Total Smart followers', 'AI', 'Crypto', 'Equity'],
  totals: false,
  hasHidden: false,
});

check('mode absent -> falls back to inference, unchanged', row({ socialFollowers: FOLLOWERS }), {
  labels: ['Total Smart followers', 'AI Smart followers', 'Verified followers', 'Active followers'],
  totals: false,
  hasHidden: true,
});

check(
  'both with no verified count -> segment fills the cell, not a hole',
  row(mode('both', { ...TRADING, socialFollowers: { ...FOLLOWERS, verified: undefined } })),
  { labels: ['Total Smart followers', 'AI Smart followers'], totals: true, hasHidden: true },
);

check(
  'x_only with neither count -> categories fill all three cells',
  row(
    mode('x_only', { socialFollowers: { ...FOLLOWERS, verified: undefined, active: undefined } }),
  ),
  {
    labels: ['Total Smart followers', 'AI', 'Crypto', 'Equity'],
    totals: false,
    hasHidden: false,
  },
);

check(
  'topSegment absent -> category order untouched',
  row(
    mode('trading_only', {
      ...TRADING,
      smartFollowers: { total: 1_300, categories: [CRYPTO, AI], topFollowers: [] },
    }),
  ),
  { labels: ['Total Smart followers', 'Crypto Smart followers'], totals: true, hasHidden: true },
);

/*
 * Both header prefs default OFF (KEBS `?? false`), which reaches the wire as
 * `accountValue: null` / `allTimePnl: null` — while `tradingPlatforms` and the
 * platform cards below stay populated. The profile card KEEPS both cells then
 * (Account Value falls back to the `1+` floor, All-Time P&L to `-`); only the
 * name-tag popover drops a withheld figure, which is what `hasServedTotals`
 * gates.
 */
const WITHHELD = { accountValue: null, allTimePnl: null, tradingPlatforms: ['hyperliquid'] };

check(
  'both header fields withheld -> trading cells still hold their two slots',
  row(mode('both', { ...WITHHELD, socialFollowers: FOLLOWERS })),
  {
    labels: ['Total Smart followers', 'Verified followers'],
    totals: true,
    hasHidden: true,
  },
);

check(
  'Account Value alone -> still two cells, same row budget',
  row(
    mode('both', { ...WITHHELD, accountValue: TRADING.accountValue, socialFollowers: FOLLOWERS }),
  ),
  {
    labels: ['Total Smart followers', 'Verified followers'],
    totals: true,
    hasHidden: true,
  },
);

check(
  'All-Time P&L alone -> still two cells, same row budget',
  row(mode('both', { ...WITHHELD, allTimePnl: TRADING.allTimePnl, socialFollowers: FOLLOWERS })),
  {
    labels: ['Total Smart followers', 'Verified followers'],
    totals: true,
    hasHidden: true,
  },
);

const withheld = hoverCardToUserInfoData(card(mode('both', WITHHELD)));
check('withheld header -> totals object kept, both figures absent', withheld.totals, {
  platforms: ['hyperliquid'],
});
check(
  'withheld header -> nothing for the popover to serve',
  hasServedTotals(withheld.totals),
  false,
);
check(
  'withheld header does NOT withhold the platform cards',
  [withheld.hyperliquid != null, withheld.polymarket != null],
  [false, false],
);

/*
 * `smartFollowers: null` = the SF hop had nothing for this id, so there is no
 * total and no `topSegment` to name the segment cell after. The row is a fixed
 * 4-column grid: both cells keep their slots and read `-`, the same no-data
 * glyph the trading cells use, instead of leaving a hole at the end of the row.
 */
check(
  'no smart followers at all -> both SF cells hold their slots',
  row({ smartFollowers: null, ...WITHHELD }),
  { labels: ['Total Smart followers', 'Smart followers'], totals: true, hasHidden: false },
);

check(
  'no smart followers -> the Total cell reads the no-data dash',
  buildXStatRow(hoverCardToUserInfoData(card({ smartFollowers: null, ...WITHHELD }))).total,
  { label: 'Total Smart followers', value: '-' },
);

check(
  'no smart followers -> the segment placeholder reads the no-data dash',
  buildXStatRow(hoverCardToUserInfoData(card({ smartFollowers: null, ...WITHHELD }))).stats,
  [{ label: 'Smart followers', value: '-' }],
);

/* Design case 2 (`Trading show on X`) keeps its four cells even with no SF hop. */
check(
  'trading_only with no smart followers -> still four cells',
  row(mode('trading_only', { ...TRADING, smartFollowers: null })),
  { labels: ['Total Smart followers', 'Smart followers'], totals: true, hasHidden: false },
);

check(
  'no smart followers, X verified -> both counts render, nothing hidden behind a caret',
  row(mode('x_only', { smartFollowers: null, socialFollowers: FOLLOWERS })),
  {
    labels: ['Total Smart followers', 'Smart followers', 'Verified followers', 'Active followers'],
    totals: false,
    hasHidden: false,
  },
);

/*
 * The SF block can arrive with its numbers null: `total`, `count` and `rank` all
 * went nullable on the wire on 2026-08-25, and `null` there means "no data for
 * this id", not zero. The mapper used to call `toLocaleString` on them straight,
 * so one null threw inside `hoverCardToPopoverData` — which took down the hover
 * card ("Couldn't load data") and the whole profile module with it, since its
 * loader swallows the throw. Read the dash, and drop the rank rather than
 * printing `#null`.
 */
const nullCounts = hoverCardToUserInfoData(
  card({
    smartFollowers: {
      total: null,
      categories: [{ key: 'crypto', label: 'Crypto', count: null, rank: null }],
      topSegment: { key: 'crypto', label: 'Crypto', count: null, rank: null },
      topFollowers: [],
    },
  }),
);
check('SF total null -> the Total cell reads the no-data dash', nullCounts.smartFollowerTotal, {
  label: 'Total Smart followers',
  value: '-',
});
check(
  'a category count of null -> the dash, and no rank at all',
  nullCounts.smartFollowerCategories,
  [{ label: 'Crypto', value: '-' }],
);
check('top segment with null counts -> mapped, not `#null`', nullCounts.topSegment, {
  label: 'Crypto',
  value: '-',
});

check(
  'SF numbers null -> the row still names its segment cell',
  row({
    smartFollowers: {
      total: null,
      categories: [{ key: 'crypto', label: 'Crypto', count: null, rank: null }],
      topSegment: null,
      topFollowers: [],
    },
    ...WITHHELD,
  }),
  { labels: ['Total Smart followers', 'Crypto'], totals: true, hasHidden: false },
);

const noTrader = hoverCardToUserInfoData(
  card(mode('x_only', { accountValue: null, allTimePnl: null, tradingPlatforms: [] })),
);
check('no trading platforms at all -> no totals object', noTrader.totals, undefined);

const served = hoverCardToUserInfoData(card(mode('both', TRADING)));
check('served Account Value -> tier + label, no dash', served.totals?.accountValue, {
  tier: 8,
  label: '10M+',
  platforms: ['hyperliquid'],
});
check('served All-Time P&L -> signed figure', served.totals?.allTimePnl?.text, '+$9,097,494');
check('served All-Time P&L -> direction', served.totals?.allTimePnl?.direction, 'gain');
check('served header -> popover renders the row', hasServedTotals(served.totals), true);

const pnlOnly = hoverCardToUserInfoData(
  card(mode('both', { ...WITHHELD, allTimePnl: TRADING.allTimePnl })),
);
check(
  'P&L alone -> Account Value side stays absent on the wire',
  pnlOnly.totals?.accountValue,
  undefined,
);
check(
  'P&L alone -> popover still renders its one served cell',
  hasServedTotals(pnlOnly.totals),
  true,
);

const both = hoverCardToUserInfoData(
  card(mode('both', { ...TRADING, socialFollowers: FOLLOWERS })),
);
check('verified count read from socialFollowers', both.verifiedFollowers?.value, '880');
check('active count read from socialFollowers', both.activeFollowers?.value, '1,200');
check('X follower total never reaches the Total cell', both.smartFollowerTotal?.value, '1,300');
check('mode passed through to the view model', both.profileCardMode, 'both');
check('top segment mapped with its rank', both.topSegment, {
  label: 'AI',
  value: '900',
  rank: '#3',
});

const noSmartFollowers = hoverCardToFollowerStats(
  card({ smartFollowers: null, socialFollowers: FOLLOWERS }),
);
check(
  'native card renders the pair without smart followers',
  noSmartFollowers.verified?.value,
  '880',
);
check('… and with no sector rows', noSmartFollowers.categories.length, 0);

const unverified = hoverCardToFollowerStats(card({}));
check('no socialFollowers -> no verified row', unverified.verified, undefined);
check('… sectors still render', unverified.categories.length, 3);

console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
if (results.some((r) => r.startsWith('FAIL'))) process.exitCode = 1;
