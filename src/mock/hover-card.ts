import type { HoverCardResult } from '@/shared/social-card';
import { mockConfig, watchMockConfig, type MockTotals } from './settings';

const MOCK_BUCKET = '10M+';
const MOCK_PNL = 9_097_494;

const MOCK_PLATFORMS = ['hyperliquid', 'polymarket'];

function scopeOf(raw: string): Set<string> | 'all' {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'all') return 'all';
  return new Set(
    trimmed
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s)),
  );
}

const ready: Promise<void> = new Promise((resolve) => {
  watchMockConfig(() => resolve());
});

function describe(mode: MockTotals, scope: string): string | undefined {
  if (mode === 'off') return undefined;
  const ids = scopeOf(scope);
  return `mode=${mode} scope=${ids === 'all' ? 'all' : Array.from(ids).join(',') || 'none'}`;
}

export function watchHoverCardMock(cb: (description: string) => void): () => void {
  return watchMockConfig((config) => {
    const description = describe(config.hoverCardTotals, config.hoverCardScope);
    if (description) cb(description);
  });
}

export async function applyHoverCardMock(twitterId: string, result: HoverCardResult): Promise<HoverCardResult> {
  await ready;
  const { hoverCardTotals: mode, hoverCardScope } = mockConfig();
  if (mode === 'off') return result;
  const ids = scopeOf(hoverCardScope);
  if (ids !== 'all' && !ids.has(twitterId)) return result;

  if (mode === 'hidden') {

    return { ...result, accountValue: null, allTimePnl: null, tradingPlatforms: MOCK_PLATFORMS };
  }

  return {
    ...result,
    accountValue: {
      bucket: MOCK_BUCKET,
      currency: 'USD',
      coveredAccounts: 1,
      totalAccounts: 1,
      coveredPlatforms: 1,
    },
    allTimePnl: {
      value: MOCK_PNL,
      currency: 'USD',
      coveredAccounts: 1,
      totalAccounts: 1,
      coveredPlatforms: 1,

      basis: 'platform_all_time',
      completeness: 'complete',
      coversFrom: '2026-01-01T00:00:00.000Z',
      coversTo: '2026-08-13T00:00:00.000Z',
    },
    tradingPlatforms: MOCK_PLATFORMS,
  };
}
