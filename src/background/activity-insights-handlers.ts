import { api } from '@/lib/api';
import type { SetActivityInsightsPreferenceResponse } from '@/shared/messages';
import { createLogger } from '@/signal/logger';
import { activityInsightsConsentItem, activityInsightsDisablePendingItem } from '@/shared/storage';
import { discardBufferedActivity } from './attention/buffer';
import { toAuthedError } from './authed-error';
import { authedCall, updateActivityInsightsEnabled } from './worker-core';

const logger = createLogger('activity-insights');
let preferenceRevision = 0;
let localWrites: Promise<void> = Promise.resolve();
let remoteWrites: Promise<unknown> = Promise.resolve();

export async function handleSetActivityInsightsPreference(
  enabled: boolean,
): Promise<SetActivityInsightsPreferenceResponse> {
  const revision = ++preferenceRevision;
  const preparation = localWrites.then(async () => {
    await activityInsightsDisablePendingItem.setValue(!enabled);
    await activityInsightsConsentItem.setValue(enabled ? 'granted' : 'declined');
    if (!enabled) await discardBufferedActivity();
  });
  localWrites = preparation.catch(() => undefined);
  const request = remoteWrites.then(async () => {
    await preparation;
    return authedCall((token) => api.putActivityInsightsPreference(token, enabled));
  });
  remoteWrites = request.catch(() => undefined);
  try {
    const result = await request;
    const apply = localWrites.then(async () => {
      if (revision !== preferenceRevision) return;
      await updateActivityInsightsEnabled(result.enabled);
      if (!result.enabled) await discardBufferedActivity();
      await activityInsightsConsentItem.setValue(result.enabled ? 'granted' : 'declined');
      if (!result.enabled || enabled) await activityInsightsDisablePendingItem.setValue(false);
    });
    localWrites = apply.catch(() => undefined);
    await apply;
    return { result };
  } catch (error) {
    logger.error('setActivityInsightsPreference error', error);
    return toAuthedError(error, 'set preference failed');
  }
}
