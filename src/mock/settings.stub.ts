import type { MockConfig, MockScenarioPreset, MockSwitch } from './settings';

export type {
  MockConfig,
  MockFollowers,
  MockHyperliquid,
  MockWalletDetail,
  MockOption,
  MockPolymarket,
  MockPreview,
  MockPreviewChip,
  MockPreviewLine,
  MockPreviewTone,
  MockProfileCardScenario,
  MockProfileMode,
  MockScenario,
  MockScenarioPreset,
  MockSwitch,
  MockTotals,
  MockWallets,
} from './settings';

export const MOCK_DEFAULTS: MockConfig = {
  popup: 'live',
  hoverCardTotals: 'off',
  hoverCardFollowers: 'off',
  hoverCardHyperliquid: 'off',
  hoverCardPolymarket: 'off',
  hoverCardFomo: 'off',
  hoverCardPumpfun: 'off',
  hoverCardWalletDetail: 'off',
  hoverCardWallets: 'off',
  hoverCardScenario: 'live',
  hoverCardProfileMode: 'off',
  hoverCardScope: '',
};

export function mockConfig(): MockConfig {
  return MOCK_DEFAULTS;
}

export async function loadMockConfig(): Promise<MockConfig> {
  return MOCK_DEFAULTS;
}

export async function updateMockConfig(_patch: Partial<MockConfig>): Promise<MockConfig> {
  return MOCK_DEFAULTS;
}

export function watchMockConfig(_cb: (config: MockConfig) => void): () => void {
  return () => {};
}

export const MOCK_SWITCHES: MockSwitch[] = [];

export const MOCK_SCENARIOS: MockScenarioPreset[] = [];
