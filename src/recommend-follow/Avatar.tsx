import { createSignal, Show, type JSX } from 'solid-js';

interface AvatarProps {
  url: string | undefined;

  name?: string;

  class: string;
}

export function Avatar(props: AvatarProps): JSX.Element {
  const [failed, setFailed] = createSignal(false);
  const initial = () => (props.name === undefined ? '' : (props.name.trim()[0] || '?').toUpperCase());

  return (
    <Show
      when={props.url && !failed()}
      fallback={<div class={`${props.class} ${props.class}--placeholder`}>{initial()}</div>}
    >
      <img class={props.class} src={props.url} alt="" onError={() => setFailed(true)} />
    </Show>
  );
}
