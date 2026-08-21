
import { storage } from 'wxt/utils/storage';

export type MockScenario = 'live' | 'data' | 'empty' | 'onboarding';

export type MockTotals = 'off' | 'filled' | 'hidden';

export interface MockConfig {

  popup: MockScenario;

  hoverCardTotals: MockTotals;

  hoverCardScope: string;
}

export const MOCK_DEFAULTS: MockConfig = {
  popup: 'live',
  hoverCardTotals: 'off',
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
  } catch {

  }
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

export interface MockSwitch {
  key: keyof MockConfig;
  label: string;
  description: string;

  kind: 'select' | 'text';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export const MOCK_SWITCHES: MockSwitch[] = [
  {
    key: 'popup',
    label: 'Popup snapshot',
    description:
      'Which snapshot the popup renders. "live" is the real thing. "data" is the fully-populated ' +
      'fixture — it also forces the X-linked and trading-verified gates open and skips every fetch ' +
      'overlay, so all four tabs render populated on an account that has none of it. "empty" is ' +
      'onboarded-with-nothing-to-show, "onboarding" is the "Complete your Aura setup" wall.',
    kind: 'select',
    options: [
      { value: 'live', label: 'live — real data' },
      { value: 'data', label: 'data — populated fixture' },
      { value: 'empty', label: 'empty — no data yet' },
      { value: 'onboarding', label: 'onboarding — setup wall' },
    ],
  },
  {
    key: 'hoverCardTotals',
    label: 'Hover-card totals',
    description:
      "Overrides Account Value and All-Time P&L on the x.com hover card, and nothing else — the rest of " +
      'the card stays whatever the backend returned, so a break elsewhere on it still shows. "filled" ' +
      'draws a $10M+ whale; "hidden" nulls both numbers while keeping the platform list, which is what ' +
      "an owner who turned their own totals off looks like.",
    kind: 'select',
    options: [
      { value: 'off', label: 'off — real values' },
      { value: 'filled', label: 'filled — $10M+ / +$9.1M' },
      { value: 'hidden', label: 'hidden — totals private' },
    ],
  },
  {
    key: 'hoverCardScope',
    label: 'Hover-card scope',
    description:
      'Which accounts the override applies to. Empty means every card. Otherwise a comma-separated ' +
      'list of numeric twitter_ids — use it to mock ONE account, so the mocked card can be compared ' +
      'against a real one on the same timeline.',
    kind: 'text',
    placeholder: 'all cards (or 1234567890,987654321)',
  },
];
