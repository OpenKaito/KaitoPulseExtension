import { SIGNAL_CONFIG } from '@/signal/config';
import { backgroundFetch } from '@/signal/api/client';
import { createLogger } from '@/signal/logger';
import { selectorOverridesItem } from '@/shared/storage';
import {
  SIGNAL_SELECTOR_KEYS,
  PROFILE_SELECTOR_KEYS,
  type SignalSelectorKey,
  type ProfileSelectorKey,
} from '@/signal/dom/selectors';
import type {
  ForceRefreshSelectorOverridesResponse,
  GetSelectorOverridesResponse,
  SelectorOverridePayload,
} from '@/shared/messages';

const logger = createLogger('selector-config');

const MAX_OVERRIDE_VALUE_LENGTH = 300;
const ALARM_NAME = 'kaito.signal.selectorConfigRefresh';
const ALARM_PERIOD_MINUTES = 15;

function isPlausibleShape(
  raw: unknown,
): raw is { version: number; signal: Record<string, unknown>; profile: Record<string, unknown> } {
  if (typeof raw !== 'object' || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  return (
    typeof obj.version === 'number' &&
    typeof obj.signal === 'object' && obj.signal !== null &&
    typeof obj.profile === 'object' && obj.profile !== null
  );
}

function sanitizeGroup<K extends SignalSelectorKey | ProfileSelectorKey>(
  raw: Record<string, unknown>,
  keySet: ReadonlySet<K>,
): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!keySet.has(key as K)) continue;
    if (typeof value !== 'string' || value.length === 0 || value.length > MAX_OVERRIDE_VALUE_LENGTH) continue;
    out[key as K] = value;
  }
  return out;
}

function validatePayload(raw: unknown): SelectorOverridePayload | null {
  if (!isPlausibleShape(raw)) return null;
  return {
    version: raw.version,
    signal: sanitizeGroup(raw.signal, SIGNAL_SELECTOR_KEYS),
    profile: sanitizeGroup(raw.profile, PROFILE_SELECTOR_KEYS),
  };
}

export async function fetchSelectorConfigPayload(): Promise<SelectorOverridePayload | null> {
  const url = SIGNAL_CONFIG.selectorConfigUrl;
  if (!url) return null;

  try {

    const raw = await backgroundFetch<unknown>(url, { redirect: 'manual' });
    const validated = validatePayload(raw);
    if (!validated) {
      logger.warn('selector config payload rejected: invalid shape');
      return null;
    }
    return validated;
  } catch (error) {
    logger.error('selector config fetch failed', error);
    return null;
  }
}

export async function refreshSelectorOverrides(): Promise<SelectorOverridePayload | null> {
  const payload = await fetchSelectorConfigPayload();
  if (payload) {
    await selectorOverridesItem.setValue(payload);
    return payload;
  }
  return selectorOverridesItem.getValue();
}

export async function handleGetSelectorOverrides(): Promise<GetSelectorOverridesResponse> {
  try {
    return { payload: await selectorOverridesItem.getValue() };
  } catch (error) {
    logger.error('getSelectorOverrides failed', error);
    return { payload: null };
  }
}

export async function handleForceRefreshSelectorOverrides(): Promise<ForceRefreshSelectorOverridesResponse> {
  try {
    return { payload: await refreshSelectorOverrides() };
  } catch (error) {
    logger.error('forceRefreshSelectorOverrides failed', error);
    return { payload: null };
  }
}

export function startSelectorConfigAlarm(): void {

  if (!SIGNAL_CONFIG.selectorConfigUrl) {
    void chrome.alarms.clear(ALARM_NAME);
    return;
  }

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      void refreshSelectorOverrides().catch((error) => {
        logger.error('selector config alarm refresh failed', error);
      });
    }
  });
  chrome.alarms.get(ALARM_NAME, (existing) => {
    if (!existing) chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
  });
}
