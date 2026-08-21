import { api } from '@/lib/api';
import type { SetActivityInsightsPreferenceResponse } from '@/shared/messages';
import { createLogger } from '@/signal/logger';
import {
  attnFingerprintItem,
  attnOpenSpanSnapshotItem,
  attnPendingEventsItem,
  attnPendingServeEventsItem,
  deviceFingerprintItem,
} from '@/shared/storage';
import { toAuthedError } from './authed-error';
import { authedCall, updateActivityInsightsEnabled } from './worker-core';

const logger = createLogger('activity-insights');

async function discardBufferedActivity(): Promise<void> {
  try {
    await Promise.all([
      attnPendingEventsItem.setValue([]),
      attnPendingServeEventsItem.setValue([]),
      attnOpenSpanSnapshotItem.removeValue(),

      attnFingerprintItem.removeValue(),
      deviceFingerprintItem.removeValue(),
    ]);
  } catch (error) {
    logger.error('discarding buffered activity failed; flush-tick purge still applies', error);
  }
}

export async function handleSetActivityInsightsPreference(
  enabled: boolean,
): Promise<SetActivityInsightsPreferenceResponse> {
  try {
    const result = await authedCall((token) => api.putActivityInsightsPreference(token, enabled));
    await updateActivityInsightsEnabled(result.enabled);
    if (!result.enabled) await discardBufferedActivity();
    return { result };
  } catch (error) {
    logger.error('setActivityInsightsPreference error', error);
    return toAuthedError(error, 'set preference failed');
  }
}
