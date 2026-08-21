import { Show, type Component, type JSX } from 'solid-js';

export const UnlockState: Component<{
  art?: string;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
  children?: JSX.Element;
}> = (props) => (
  <div class="pv-state">
    <Show when={props.art}>{(src) => <img class="pv-state__art" src={src()} alt="" />}</Show>
    <div class="pv-state__copy">
      <p class="pv-state__title">{props.title}</p>
      <Show when={props.body}>{(text) => <p class="pv-state__body">{text()}</p>}</Show>
    </div>
    <Show when={props.action}>
      {(label) => (
        <button type="button" class="pv-cta pv-cta--wide" onClick={() => props.onAction?.()}>
          {label()}
        </button>
      )}
    </Show>
    {props.children}
  </div>
);
