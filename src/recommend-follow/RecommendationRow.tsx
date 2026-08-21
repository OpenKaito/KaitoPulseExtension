import { Show, type JSX } from 'solid-js';
import type { FollowRecommendationItem } from '@/shared/recommend-follow';
import { follow, pendingIds } from './follow-action';
import { Avatar } from './Avatar';
import { hasCircleProof, ReasonRow } from './ReasonRow';

function subtitleText(item: FollowRecommendationItem): string {
  if (item.tags.length > 0) {
    return [item.tags.slice(0, 3).join(' | '), item.creatorType].filter(Boolean).join(' ');
  }
  return item.bio;
}

function formatLongestView(seconds: number): string {
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${minutes}m ${remainder}s`;
}

function footerText(item: FollowRecommendationItem): string {
  const { seenPostCount, maxViewSeconds, clickCnt } = item.evidence;
  const postsPart = `${seenPostCount} post${seenPostCount === 1 ? '' : 's'} viewed`;
  if (maxViewSeconds > 0) return `${postsPart} · Longest view: ${formatLongestView(maxViewSeconds)}`;
  if (clickCnt > 0) return `${postsPart} · Clicked`;
  return postsPart;
}

export function RecommendationRow(props: { item: FollowRecommendationItem }): JSX.Element {
  const displayName = () => props.item.displayName || props.item.handle;
  const isPending = () => pendingIds().has(props.item.twitterId);
  const subtitle = () => subtitleText(props.item);

  return (
    <li>
      {}
      <div class="rf-row rf-row--capped">
        <Avatar url={props.item.avatarUrl} name={displayName()} class="rf-avatar" />
        <div class="rf-row__info">
          <div class="rf-row__top">
            <div class="rf-row__name-line">
              <span class="rf-row__name">{displayName()}</span>
              <span class="rf-row__handle">@{props.item.handle}</span>
            </div>
            <button
              type="button"
              class="rf-row__follow-btn"
              disabled={isPending()}
              aria-busy={isPending() ? 'true' : undefined}
              onClick={() => void follow(props.item.twitterId, props.item.handle)}
            >
              <Show when={!isPending()} fallback={<span class="rf-row__follow-spinner" aria-hidden="true" />}>
                <span class="rf-row__follow-icon" aria-hidden="true">
                  +
                </span>
              </Show>
              <span class="rf-row__follow-label">Follow</span>
            </button>
          </div>
          <Show when={subtitle()}>
            <p class="rf-row__bio">{subtitle()}</p>
          </Show>
        </div>
      </div>
      <div class="rf-row__footer">
        <Show when={hasCircleProof(props.item)} fallback={footerText(props.item)}>
          <ReasonRow item={props.item} />
        </Show>
      </div>
    </li>
  );
}
