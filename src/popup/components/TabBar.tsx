import { For, type Component } from 'solid-js';

export const POPUP_TABS = ['Aura', 'Social', 'Trading', 'X Analytics'] as const;
export type PopupTab = (typeof POPUP_TABS)[number];

export const TabBar: Component<{ active: PopupTab; onSelect: (tab: PopupTab) => void }> = (props) => (
  <div class="pv-tabs" role="tablist">
    <For each={POPUP_TABS}>
      {(tab) => (
        <button
          type="button"
          role="tab"
          aria-selected={props.active === tab}
          class="pv-tab"
          classList={{ 'pv-tab--active': props.active === tab }}
          onClick={() => props.onSelect(tab)}
        >
          <span>{tab}</span>
          <span class="pv-tab__underline" />
        </button>
      )}
    </For>
  </div>
);
