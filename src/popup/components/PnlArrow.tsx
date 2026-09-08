import type { Component } from 'solid-js';
import {
  PNL_ARROW_HEIGHT,
  PNL_ARROW_POINTS,
  PNL_ARROW_VIEW_BOX,
  PNL_ARROW_WIDTH,
  type PnlArrowDirection,
} from '@/shared/pnl-arrow';

export const PnlArrow: Component<{ tone: 'profit' | 'loss' }> = (props) => {
  const direction = (): PnlArrowDirection => (props.tone === 'loss' ? 'down' : 'up');
  return (
    <span
      class="pv-pnl-caret"
      classList={{ 'pv-pnl-caret--down': props.tone === 'loss' }}
      aria-hidden="true"
    >
      <svg
        width={PNL_ARROW_WIDTH}
        height={PNL_ARROW_HEIGHT}
        viewBox={PNL_ARROW_VIEW_BOX}
        preserveAspectRatio="none"
        fill="none"
      >
        <polygon points={PNL_ARROW_POINTS[direction()]} fill="currentColor" />
      </svg>
    </span>
  );
};
