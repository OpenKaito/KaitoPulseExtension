import './display.css';
import { createSignal, createEffect, onCleanup, For, type Component } from 'solid-js';
import {
  SIGNAL_SURFACE_GROUPS,
  loadSettings,
  isEnabled,
  setSurface,
  setMany,
  subscribe,
  type SignalSettings,
  type SignalSurfaceKey,
} from '@/signal/settings';

export const DisplaySection: Component = () => {
  const [settings, setSettings] = createSignal<SignalSettings>({});

  const unsubscribe = subscribe(setSettings);
  onCleanup(unsubscribe);
  void loadSettings().then(setSettings);

  return (
    <>
    <For each={SIGNAL_SURFACE_GROUPS}>
      {(group) => {
        const childKeys = group.surfaces.map((s) => s.key);
        const onCount = () => childKeys.filter((k) => isEnabled(settings(), k)).length;
        const allOn = () => onCount() === childKeys.length;

        const toggleAll = () => {

          const turnOn = !allOn();
          const patch = Object.fromEntries(
            childKeys.map((k) => [k, turnOn]),
          ) as Partial<Record<SignalSurfaceKey, boolean>>;
          void setMany(patch);
        };

        return (
          <section class="card">
            <label class="group-head">
              <input
                type="checkbox"
                checked={onCount() > 0}

                ref={(el) => createEffect(() => { el.indeterminate = onCount() > 0 && !allOn(); })}
                onChange={toggleAll}
              />
              <span class="group-title">{group.label}</span>
            </label>
            <For each={group.surfaces}>
              {(surface) => (
                <label class={surface.parentKey ? 'surface-row surface-child' : 'surface-row'}>
                  <input
                    type="checkbox"
                    checked={isEnabled(settings(), surface.key)}
                    disabled={surface.parentKey ? !isEnabled(settings(), surface.parentKey) : false}
                    onChange={(e) => { void setSurface(surface.key, e.currentTarget.checked); }}
                  />
                  <span class="surface-text">
                    <span class="surface-label">{surface.label}</span>
                    <span class="surface-desc">{surface.description}</span>
                  </span>
                </label>
              )}
            </For>
          </section>
        );
      }}
    </For>
    </>
  );
};
