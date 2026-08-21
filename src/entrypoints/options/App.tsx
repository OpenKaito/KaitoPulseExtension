import { createSignal, onCleanup, For, Show, type Component } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { SETTINGS_SECTIONS, type SettingsSection } from './registry';
import { ENV } from '@/lib/env';
import {
  attachKonami,
  loadDebugUnlocked,
  setDebugUnlocked,
  subscribeDebugUnlocked,
} from './debug-unlock';

function currentHashId(): string {
  return location.hash.replace(/^#/, '');
}

export const App: Component = () => {
  const [hashId, setHashId] = createSignal(currentHashId());
  const onHashChange = () => setHashId(currentHashId());
  window.addEventListener('hashchange', onHashChange);
  onCleanup(() => window.removeEventListener('hashchange', onHashChange));

  const [unlocked, setUnlocked] = createSignal(false);
  void loadDebugUnlocked().then(setUnlocked);
  onCleanup(subscribeDebugUnlocked(setUnlocked));

  onCleanup(
    attachKonami(() => {
      const next = !unlocked();
      setUnlocked(next);
      void setDebugUnlocked(next);

      if (next) location.hash = 'debug';
      else if (['debug', 'behavior-debug', 'mock'].includes(currentHashId())) location.hash = 'display';
    }),
  );

  const sections = (): SettingsSection[] =>
    SETTINGS_SECTIONS.filter((s) => !s.devOnly || ENV.isDev || unlocked());

  const active = (): SettingsSection | undefined =>
    sections().find((s) => s.id === hashId()) ?? sections()[0];

  return (
    <>
      <header class="topbar">
        <h1>Kaito Settings</h1>
      </header>
      <div class="body">
        <aside class="nav">
          <For each={sections()}>
            {(s) => (
              <a
                class={s.id === active()?.id ? 'nav-item nav-item--active' : 'nav-item'}
                href={`#${s.id}`}
                aria-current={s.id === active()?.id ? 'page' : undefined}
              >
                {s.label}
              </a>
            )}
          </For>
        </aside>
        <main class="panel">
          {}
          <Show when={active()} keyed>
            {(section) => <Dynamic component={section.Component} />}
          </Show>
        </main>
      </div>
    </>
  );
};
