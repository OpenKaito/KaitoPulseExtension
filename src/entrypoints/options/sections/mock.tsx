import './display.css';
import './debug.css';
import './mock.css';
import { createSignal, createMemo, onCleanup, For, Show, type Component } from 'solid-js';
import {
  MOCK_SWITCHES,
  MOCK_SCENARIOS,
  MOCK_DEFAULTS,
  updateMockConfig,
  watchMockConfig,
  type MockConfig,
  type MockPreview,
  type MockScenarioPreset,
  type MockSwitch,
} from '@/mock/settings';

interface MockGroup {
  title: string;
  items: MockSwitch[];
}

function groupsOf(switches: MockSwitch[]): MockGroup[] {
  const groups: MockGroup[] = [];
  for (const item of switches) {
    const existing = groups.find((g) => g.title === item.group);
    if (existing) existing.items.push(item);
    else groups.push({ title: item.group, items: [item] });
  }
  return groups;
}

const Preview: Component<{ preview?: MockPreview }> = (props) => (
  <span class="mock-prev">
    <Show when={props.preview?.chips} keyed>
      {(chips) => (
        <span class="mock-prev-chips">
          <For each={chips}>
            {(chip) => <span class={`mock-prev-chip mock-tone--${chip.tone}`}>{chip.text}</span>}
          </For>
        </span>
      )}
    </Show>
    <Show when={props.preview?.cells} keyed>
      {(cells) => (
        <span class="mock-prev-cells">
          <For each={cells}>
            {(cell) => <span class={`mock-prev-cell mock-tone--${cell.tone}`}>{cell.text}</span>}
          </For>
        </span>
      )}
    </Show>
    <Show when={props.preview?.lines} keyed>
      {(lines) => (
        <For each={lines}>
          {(line) => (
            <span class="mock-prev-line">
              <span class="mock-prev-key">{line.key}</span>
              <span class={`mock-prev-val mock-tone--${line.tone}`}>{line.value}</span>
            </span>
          )}
        </For>
      )}
    </Show>
  </span>
);

export const MockSection: Component = () => {
  const [config, setConfig] = createSignal<MockConfig>(MOCK_DEFAULTS);
  const [selectedKey, setSelectedKey] = createSignal<keyof MockConfig | ''>('');
  const [advancedOpen, setAdvancedOpen] = createSignal(false);

  onCleanup(watchMockConfig(setConfig));

  const apply = (patch: Partial<MockConfig>): void => {
    setConfig((current) => ({ ...current, ...patch }));
    void updateMockConfig(patch);
  };

  const write = (key: keyof MockConfig, value: string): void => {
    if (key === 'hoverCardScenario') {
      apply({
        ...MOCK_DEFAULTS,
        popup: config().popup,
        hoverCardScope: config().hoverCardScope,
        hoverCardScenario: value as MockConfig['hoverCardScenario'],
      });
      return;
    }

    if (key.startsWith('hoverCard') && key !== 'hoverCardScope') {
      apply({
        hoverCardScenario: 'live',
        [key]: value,
      } as Partial<MockConfig>);
      return;
    }

    apply({ [key]: value } as Partial<MockConfig>);
  };

  const valueOf = (control: MockSwitch): string => String(config()[control.key] ?? '');
  const isOverridden = (control: MockSwitch): boolean => valueOf(control) !== control.rest;

  const groups = createMemo(() => groupsOf(MOCK_SWITCHES));
  const overrides = createMemo(() => MOCK_SWITCHES.filter(isOverridden));
  const scope = (): string => config().hoverCardScope.trim();
  const advancedOverrides = (): number =>
    MOCK_SWITCHES.filter(
      (control) => control.group === 'Advanced payload overrides' && isOverridden(control),
    ).length;

  const selected = createMemo(
    () => MOCK_SWITCHES.find((s) => s.key === selectedKey()) ?? MOCK_SWITCHES[0],
  );

  const scenario = createMemo((): MockScenarioPreset | undefined =>
    MOCK_SCENARIOS.find((preset) =>
      (Object.keys(preset.patch) as (keyof MockConfig)[]).every(
        (key) => config()[key] === preset.patch[key],
      ),
    ),
  );

  const state = createMemo(() => {
    const hit = scenario();

    if (hit && hit.id === 'live') {
      return {
        name: 'Live',
        note: scope() ? 'scope is set, but nothing is mocked' : 'nothing is mocked',
        dot: 'mock-dot--off',
      };
    }
    if (hit) {
      return {
        name: hit.name,
        note: scope() ? `scoped to ${scope()}` : hit.blurb,
        dot: 'mock-dot--on',
      };
    }
    return {
      name: 'Custom',
      note: `not one of the scenarios${scope() ? `, scoped to ${scope()}` : ''}`,
      dot: 'mock-dot--custom',
    };
  });

  const countLabel = (): string => {
    const n = overrides().length;
    if (n === 0) return 'nothing mocked';
    return `${n} override${n === 1 ? '' : 's'}`;
  };

  const countClass = (): string => {
    if (overrides().length === 0) return 'debug-verdict debug-verdict--muted';
    return scenario() ? 'debug-verdict mock-verdict--on' : 'debug-verdict debug-verdict--warn';
  };

  return (
    <div class="mock-page">
      <Show
        when={MOCK_SWITCHES.length > 0}
        fallback={
          <section class="card">
            <span class="surface-label">No mocks in this build.</span>
            <p class="surface-desc">
              This is a production build: src/mock/ was replaced at build time, so there is nothing
              to switch on. Run a development build (<code>pnpm dev</code>) to get the switches.
            </p>
          </section>
        }
      >
        <div class="debug-toolbar">
          <h2 class="debug-title">Mock data</h2>
          <div class="debug-actions">
            <span class="debug-verdict debug-verdict--muted">dev build only</span>
            <span class={countClass()}>{countLabel()}</span>
            <button
              type="button"
              class="debug-button"
              disabled={overrides().length === 0 && !scope()}
              onClick={() => apply(MOCK_DEFAULTS)}
            >
              Reset all
            </button>
          </div>
        </div>

        <section class="card mock-overview">
          <div class="mock-state">
            <span class={`mock-dot ${state().dot}`} />
            <span class="surface-label">
              <strong>{state().name}</strong>
            </span>
            <span class="surface-desc">{state().note}</span>
          </div>
          <div class="mock-scenarios">
            <For each={MOCK_SCENARIOS}>
              {(preset) => (
                <button
                  type="button"
                  class={
                    scenario()?.id === preset.id ? 'debug-button mock-button--on' : 'debug-button'
                  }
                  title={preset.blurb}
                  onClick={() => apply(preset.patch)}
                >
                  {preset.name}
                </button>
              )}
            </For>
          </div>
        </section>

        <div class="mock-split">
          <div class="mock-list">
            <For each={groups()}>
              {(group) => {
                const advanced = group.title === 'Advanced payload overrides';
                return (
                  <>
                    <Show
                      when={advanced}
                      fallback={
                        <div
                          class={`mock-list-label${
                            group.title === 'Profile card on X' ? ' mock-list-label--primary' : ''
                          }`}
                        >
                          {group.title}
                        </div>
                      }
                    >
                      <button
                        type="button"
                        class="mock-list-label mock-list-label--toggle"
                        aria-expanded={advancedOpen()}
                        onClick={() => setAdvancedOpen((open) => !open)}
                      >
                        <span>Advanced payload overrides</span>
                        <span>
                          {advancedOverrides() > 0 ? `${advancedOverrides()} active` : 'Show'}
                        </span>
                      </button>
                    </Show>
                    <Show when={!advanced || advancedOpen()}>
                      <For each={group.items}>
                        {(control) => (
                          <button
                            type="button"
                            class={
                              control.key === selected()?.key
                                ? 'mock-item mock-item--sel'
                                : 'mock-item'
                            }
                            onClick={() => setSelectedKey(control.key)}
                          >
                            <span
                              class={`mock-dot ${isOverridden(control) ? 'mock-dot--on' : 'mock-dot--blank'}`}
                            />
                            <span class="mock-item-name">{control.label}</span>
                            <span class="mock-item-val">
                              {control.kind === 'text' && !isOverridden(control)
                                ? 'all cards'
                                : valueOf(control)}
                            </span>
                          </button>
                        )}
                      </For>
                    </Show>
                  </>
                );
              }}
            </For>
          </div>

          <Show when={selected()} keyed>
            {(control) => (
              <div class="mock-detail">
                <h3 class="mock-detail-title">{control.label}</h3>
                <span class="mock-detail-key">
                  MockConfig.{control.key} = {valueOf(control) === '' ? '""' : valueOf(control)}
                </span>
                <p class="mock-detail-desc">{control.description}</p>

                <Show
                  when={control.kind === 'select'}
                  fallback={
                    <div class="mock-scope">
                      <input
                        type="text"
                        class="debug-filter"
                        value={valueOf(control)}
                        placeholder={control.placeholder}
                        onInput={(event) => write(control.key, event.currentTarget.value)}
                      />
                      <span class="surface-desc">
                        Comma-separated numeric twitter_ids. Empty means every card.
                      </span>
                    </div>
                  }
                >
                  <div
                    classList={{
                      'mock-variants': true,
                      'mock-variants--scenarios': control.key === 'hoverCardScenario',
                    }}
                  >
                    <For each={control.options ?? []}>
                      {(option) => {
                        const on = (): boolean => valueOf(control) === option.value;
                        const radio = (): string => {
                          if (!on()) return 'mock-radio';
                          return option.value === control.rest
                            ? 'mock-radio mock-radio--rest'
                            : 'mock-radio mock-radio--on';
                        };

                        return (
                          <button
                            type="button"
                            class={on() ? 'mock-variant mock-variant--on' : 'mock-variant'}
                            onClick={() => write(control.key, option.value)}
                          >
                            <span class={radio()}>
                              <span class="mock-radio-in" />
                            </span>
                            <Preview preview={option.preview} />
                            <span class="debug-method">{option.label ?? option.value}</span>
                            <span class="surface-desc">{option.note}</span>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </Show>
              </div>
            )}
          </Show>
        </div>
      </Show>
    </div>
  );
};
