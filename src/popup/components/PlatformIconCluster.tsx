import { For, Show, type Component } from 'solid-js';
import { buildPlatformCluster } from '@/shared/platform-cluster';

export const PlatformIconCluster: Component<{ platforms: readonly string[] }> = (props) => {
  const cluster = () => buildPlatformCluster(props.platforms);
  return (
    <Show when={cluster().icons.length > 0}>
      <span class="pv-plat-cluster" aria-hidden="true">
        <Show
          when={cluster().collapsed}
          fallback={
            <For each={cluster().icons}>
              {(icon) => <img src={icon.src} data-platform={icon.platform} alt="" />}
            </For>
          }
        >
          <span class="pv-plat-cluster__more">{cluster().icons.length}</span>
          <span class="pv-plat-cluster__tip">
            <For each={cluster().icons}>
              {(icon) => <img src={icon.src} data-platform={icon.platform} alt="" />}
            </For>
          </span>
        </Show>
      </span>
    </Show>
  );
};
