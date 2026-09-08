import type { Component } from 'solid-js';
import {
  VERIFIED_BADGE_COLOR,
  VERIFIED_BADGE_PATH,
  VERIFIED_BADGE_VIEWBOX,
} from '@/signal/shared/icons';

export const VerifiedBadge: Component<{ class?: string }> = (props) => (
  <svg
    class={props.class ?? 'pv-badge'}
    viewBox={VERIFIED_BADGE_VIEWBOX}
    fill="none"
    aria-hidden="true"
  >
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d={VERIFIED_BADGE_PATH}
      fill={VERIFIED_BADGE_COLOR}
    />
  </svg>
);
