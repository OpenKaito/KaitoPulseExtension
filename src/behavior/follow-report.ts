
import type { TabMessage } from '@/shared/tab-messages';
import type { AttentionBehaviorEvent } from '@/shared/attention';
import type { FollowActionReport } from '@/shared/recommend-follow';
import { createLogger } from '@/signal/logger';

const logger = createLogger('follow-report');

export function reportFollowAction(event: AttentionBehaviorEvent): void {

  if (!event.targetTwitterId) {
    logger.warn(`skipping ${event.type} report: no targetTwitterId`);
    return;
  }
  const report: FollowActionReport = {

    eventId: event.eventId,
    targetTwitterId: event.targetTwitterId,
    action: event.type === 'follow' ? 'follow' : 'unfollow',
    occurredAt: event.tsStart,
  };
  try {
    void chrome.runtime.sendMessage({ type: 'kaito:followActionReport', report } satisfies TabMessage).catch(() => {

    });
  } catch {

  }
}
