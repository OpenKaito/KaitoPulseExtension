
import './display.css';
import { createSignal, onCleanup, For, Show, type Component } from 'solid-js';
import { MOCK_SWITCHES, MOCK_DEFAULTS, updateMockConfig, watchMockConfig, type MockConfig } from '@/mock/settings';

export const MockSection: Component = () => {
  const [config, setConfig] = createSignal<MockConfig>(MOCK_DEFAULTS);

  onCleanup(watchMockConfig(setConfig));

  const write = (key: keyof MockConfig, value: string): void => {

    setConfig((current) => ({ ...current, [key]: value }));
    void updateMockConfig({ [key]: value } as Partial<MockConfig>);
  };

  return (
    <>
      <section class="card">
        <p class="surface-desc">
          Fake data for reviewing states the backend cannot produce yet. Development builds only — every
          switch here is compiled out of a release build, so this page is empty in one.
        </p>
      </section>

      <Show
        when={MOCK_SWITCHES.length > 0}
        fallback={
          <section class="card">
            <span class="surface-label">No mocks in this build.</span>
            <p class="surface-desc">
              This is a production build: src/mock/ was replaced at build time, so there is nothing to
              switch on. Run a development build (<code>pnpm dev</code>) to get the switches.
            </p>
          </section>
        }
      >
        <For each={MOCK_SWITCHES}>
          {(control) => (
            <section class="card">
              <label class="surface-row">
                <span class="surface-text">
                  <span class="surface-label">{control.label}</span>
                  <span class="surface-desc">{control.description}</span>
                </span>
              </label>
              <Show
                when={control.kind === 'select'}
                fallback={
                  <input
                    type="text"
                    value={String(config()[control.key] ?? '')}
                    placeholder={control.placeholder}

                    onInput={(event) => write(control.key, event.currentTarget.value)}
                  />
                }
              >
                <select value={String(config()[control.key])} onChange={(event) => write(control.key, event.currentTarget.value)}>
                  <For each={control.options ?? []}>
                    {(option) => (

                      <option value={option.value} selected={config()[control.key] === option.value}>
                        {option.label}
                      </option>
                    )}
                  </For>
                </select>
              </Show>
            </section>
          )}
        </For>
      </Show>
    </>
  );
};
