
import { attnRemoteConfigItem, type AttentionRemoteConfig } from '@/shared/storage';
import { DEFAULT_ATTENTION_CONFIG, normalizeAttentionConfig } from '@/shared/attention';
import { api } from '@/lib/api';
import { getStoredSession } from '@/lib/client-storage';
import { logDev } from '@/lib/env';

const POLL_ALARM = 'attn-remote-config-poll';
const POLL_MINUTES = 30;
const STALE_MS = 24 * 60 * 60 * 1000;

const MIN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const DEFAULT_CONFIG: AttentionRemoteConfig = { ...DEFAULT_ATTENTION_CONFIG, fetchedAt: 0 };

export function startRemoteConfigPolling(): void {
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: POLL_MINUTES });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === POLL_ALARM) void refreshRemoteConfig({ force: true });
  });
  void refreshRemoteConfig();
}

export async function refreshRemoteConfig({ force = false } = {}): Promise<void> {
  const stored = await getStoredSession();
  if (!stored?.sessionToken) {
    logDev('attention remote-config poll skipped: signed out');
    return;
  }
  if (!force) {
    const cached = await attnRemoteConfigItem.getValue();
    if (cached && Date.now() - cached.fetchedAt < MIN_REFRESH_INTERVAL_MS) return;
  }
  try {
    const response = await api.getAttentionConfig(stored.sessionToken);

    await attnRemoteConfigItem.setValue({ ...normalizeAttentionConfig(response), fetchedAt: Date.now() });
  } catch (error) {
    logDev('attention remote-config fetch failed, keeping cache', error);
  }
}

export async function getAttentionConfig(): Promise<AttentionRemoteConfig> {
  const cached = await attnRemoteConfigItem.getValue();
  if (!cached) return DEFAULT_CONFIG;

  return {
    ...normalizeAttentionConfig(cached),
    fetchedAt: typeof cached.fetchedAt === 'number' ? cached.fetchedAt : 0,
  };
}

export async function isConfigStale(): Promise<boolean> {
  const cached = await attnRemoteConfigItem.getValue();
  if (!cached) return false;
  return Date.now() - cached.fetchedAt > STALE_MS;
}
