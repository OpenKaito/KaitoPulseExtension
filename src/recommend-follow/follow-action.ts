import { createSignal } from 'solid-js';
import { sendKaitoMessage } from '@/signal/messaging';
import { showCompletionToast } from '@/signal/shared/toast';

const [pendingIds, setPendingIds] = createSignal<ReadonlySet<string>>(new Set());

export { pendingIds };

export async function follow(twitterId: string, handle: string): Promise<void> {
  if (pendingIds().has(twitterId)) return;

  setPendingIds((prev) => new Set(prev).add(twitterId));
  try {
    const response = await sendKaitoMessage({
      target: 'kaitoExtension',
      action: 'followFromRecommendation',
      twitterId,
      handle,
    });
    if (response.ok) {

      showCompletionToast('success', `Opened @${handle} on X — confirm Follow there.`);
    } else {
      showCompletionToast('error', `Couldn't follow @${handle}. Try again.`);
    }
  } catch {
    showCompletionToast('error', `Couldn't follow @${handle}. Try again.`);
  } finally {
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(twitterId);
      return next;
    });
  }
}
