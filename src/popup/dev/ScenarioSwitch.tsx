import { For, type Component } from 'solid-js';
import { scenario, selectScenario, type FixtureScenario } from '../data/store';

const OPTIONS: FixtureScenario[] = ['live', 'data', 'empty', 'onboarding'];

export const ScenarioSwitch: Component = () => {

  if (!import.meta.env.DEV) return null;

  return (
    <div class="pv-scenario">
      <span aria-hidden="true">fx</span>
      <select
        aria-label="Fixture scenario"
        value={scenario()}
        onChange={(event) => selectScenario(event.currentTarget.value as FixtureScenario)}
      >
        <For each={OPTIONS}>
          {(option) => (

            <option value={option} selected={scenario() === option}>
              {option}
            </option>
          )}
        </For>
      </select>
    </div>
  );
};
