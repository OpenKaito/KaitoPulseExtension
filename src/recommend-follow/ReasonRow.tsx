import { For, type JSX } from 'solid-js';
import type { FollowRecommendationItem } from '@/shared/recommend-follow';
import { FOLLOWED_BY_LABEL } from './copy';
import { Avatar } from './Avatar';

export function hasCircleProof(item: FollowRecommendationItem): boolean {
  return (item.circleProof ?? []).length > 0;
}

export function ReasonRow(props: { item: FollowRecommendationItem }): JSX.Element {
  const proof = () => props.item.circleProof ?? [];

  return (
    <div class="rf-reason">
      {}
      <span class="rf-reason__label">{FOLLOWED_BY_LABEL}</span>
      <div class="rf-reason__stack" aria-hidden="true">
        <For each={proof()}>
          {(user) => (
            <Avatar
              url={user.avatarUrl}
              name={user.displayName || user.handle}
              class="rf-reason__avatar"
            />
          )}
        </For>
      </div>
    </div>
  );
}
