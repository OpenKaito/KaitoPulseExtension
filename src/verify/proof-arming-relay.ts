
import { sendVerifyMessage } from './messaging';
import { clearProofArmed, markProofArmed, PROOF_RUNTIME_TEARDOWN_EVENT } from '@/shared/proof-arming';
import { guard } from '@/lib/guard';

const POLL_MS = 700;

const MAX_RUNTIME_MS = 12 * 60 * 1000;

export function startProofArmingRelay(doc: Document): () => void {
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;

  let armed = false;
  const startedAt = Date.now();

  const stop = (): void => {
    stopped = true;
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  };

  const poll = guard(async (): Promise<void> => {
    if (stopped) return;
    if (Date.now() - startedAt >= MAX_RUNTIME_MS) {
      doc.dispatchEvent(new Event(PROOF_RUNTIME_TEARDOWN_EVENT));
      clearProofArmed(doc);
      stop();
      return;
    }
    let inProgress = false;
    try {
      const next = await sendVerifyMessage({
        action: 'getProofPanelState',
        href: doc.defaultView?.location.href ?? '',
      });
      inProgress = next?.phase === 'progress';
    } catch {

      return;
    }

    if (inProgress) {
      if (!armed) {
        armed = true;
        markProofArmed(doc);
      }
      return;
    }

    doc.dispatchEvent(new Event(PROOF_RUNTIME_TEARDOWN_EVENT));
    clearProofArmed(doc);
    stop();
    return;
  }, 'proofArming.poll');

  void poll();
  timer = setInterval(() => void poll(), POLL_MS);
  return stop;
}
