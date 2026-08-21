import { For, Show, type Component } from 'solid-js';
import { buildPlatformCluster } from '@/shared/platform-cluster';

const MAX_MARKS = 3;

export const PlatformIconCluster: Component<{ platforms: readonly string[] }> = (props) => {
  const cluster = () => buildPlatformCluster(props.platforms, MAX_MARKS);
  return (
    <Show when={cluster().icons.length > 0}>
      <span class="pv-plat-cluster" aria-hidden="true">
        <For each={cluster().icons}>{(icon) => <img src={icon.src} alt="" />}</For>
        <Show when={cluster().overflow > 0}>
          <span class="pv-plat-cluster__more">+{cluster().overflow}</span>
        </Show>
      </span>
    </Show>
  );
};
