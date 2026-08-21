import { createSignal, Show, type Component } from 'solid-js';
import { ChevronDownIcon, XLogoIcon } from '@/verify/ui/icons';
import { MY_SOCIALS_URL, siteUrlFromWire } from '../links';
import { socialCard, socialCardLinks } from '../data/store';
import { SOCIAL_CARD_ENABLED } from './enabled';
import { copyCardImage, warmCardImage } from './export-image';
import { shareCardOnX } from './share';
import { SocialCard, SOCIAL_CARD_HEIGHT, SOCIAL_CARD_WIDTH } from './SocialCard';

const FRESHNESS_NOTE = 'Based on last 12M data · Updated every Sunday';

const FEEDBACK_MS = 1600;

type Feedback = 'idle' | 'busy' | 'done' | 'failed';

const COPY_LABEL: Record<Feedback, string> = {
  idle: 'Copy image',
  busy: 'Copying…',
  done: 'Copied',
  failed: 'Copy failed',
};

const openMySocials = (): void => {

  window.open(siteUrlFromWire(socialCardLinks()?.mySocialsUrl, MY_SOCIALS_URL), '_blank', 'noopener');
};

export const SocialCardSection: Component = () => {
  const [copyState, setCopyState] = createSignal<Feedback>('idle');

  const shareLink = () => socialCardLinks()?.shortUrl || socialCardLinks()?.profileUrl || null;

  const [viewportWidth, setViewportWidth] = createSignal(0);
  const scale = () => (viewportWidth() > 0 ? viewportWidth() / SOCIAL_CARD_WIDTH : 0);

  let viewportEl: HTMLDivElement | undefined;
  const measure = () => {
    if (viewportEl) setViewportWidth(viewportEl.clientWidth);
  };

  const onCopy = async () => {
    setCopyState('busy');
    try {
      await copyCardImage();
      setCopyState('done');
    } catch {

      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), FEEDBACK_MS);
  };

  return (
    <section class="pv-sc-section">
      <button type="button" class="pv-section__link" onClick={openMySocials}>
        <span class="pv-section__title">Social card</span>
        <span class="pv-chevron-right" aria-hidden="true">
          <ChevronDownIcon size={12} />
        </span>
      </button>

      <div
        class="pv-sc-viewport"
        ref={(el) => {
          viewportEl = el;

          requestAnimationFrame(measure);
        }}
        style={{
          '--pv-sc-scale': String(scale()),
          '--pv-sc-height': `${SOCIAL_CARD_HEIGHT * scale()}px`,
        }}
      >
        <Show when={socialCard()}>
          {(card) => (

            <Show when={scale() > 0}>
              <div class="pv-sc-viewport__inner">
                <SocialCard data={card()} />
              </div>
            </Show>
          )}
        </Show>
      </div>

      <div class="pv-sc-actions">
        {}
        <button
          type="button"
          class="pv-sc-btn"
          onClick={onCopy}
          onPointerEnter={warmCardImage}
          onFocus={warmCardImage}
          disabled={copyState() === 'busy' || !socialCard()}
        >
          {COPY_LABEL[copyState()]}
        </button>
        {}
        <Show when={shareLink()}>
          {(link) => (
            <button
              type="button"
              class="pv-sc-btn pv-sc-btn--share"
              onClick={() => shareCardOnX(socialCard()!.scope, link())}
            >
              <span>Share on</span>
              <span class="pv-sc-btn__xbox" aria-hidden="true">
                <span class="pv-sc-btn__xchip">
                  <XLogoIcon size={7} />
                </span>
              </span>
            </button>
          )}
        </Show>
      </div>

      <p class="pv-sc-foot">{FRESHNESS_NOTE}</p>
    </section>
  );
};

export const hasSocialCard = (): boolean => SOCIAL_CARD_ENABLED && socialCard() !== undefined;
