import { For, Show, type Component } from 'solid-js';
import { Avatar } from '@/recommend-follow/Avatar';
import { TabSkeleton } from '../components/TabSkeleton';
import { UnlockState } from '../components/UnlockState';
import { cardLoading, popupData, xLinked } from '../data/store';
import { formatCount } from '../format/numbers';
import { LinkXAction } from '../components/LinkXAction';
import { hasSocialCard, SocialCardSection } from '../social-card/SocialCardSection';

const SocialSkeleton: Component = () => (
  <>
    <div class="pv-chips" aria-hidden="true">
      <For each={[0, 1, 2]}>
        {() => (
          <div class="pv-chip">
            <span class="rf-sk pv-sk--chip-label" />
            <div class="pv-chip__row">
              <span class="rf-sk pv-sk--chip-value" />
            </div>
          </div>
        )}
      </For>
    </div>
    <section class="pv-section">
      <span class="rf-sk pv-sk--section-title" aria-hidden="true" />
      <TabSkeleton rows={5} />
    </section>
  </>
);

const socialEmpty = (): boolean => {
  const social = popupData().social;
  return (
    !social.categories.some((category) => category.score > 0) &&
    social.followers.length === 0 &&
    !hasSocialCard()
  );
};

const SocialBody: Component = () => {
  const social = () => popupData().social;

  return (
    <Show
      when={!socialEmpty()}
      fallback={
        <UnlockState
          title="Almost there"
          body="We don't have enough data coverage for this profile yet. Please check back later."
        />
      }
    >
      {}
      <Show when={social().categories.some((category) => category.score > 0)}>
        <div class="pv-chips">
          <For each={social().categories}>
            {(category) => (
              <div class="pv-chip">
                <p class="pv-chip__label">{category.label}</p>
                <div class="pv-chip__row">
                  <p class="pv-chip__score">{formatCount(category.score)}</p>
                  <Show when={category.rank != null}>
                    <p class="pv-chip__rank">#{formatCount(category.rank)}</p>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      {}
      <Show
        when={social().followers.length > 0}
        fallback={<UnlockState title="No smart followers yet" body="Check back once your audience grows." />}
      >
        {}
        <section class="pv-section">
          {}
          <p class="pv-section__title">
            {social().followersOrdering === 'recent' ? 'Recent Smart Followers' : 'Top Smart Followers'}
          </p>
          <div class="pv-list">
            <div class="pv-list__head">
              <span>Account</span>
              {}
              <Show when={social().followers.some((f) => f.followers != null)}>
                <span>Smart Followers</span>
              </Show>
            </div>
            <div class="pv-list__rows">
              <For each={social().followers}>
                {(follower) => (
                  <div class="pv-sf-row">
                    <Avatar url={follower.avatarUrl} name={follower.username} class="pv-sf-row__avatar" />
                    <div class="pv-sf-row__id">
                      <p class="pv-sf-row__name">{follower.username}</p>
                      <p class="pv-sf-row__handle">{follower.handle}</p>
                    </div>
                    {}
                    <Show when={follower.followers != null}>
                      <p class="pv-sf-row__count">{formatCount(follower.followers)}</p>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </div>
        </section>
      </Show>

      {}
      <Show when={hasSocialCard()}>
        <SocialCardSection />
      </Show>
    </Show>
  );
};

export const SocialTab: Component = () => (
  <Show when={xLinked()} fallback={<LinkXAction surface="Social" />}>
    <Show when={!cardLoading()} fallback={<SocialSkeleton />}>
      <SocialBody />
    </Show>
  </Show>
);
