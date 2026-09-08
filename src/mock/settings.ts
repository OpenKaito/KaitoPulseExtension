import { storage } from 'wxt/utils/storage';

export type MockScenario = 'live' | 'data' | 'empty' | 'onboarding';

export type MockTotals = 'off' | 'filled' | 'hidden';

export type MockFollowers = 'off' | 'filled' | 'zero';

export type MockHyperliquid = 'off' | 'fill' | 'force';

export type MockPolymarket = 'off' | 'fill' | 'force';

export type MockWalletDetail = 'off' | 'served' | 'withheld';

export type MockWallets =
  | 'off'
  | 'mixed'
  | 'anon'
  | 'no-totals'
  | 'no-series'
  | 'av-only'
  | 'pnl-only';

export type MockProfileCardScenario =
  | 'live'
  | 'both_verified'
  | 'trading_only'
  | 'x_verified_only'
  | 'unverified';

export type MockProfileMode = 'off' | 'both' | 'trading_only' | 'x_only' | 'none';

export interface MockConfig {
  popup: MockScenario;

  hoverCardTotals: MockTotals;

  hoverCardFollowers: MockFollowers;

  hoverCardHyperliquid: MockHyperliquid;

  hoverCardPolymarket: MockPolymarket;

  hoverCardWalletDetail: MockWalletDetail;

  hoverCardWallets: MockWallets;

  hoverCardScenario: MockProfileCardScenario;

  hoverCardProfileMode: MockProfileMode;

  hoverCardScope: string;
}

export const MOCK_DEFAULTS: MockConfig = {
  popup: 'live',
  hoverCardTotals: 'off',
  hoverCardFollowers: 'off',
  hoverCardHyperliquid: 'off',
  hoverCardPolymarket: 'off',
  hoverCardWalletDetail: 'off',
  hoverCardWallets: 'off',
  hoverCardScenario: 'live',
  hoverCardProfileMode: 'off',
  hoverCardScope: '',
};

const mockConfigItem = storage.defineItem<MockConfig>('local:kaito.mock.config', {
  fallback: MOCK_DEFAULTS,
});

let cached: MockConfig = MOCK_DEFAULTS;

export function mockConfig(): MockConfig {
  return cached;
}

export async function loadMockConfig(): Promise<MockConfig> {
  try {
    cached = { ...MOCK_DEFAULTS, ...(await mockConfigItem.getValue()) };
  } catch {}
  return cached;
}

export async function updateMockConfig(patch: Partial<MockConfig>): Promise<MockConfig> {
  cached = { ...cached, ...patch };
  await mockConfigItem.setValue(cached);
  return cached;
}

export function watchMockConfig(cb: (config: MockConfig) => void): () => void {
  void loadMockConfig().then(cb);
  return mockConfigItem.watch((value) => {
    cached = { ...MOCK_DEFAULTS, ...value };
    cb(cached);
  });
}

export type MockPreviewTone = 'value' | 'muted' | 'ghost' | 'up';

export interface MockPreviewLine {
  key: string;
  value: string;
  tone: MockPreviewTone;
}

export interface MockPreviewChip {
  text: string;
  tone: MockPreviewTone;
}

export interface MockPreview {
  lines?: MockPreviewLine[];

  chips?: MockPreviewChip[];

  cells?: MockPreviewChip[];
}

export interface MockOption {
  value: string;

  label?: string;

  note: string;

  preview?: MockPreview;
}

export interface MockSwitch {
  key: keyof MockConfig;
  label: string;

  group: string;

  rest: string;
  description: string;

  kind: 'select' | 'text';
  options?: MockOption[];
  placeholder?: string;
}

export interface MockScenarioPreset {
  id: string;
  name: string;

  blurb: string;

  patch: Partial<MockConfig>;
}

export const MOCK_SWITCHES: MockSwitch[] = [
  {
    key: 'popup',
    label: 'Popup snapshot',
    group: 'Popup',
    rest: 'live',
    description:
      'Which snapshot the popup renders. The populated fixture also forces the X-linked and ' +
      'trading-verified gates open and skips every fetch overlay, so all four tabs render on an ' +
      'account that has none of it.',
    kind: 'select',
    options: [
      {
        value: 'live',
        note: 'the real backend',
        preview: { lines: [{ key: 'tabs', value: 'real', tone: 'muted' }] },
      },
      {
        value: 'data',
        note: 'fully-populated fixture, gates forced open',
        preview: {
          lines: [
            { key: 'tabs', value: '4 populated', tone: 'value' },
            { key: 'gates', value: 'forced open', tone: 'value' },
          ],
        },
      },
      {
        value: 'empty',
        note: 'onboarded, nothing to show',
        preview: {
          lines: [
            { key: 'tabs', value: '4 empty', tone: 'value' },
            { key: 'gates', value: 'open', tone: 'muted' },
          ],
        },
      },
      {
        value: 'onboarding',
        note: 'the "Complete your Aura setup" wall',
        preview: { lines: [{ key: 'screen', value: 'setup wall', tone: 'value' }] },
      },
    ],
  },
  {
    key: 'hoverCardScenario',
    label: 'User-visible state',
    group: 'Profile card on X',
    rest: 'live',
    description:
      'Selects one complete Profile Card state from the design. Each state owns its Smart Follower ' +
      'counts, X verification, trading totals and profileCardMode, so it never depends on a live response.',
    kind: 'select',
    options: [
      {
        value: 'live',
        label: 'Live',
        note: 'the backend response, unchanged',
        preview: { lines: [{ key: 'state', value: 'backend', tone: 'muted' }] },
      },
      {
        value: 'both_verified',
        label: 'Both verified',
        note: 'Trading and X verified; extra follower data is available on hover',
        preview: {
          cells: [
            { text: 'Total Smart Followers', tone: 'value' },
            { text: 'Verified Followers', tone: 'value' },
            { text: 'Account Value', tone: 'value' },
            { text: 'All Time P&L', tone: 'up' },
          ],
        },
      },
      {
        value: 'trading_only',
        label: 'Trading on X',
        note: 'Trading shown on X, with no X verification',
        preview: {
          cells: [
            { text: 'Total Smart Followers', tone: 'value' },
            { text: 'Top Smart Followers', tone: 'value' },
            { text: 'Account Value', tone: 'value' },
            { text: 'All Time P&L', tone: 'up' },
          ],
        },
      },
      {
        value: 'x_verified_only',
        label: 'X verified only',
        note: 'X verified, with no trading surface',
        preview: {
          cells: [
            { text: 'Total Smart Followers', tone: 'value' },
            { text: 'Top Smart Followers', tone: 'value' },
            { text: 'Verified', tone: 'value' },
            { text: 'Active', tone: 'value' },
          ],
        },
      },
      {
        value: 'unverified',
        label: 'Not verified',
        note: 'No X verification or trading; category ranking only',
        preview: {
          cells: [
            { text: 'Total Smart Followers', tone: 'value' },
            { text: 'Crypto', tone: 'value' },
            { text: 'AI', tone: 'value' },
            { text: 'Equity Trading', tone: 'value' },
          ],
        },
      },
    ],
  },
  {
    key: 'hoverCardTotals',
    label: 'Payload: totals',
    group: 'Advanced payload overrides',
    rest: 'off',
    description:
      'Overrides Account Value and All-Time P&L, and nothing else — the rest of the card stays ' +
      'whatever the backend returned, so a break elsewhere on it still shows. The two numbers ' +
      'are governed by one pref each, so they hide independently; the platform list and the ' +
      'platform blocks are never affected. On the profile card both cells stay put — a withheld ' +
      'Account Value and a withheld All-Time P&L each render `-`; only the ' +
      'name-tag popover drops the withheld cell.',
    kind: 'select',
    options: [
      {
        value: 'off',
        note: 'real values',
        preview: {
          lines: [
            { key: 'Acct value', value: 'real', tone: 'muted' },
            { key: 'All-time P&L', value: 'real', tone: 'muted' },
          ],
        },
      },
      {
        value: 'filled',
        note: 'a $10M+ whale',
        preview: {
          lines: [
            { key: 'Acct value', value: '$10.4M', tone: 'value' },
            { key: 'All-time P&L', value: '+$9.1M', tone: 'up' },
          ],
        },
      },
      {
        value: 'hidden',
        note: 'both numbers nulled, platform list kept — an owner who turned their totals off',
        preview: {
          lines: [
            { key: 'Acct value', value: '1+ floor', tone: 'ghost' },
            { key: 'All-time P&L', value: '—', tone: 'ghost' },
            { key: 'Platforms', value: 'HL · PM', tone: 'muted' },
          ],
        },
      },
    ],
  },
  {
    key: 'hoverCardFollowers',
    label: 'Payload: X followers',
    group: 'Advanced payload overrides',
    rest: 'off',
    description: 'Fills the two X-verification follower counts, which no dev backend returns.',
    kind: 'select',
    options: [
      {
        value: 'off',
        note: 'real values',
        preview: {
          lines: [
            { key: 'Verified', value: 'real', tone: 'muted' },
            { key: 'Active', value: 'real', tone: 'muted' },
          ],
        },
      },
      {
        value: 'filled',
        note: '880 verified / 1,200 active',
        preview: {
          lines: [
            { key: 'Verified', value: '880', tone: 'value' },
            { key: 'Active', value: '1,200', tone: 'value' },
          ],
        },
      },
      {
        value: 'zero',
        note:
          'both counts 0 — a REAL answer, not a missing one, and it must render differently from ' +
          'the absent case',
        preview: {
          lines: [
            { key: 'Verified', value: '0', tone: 'value' },
            { key: 'Active', value: '0', tone: 'value' },
          ],
        },
      },
    ],
  },
  {
    key: 'hoverCardHyperliquid',
    label: 'Payload: Hyperliquid block',
    group: 'Advanced payload overrides',
    rest: 'off',
    description:
      'Substitutes a synthetic Hyperliquid account — 3 open positions, one with no liquidation ' +
      'price. It also marks the account on /badges, so the name-tag pill and the card agree ' +
      'instead of disagreeing about whether the user trades there.',
    kind: 'select',
    options: [
      {
        value: 'off',
        note: 'real block',
        preview: { lines: [{ key: 'Hyperliquid', value: 'backend', tone: 'muted' }] },
      },
      {
        value: 'fill',
        note: 'only when the backend returned none',
        preview: {
          lines: [
            { key: 'Hyperliquid', value: 'if absent', tone: 'ghost' },
            { key: 'Positions', value: '3', tone: 'value' },
          ],
        },
      },
      {
        value: 'force',
        note: 'always replace what came back',
        preview: {
          lines: [
            { key: 'Hyperliquid', value: 'synthetic', tone: 'value' },
            { key: 'Positions', value: '3 (1 no liq.)', tone: 'value' },
          ],
        },
      },
    ],
  },
  {
    key: 'hoverCardPolymarket',
    label: 'Payload: Polymarket block',
    group: 'Advanced payload overrides',
    rest: 'off',
    description:
      'Substitutes a synthetic Polymarket account — a named profile, 3 open markets (one losing) ' +
      'and the six P&L windows. No dev backend returns one, so without this the platform card, ' +
      'the markets table, Predictions and the chip identity are unreachable locally. Pair it with ' +
      'wallet visibility "mixed" to see the chip carry Polymarket\'s own name and avatar.',
    kind: 'select',
    options: [
      {
        value: 'off',
        note: 'real block',
        preview: { lines: [{ key: 'Polymarket', value: 'backend', tone: 'muted' }] },
      },
      {
        value: 'fill',
        note: 'only when the backend returned none',
        preview: {
          lines: [
            { key: 'Polymarket', value: 'if absent', tone: 'ghost' },
            { key: 'Markets', value: '3', tone: 'value' },
          ],
        },
      },
      {
        value: 'force',
        note: 'always replace what came back',
        preview: {
          lines: [
            { key: 'Polymarket', value: 'synthetic', tone: 'value' },
            { key: 'Markets', value: '3 (1 losing)', tone: 'value' },
            { key: 'P&L windows', value: '6', tone: 'muted' },
          ],
        },
      },
    ],
  },
  {
    key: 'hoverCardWalletDetail',
    label: 'Wallet detail: the chip drawer',
    group: 'Advanced payload overrides',
    rest: 'off',
    description:
      'Answers POST /wallet-detail for every chip. The fixture serves seven Hyperliquid ' +
      'positions and five Polymarket markets — more than the hover card previews — so a drawer ' +
      'still showing three rows is reading the preview block instead of the wallet.',
    kind: 'select',
    options: [
      {
        value: 'off',
        note: 'real endpoint',
        preview: { lines: [{ key: 'Source', value: 'backend', tone: 'muted' }] },
      },
      {
        value: 'served',
        note: 'every chip resolves',
        preview: {
          lines: [
            { key: 'Hyperliquid', value: '7 positions', tone: 'value' },
            { key: 'Polymarket', value: '5 markets', tone: 'value' },
            { key: 'Figures', value: 'per address', tone: 'value' },
          ],
        },
      },
      {
        value: 'withheld',
        note: 'the deliberate 404',
        preview: {
          lines: [
            { key: 'Outcome', value: 'withheld', tone: 'value' },
            { key: 'Drawer', value: 'says so', tone: 'muted' },
          ],
        },
      },
    ],
  },
  {
    key: 'hoverCardWallets',
    label: 'Wallet detail: visibility',
    group: 'Advanced payload overrides',
    rest: 'off',
    description:
      'Every variant publishes three wallets per platform at ordinals 1, 2 and 5 — the gap is ' +
      'deliberate, because hiding a wallet must not renumber another. Only one wallet has served ' +
      'detail, so the others must say so rather than draw zeroes.',
    kind: 'select',
    options: [
      {
        value: 'off',
        note: 'real wallets',
        preview: {
          chips: [
            { text: '0xA1…9f', tone: 'value' },
            { text: '0xB2…c4', tone: 'value' },
            { text: '0xC5…7e', tone: 'value' },
          ],
        },
      },
      {
        value: 'mixed',
        note: 'first address revealed, the rest anonymous',
        preview: {
          chips: [
            { text: '0xA1…9f', tone: 'value' },
            { text: 'Address 2', tone: 'ghost' },
            { text: 'Address 5', tone: 'ghost' },
          ],
        },
      },
      {
        value: 'anon',
        note: 'every address withheld — every chip reads "Address n", no explorer link',
        preview: {
          chips: [
            { text: 'Address 1', tone: 'ghost' },
            { text: 'Address 2', tone: 'ghost' },
            { text: 'Address 5', tone: 'ghost' },
          ],
        },
      },
      {
        value: 'no-totals',
        note: 'wallets, but no platform totals',
        preview: {
          lines: [
            { key: 'Wallets', value: '1 · 2 · 5', tone: 'value' },
            { key: 'Platform totals', value: '—', tone: 'ghost' },
          ],
        },
      },
      {
        value: 'no-series',
        note: 'platform totals, but no platform PnL curve — the card keeps its figures, drops its chart',
        preview: {
          lines: [
            { key: 'Platform totals', value: '$455K · -$14K', tone: 'value' },
            { key: 'Platform chart', value: 'no points', tone: 'ghost' },
          ],
        },
      },
      {
        value: 'av-only',
        note: 'Account Value published, All-Time P&L nulled',
        preview: {
          lines: [
            { key: 'Acct value', value: '$1.2M', tone: 'value' },
            { key: 'All-time P&L', value: '—', tone: 'ghost' },
          ],
        },
      },
      {
        value: 'pnl-only',
        note: 'All-Time P&L published, Account Value nulled',
        preview: {
          lines: [
            { key: 'Acct value', value: '—', tone: 'ghost' },
            { key: 'All-time P&L', value: '+$310K', tone: 'up' },
          ],
        },
      },
    ],
  },
  {
    key: 'hoverCardProfileMode',
    label: 'Payload: profileCardMode',
    group: 'Advanced payload overrides',
    rest: 'off',
    description:
      'Low-level response shaping for API compatibility tests. Selecting an advanced override exits ' +
      'the complete user-visible state above; use it only when deliberately testing a payload edge case.',
    kind: 'select',
    options: [
      {
        value: 'off',
        note: 'whatever the backend judged',
        preview: { lines: [{ key: 'cells', value: 'as returned', tone: 'muted' }] },
      },
      {
        value: 'both',
        note: 'trading and X verification — Active and categories remain in the follower hover',
        preview: {
          cells: [
            { text: 'Total Smart Followers', tone: 'value' },
            { text: 'Verified Followers', tone: 'value' },
            { text: 'Account Value', tone: 'value' },
            { text: 'All Time P&L', tone: 'up' },
          ],
        },
      },
      {
        value: 'trading_only',
        note: 'trading shown on X, no X verification',
        preview: {
          cells: [
            { text: 'Total Smart Followers', tone: 'value' },
            { text: 'Top Smart Followers', tone: 'value' },
            { text: 'Account Value', tone: 'value' },
            { text: 'All Time P&L', tone: 'up' },
          ],
        },
      },
      {
        value: 'x_only',
        note: 'X verified, no trading surface — category, Verified and Active fill those cells',
        preview: {
          cells: [
            { text: 'Total Smart Followers', tone: 'value' },
            { text: 'Top Smart Followers', tone: 'value' },
            { text: 'Verified', tone: 'value' },
            { text: 'Active', tone: 'value' },
          ],
        },
      },
      {
        value: 'none',
        note: 'neither; the plain Smart Follower category row',
        preview: {
          cells: [
            { text: 'Total Smart Followers', tone: 'value' },
            { text: 'Crypto', tone: 'value' },
            { text: 'AI', tone: 'value' },
            { text: 'Equity Trading', tone: 'value' },
          ],
        },
      },
    ],
  },
  {
    key: 'hoverCardScope',
    label: 'Scope',
    group: 'Where to apply',
    rest: '',
    description:
      'Which accounts every hover-card override above applies to. Use it to mock ONE account, so ' +
      'the mocked card can be compared against a real one on the same timeline.',
    kind: 'text',
    placeholder: 'all cards — or 1234567890,987654321',
  },
];

const NO_HOVER_CARD_OVERRIDES = {
  hoverCardTotals: 'off',
  hoverCardFollowers: 'off',
  hoverCardHyperliquid: 'off',
  hoverCardPolymarket: 'off',
  hoverCardWalletDetail: 'off',
  hoverCardWallets: 'off',
  hoverCardScenario: 'live',
  hoverCardProfileMode: 'off',
} as const satisfies Partial<MockConfig>;

export const MOCK_SCENARIOS: MockScenarioPreset[] = [
  {
    id: 'live',
    name: 'Live',
    blurb: 'the real backend, nothing mocked',
    patch: { popup: 'live', ...NO_HOVER_CARD_OVERRIDES },
  },
  {
    id: 'popup-data',
    name: 'Populated popup',
    blurb: 'all four popup tabs full, gates forced open',
    patch: { popup: 'data', ...NO_HOVER_CARD_OVERRIDES },
  },
  {
    id: 'onboarding',
    name: 'Onboarding wall',
    blurb: 'the setup wall, on an account already past it',
    patch: { popup: 'onboarding', ...NO_HOVER_CARD_OVERRIDES },
  },
  {
    id: 'both-verified',
    name: 'Both verified',
    blurb: 'the complete trading and X-verified Profile Card',
    patch: { ...NO_HOVER_CARD_OVERRIDES, popup: 'live', hoverCardScenario: 'both_verified' },
  },
  {
    id: 'trading-only',
    name: 'Trading on X',
    blurb: 'trading totals and Smart Follower ranking, without X verification',
    patch: { ...NO_HOVER_CARD_OVERRIDES, popup: 'live', hoverCardScenario: 'trading_only' },
  },
  {
    id: 'x-verified-only',
    name: 'X verified only',
    blurb: 'Smart Follower ranking, Verified and Active, without trading totals',
    patch: { ...NO_HOVER_CARD_OVERRIDES, popup: 'live', hoverCardScenario: 'x_verified_only' },
  },
  {
    id: 'unverified',
    name: 'Not verified',
    blurb: 'the category-only Profile Card state',
    patch: { ...NO_HOVER_CARD_OVERRIDES, popup: 'live', hoverCardScenario: 'unverified' },
  },
  {
    id: 'multi-anon',
    name: 'Multi-wallet, anon',
    blurb: '3 wallets per platform, every address withheld',
    patch: {
      ...NO_HOVER_CARD_OVERRIDES,
      popup: 'live',
      hoverCardHyperliquid: 'force',
      hoverCardPolymarket: 'force',
      hoverCardWallets: 'anon',
    },
  },
  {
    id: 'multi-drawer',
    name: 'Multi-wallet drawer',
    blurb: 'a previewed chip, a fetch-only chip and an anonymous one',
    patch: {
      ...NO_HOVER_CARD_OVERRIDES,
      popup: 'live',
      hoverCardHyperliquid: 'force',
      hoverCardPolymarket: 'force',
      hoverCardWallets: 'mixed',
      hoverCardWalletDetail: 'served',
    },
  },
  {
    id: 'pm-identity',
    name: 'Polymarket identity',
    blurb: "a revealed address, so the chip carries Polymarket's own name",
    patch: {
      ...NO_HOVER_CARD_OVERRIDES,
      popup: 'live',
      hoverCardPolymarket: 'force',
      hoverCardWallets: 'mixed',
    },
  },
  {
    id: 'x-only',
    name: 'X-only profile',
    blurb: 'no trading surface — Verified / Active sit where the totals do',
    patch: {
      ...NO_HOVER_CARD_OVERRIDES,
      popup: 'live',
      hoverCardFollowers: 'filled',
      hoverCardProfileMode: 'x_only',
    },
  },
];
