import { Show, type Component } from 'solid-js';
import { ArrowUpRightIcon } from '@/verify/ui/icons';
import { tradingTotalsPublic, visibilityLoading } from '../data/store';
import { VERIFICATION_HUB_URL } from '../links';

export const TradingVisibilityRow: Component = () => {
  const isPublic = () => tradingTotalsPublic() === true;

  return (
    <section class="pv-vis">
      <div class="pv-vis__row">
        <div class="pv-vis__copy">
          <p class="pv-vis__title">Trading accounts</p>
          {}
          <p class="pv-vis__helper">Public accounts included in your Trading summary. Manage them in Kaito.</p>
        </div>
        {}
        <Show when={!visibilityLoading()}>
          <span class="pv-vis__tag" classList={{ 'pv-vis__tag--public': isPublic() }}>
            {isPublic() ? 'Public' : 'Private'}
          </span>
        </Show>
      </div>
      {}
      <a class="pv-vis__manage" href={VERIFICATION_HUB_URL} target="_blank" rel="noopener noreferrer">
        <span>Manage</span>
        <ArrowUpRightIcon size={12} />
      </a>
    </section>
  );
};
