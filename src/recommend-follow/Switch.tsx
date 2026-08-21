import type { JSX } from 'solid-js';

export function Switch(props: { checked: boolean; onClick: () => void; labelledBy?: string }): JSX.Element {
  return (
    <button
      type="button"
      class="rf-switch"
      classList={{ 'rf-switch--checked': props.checked }}
      role="switch"
      aria-checked={props.checked}
      aria-labelledby={props.labelledBy}
      onClick={props.onClick}
    >
      <span class="rf-switch__thumb" />
    </button>
  );
}
