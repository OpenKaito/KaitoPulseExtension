
import { startProofArmingRelay } from '@/verify/proof-arming-relay';
import { guard } from '@/lib/guard';
import { clearProofArmed, PROOF_RUNTIME_TEARDOWN_EVENT } from '@/shared/proof-arming';

const RELAY_INSTALLED_ATTR = 'data-kaito-proof-relay-installed';

export default defineUnlistedScript({
  main() {
    if (document.documentElement?.hasAttribute(RELAY_INSTALLED_ATTR)) return;
    document.documentElement?.setAttribute(RELAY_INSTALLED_ATTR, '1');

    let stopArming: (() => void) | null = startProofArmingRelay(document);
    let tornDown = false;

    const teardown: EventListener = guard(() => {
      tornDown = true;
      stopArming?.();
      stopArming = null;
      clearProofArmed(document);
      document.documentElement?.removeAttribute(RELAY_INSTALLED_ATTR);
      document.removeEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardown);
    }, 'proofRuntime.teardown');
    document.addEventListener(PROOF_RUNTIME_TEARDOWN_EVENT, teardown);

    window.addEventListener('pagehide', guard((event: PageTransitionEvent) => {
      if (!event.persisted) return;
      stopArming?.();
      stopArming = null;
    }, 'pagehide'));
    window.addEventListener('pageshow', guard((event: PageTransitionEvent) => {
      if (!event.persisted || tornDown || stopArming) return;
      stopArming = startProofArmingRelay(document);
    }, 'pageshow'));
  },
});
