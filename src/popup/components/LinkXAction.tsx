import { createSignal, type Component } from 'solid-js';
import { XLogoIcon } from '@/verify/ui/icons';
import { sendKaitoMessage } from '@/signal/messaging';
import { buildLinkTwitterUrl } from '@/verify/controller';
import artwork from '../assets/link-x-artwork.png';

export const LinkXAction: Component<{ surface: string }> = (props) => {
  const [busy, setBusy] = createSignal(false);

  const linkNow = async (): Promise<void> => {
    if (busy()) return;
    setBusy(true);
    try {
      await sendKaitoMessage({ target: 'kaitoExtension', action: 'openSignIn', url: buildLinkTwitterUrl() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="pv-linkx">
      <img class="pv-linkx__art" src={artwork} alt="" />
      <p class="pv-linkx__title">
        <span>Link</span>
        <span class="pv-linkx__logo" aria-label="X">
          <XLogoIcon size={12} />
        </span>
        <span>to unlock your {props.surface}</span>
      </p>
      {}
      <button type="button" class="pv-linkx__button" disabled={busy()} onClick={() => void linkNow()}>
        <span>Link Now</span>
      </button>
    </div>
  );
};
