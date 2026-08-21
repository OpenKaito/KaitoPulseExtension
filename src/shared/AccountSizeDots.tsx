import type { Component } from 'solid-js';
import { ACCOUNT_SIZE_DOT_CELLS, ACCOUNT_SIZE_DOT_R, type AccountSizeTier } from './account-size';

export const AccountSizeDots: Component<{ tier: AccountSizeTier; size?: number }> = (props) => {

  const cells = ACCOUNT_SIZE_DOT_CELLS;
  const px = () => props.size ?? 20;
  return (
    <svg class="pv-dots" width={px()} height={px()} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {cells.map((cell, i) => (
        <circle
          cx={cell.cx}
          cy={cell.cy}
          r={ACCOUNT_SIZE_DOT_R}
          fill={i < props.tier ? 'var(--acct-dot-on, #9aa6b2)' : 'var(--acct-dot-off, #3a424c)'}
        />
      ))}
    </svg>
  );
};
