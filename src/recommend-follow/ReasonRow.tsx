import { For, Show, type JSX } from 'solid-js';
import { CIRCLE_PROOF_LIMIT, type FollowRecommendationItem } from '@/shared/recommend-follow';
import { FOLLOWED_BY_REASON_LABEL } from './copy';
import { Avatar } from './Avatar';

export function hasCircleProof(item: FollowRecommendationItem): boolean {
  return (item.circleCount ?? 0) > 0 || (item.circleProof ?? []).length > 0;
}

export function ReasonRow(props: { item: FollowRecommendationItem }): JSX.Element {

  const proof = () => (props.item.circleProof ?? []).slice(0, CIRCLE_PROOF_LIMIT);

  return (
    <div class="rf-reason">
      {}
      <Show when={proof().length > 0}>
        <div class="rf-reason__stack" aria-hidden="true">
          <For each={proof()}>
            {(user) => <Avatar url={user.avatarUrl} name={user.displayName || user.handle} class="rf-reason__avatar" />}
          </For>
        </div>
      </Show>
      <span class="rf-reason__label">{FOLLOWED_BY_REASON_LABEL}</span>
    </div>
  );
}
