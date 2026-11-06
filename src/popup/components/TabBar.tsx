import { For, type Component } from 'solid-js';

export const POPUP_TABS = ['Aura', 'Social', 'Credentials', 'X Analytics'] as const;
export type PopupTab = (typeof POPUP_TABS)[number];

export const TabBar: Component<{
  active: PopupTab;
  onSelect: (tab: PopupTab) => void;
  hidden?: readonly PopupTab[];
}> = (props) => (
  <div class="pv-tabs" role="tablist">
    <For each={POPUP_TABS.filter((tab) => !props.hidden?.includes(tab))}>
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
