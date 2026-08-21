import { For, Match, Show, Switch, onMount, type Component } from 'solid-js';
import '@/recommend-follow/recommend-follow.css';
import { AccountsHeading } from '@/recommend-follow/AccountsHeading';
import { RecommendationRow } from '@/recommend-follow/RecommendationRow';
import { TabSkeleton } from '../components/TabSkeleton';
import { TimeSpentCard } from '@/recommend-follow/TimeSpentCard';
import { initRecommendations, locallyFollowedIds, view } from '@/recommend-follow/store';
import { LinkXAction } from '../components/LinkXAction';
import { UnlockState } from '../components/UnlockState';
import { fixtureRecommendations, xLinked } from '../data/store';
import linkXArtwork from '../assets/link-x-artwork.png';

export const XAnalyticsTab: Component = () => {
  onMount(() => {
    void initRecommendations();
  });

  const items = () => {
    const fx = fixtureRecommendations();
    if (fx) return fx.items;
    const state = view();
    if (state.kind !== 'list') return [];
    return state.response.items.filter((item) => !locallyFollowedIds().has(item.twitterId));
  };

  const seconds = (): number | null => {
    const fx = fixtureRecommendations();
    if (fx) return fx.totalViewSeconds;
    const state = view();
    if (state.kind === 'list') return state.response.totalViewSeconds ?? null;
    if (state.kind === 'empty') return state.totalViewSeconds;
    return null;
  };

  return (
    <Show when={xLinked()} fallback={<LinkXAction surface="X Analytics" />}>
      <Switch>
        {}
        <Match when={!fixtureRecommendations() && view().kind === 'loading'}>
          <TabSkeleton />
        </Match>
        <Match when={!fixtureRecommendations() && view().kind === 'signedOut'}>
          <UnlockState title="Sign in to see your X Analytics" />
        </Match>
        <Match when={true}>
          <Show when={seconds() !== null}>
            <TimeSpentCard seconds={seconds()!} />
          </Show>

          <div class="rf-accounts-block">
            <AccountsHeading />
            <Show
              when={items().length > 0}
              fallback={

                <div class="pv-empty-recs">
                  <img class="pv-empty-recs__art" src={linkXArtwork} alt="" />
                  <p class="pv-empty-recs__copy">
                    Browse posts on your X timeline. Once there’s enough activity, we’ll recommend accounts based on
                    what you engage with.
                  </p>
                </div>
              }
            >
              <ul class="rf-list rf-list--flush">
                <For each={items()}>{(item) => <RecommendationRow item={item} />}</For>
              </ul>
            </Show>
          </div>
        </Match>
      </Switch>
    </Show>
  );
};
