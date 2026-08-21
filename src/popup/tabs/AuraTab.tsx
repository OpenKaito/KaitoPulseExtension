import { Show, createSignal, type Component } from 'solid-js';
import { ChevronDownIcon } from '@/verify/ui/icons';
import auraArtwork from '../assets/aura-artwork.png';
import { StatCardGrid } from '../components/StatCard';
import { UnlockState } from '../components/UnlockState';
import { auraLoading, auraOnboarded, popupData } from '../data/store';
import { NO_VALUE, formatCount } from '../format/numbers';
import { openAuraSetup } from '../links';

const ReferFriends: Component<{ inviteUrl?: string | null; inviteCode?: string | null }> = (props) => {
  const [copied, setCopied] = createSignal(false);

  const shown = (): string => (props.inviteUrl ?? props.inviteCode ?? '').replace(/^https?:\/\//, '');
  const payload = (): string => (props.inviteUrl ? `https://${shown()}` : (props.inviteCode ?? ''));

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(payload());
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {

    }
  };

  return (
    <section class="pv-section">
      <div class="pv-section__head">
        <p class="pv-section__title">Refer friends</p>
        <p class="pv-section__sub">Earn 10% of each friend’s head start when they install &amp; login</p>
      </div>
      <div class="pv-invite">
        <p class="pv-invite__url">{shown()}</p>
        <button type="button" class="pv-invite__copy" disabled={copied()} onClick={() => void copy()}>
          {}
          <span class="pv-invite__copy-label">{copied() ? 'Copied' : 'Copy link'}</span>
        </button>
      </div>
    </section>
  );
};

const AuraDetailsHeader: Component = () => (
  <button type="button" class="pv-section__link" onClick={openAuraSetup}>
    <span class="pv-section__title">Aura details</span>
    <span class="pv-chevron-right" aria-hidden="true">
      <ChevronDownIcon size={12} />
    </span>
  </button>
);

export const AuraTab: Component = () => {
  const stats = () => popupData().aura;

  return (
    <Show
      when={auraOnboarded()}
      fallback={
        <UnlockState
          art={auraArtwork}
          title="Complete your Aura setup"
          body="Finish your Aura setup in Kaito to get started."
          action="Continue in Kaito"
          onAction={openAuraSetup}
        />
      }
    >
      {}
      <section class="pv-section">
        <AuraDetailsHeader />
        <StatCardGrid
          loading={auraLoading()}
          items={[
            { label: 'Total', value: formatCount(stats().total) },
            { label: 'Rank', value: stats().rank == null ? NO_VALUE : `#${formatCount(stats().rank)}` },
            { label: 'Earned', value: formatCount(stats().earned) },
            { label: 'Referral', value: formatCount(stats().referral) },
          ]}
        />
      </section>
      {}
      <Show when={auraLoading() ? null : (stats().inviteUrl ?? stats().inviteCode)}>
        <ReferFriends inviteUrl={stats().inviteUrl} inviteCode={stats().inviteCode} />
      </Show>
    </Show>
  );
};
