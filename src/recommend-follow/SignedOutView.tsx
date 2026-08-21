import { createSignal, type JSX } from 'solid-js';
import { sendKaitoMessage } from '@/signal/messaging';
import { buildConnectUrl } from '@/verify/controller';
import { KaitoWordmark } from '@/verify/ui/icons';
import starA from './assets/signedout-star-a.svg';
import starB from './assets/signedout-star-b.svg';
import iconMark from './assets/signedout-mark.svg';
import floorGrid from './assets/signedout-floor.png';

export function SignedOutView(props: { onResume?: () => void } = {}): JSX.Element {
  const [busy, setBusy] = createSignal(false);

  const signIn = async (): Promise<void> => {
    if (busy()) return;
    setBusy(true);
    try {
      await sendKaitoMessage({
        target: 'kaitoExtension',
        action: 'openSignIn',
        url: buildConnectUrl(),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="rf-signedout">
      <div class="rf-signedout__bokeh" aria-hidden="true">
        <div class="rf-signedout__star rf-signedout__star--a">
          <div class="rf-signedout__star-inner">
            <img src={starA} width={777} height={316} alt="" />
          </div>
        </div>
        <div class="rf-signedout__star rf-signedout__star--b">
          <div class="rf-signedout__star-inner">
            <img src={starB} width={768} height={382} alt="" />
          </div>
        </div>
      </div>

      <div class="rf-signedout__floor" aria-hidden="true">
        <img class="rf-signedout__floor-img" src={floorGrid} alt="" />
      </div>

      <div class="rf-signedout__lockup">
        <KaitoWordmark height={22} />
      </div>

      <div class="rf-signedout__icon" aria-hidden="true">
        <div class="rf-signedout__icon-tile">
          <img class="rf-signedout__icon-mark" src={iconMark} alt="" />
        </div>
      </div>

      <div class="rf-signedout__content">
        <div class="rf-signedout__copy">
          <p class="rf-signedout__title">
            {props.onResume ? 'One step left' : 'See more from your timeline'}
          </p>
          <p class="rf-signedout__subtitle">
            {props.onResume
              ? "You're signed in. Review the Data Notice and agree to continue — you can turn Activity Insights off again at any time."
              : 'Discover creators worth following, verified positions, and signals from your X timeline.'}
          </p>
        </div>
        <div class="rf-signedout__cta-wrap">
          <button
            type="button"
            class="rf-signedout__cta"
            disabled={busy()}
            onClick={() => (props.onResume ? props.onResume() : void signIn())}
          >
            {props.onResume ? 'Review and continue' : 'Sign in to Kaito'}
          </button>
        </div>
      </div>
    </div>
  );
}
