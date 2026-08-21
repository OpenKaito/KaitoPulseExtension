
import type { MockConfig, MockSwitch } from './settings';

export type { MockConfig, MockScenario, MockSwitch, MockTotals } from './settings';

export const MOCK_DEFAULTS: MockConfig = { popup: 'live', hoverCardTotals: 'off', hoverCardScope: '' };

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
