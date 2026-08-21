
import { For, Show, type Component } from 'solid-js';
import { AlertCircleIcon, FailCircleIcon, SuccessCircleIcon } from './icons';

export type VerifyStepId = 'connect' | 'read' | 'generate';

export type VerifyStepState = 'pending' | 'active' | 'done' | 'warn' | 'error';

export interface VerifyStep {
  id: VerifyStepId;
  state: VerifyStepState;

  sub?: string;
}

export const VERIFY_STEP_IDS: VerifyStepId[] = ['connect', 'read', 'generate'];

export function verifyStepTitle(id: VerifyStepId, platform: string): string {
  return id === 'connect' ? `Connect to ${platform}` : id === 'read' ? 'Read account data' : 'Generating your proof';
}

export const VerifyStepList: Component<{
  steps: VerifyStep[];
  platform: string;

  variant: 'progress' | 'result';
}> = (props) => (
  <div class="kv-proof-steps" classList={{ result: props.variant === 'result' }}>
    <For each={props.steps}>
      {(step, i) => (
        <div class="kv-proof-step" classList={{ [step.state]: true }}>
          {}
          <span class="kv-proof-step-icon" classList={{ [step.state]: true }}>
            <Show when={step.state === 'done'}>
              <SuccessCircleIcon size={20} />
            </Show>
            <Show when={step.state === 'warn'}>
              <AlertCircleIcon />
            </Show>
            <Show when={step.state === 'error'}>
              <FailCircleIcon />
            </Show>
            <Show when={step.state === 'pending'}>{i() + 1}</Show>
          </span>
          <div class="kv-proof-step-body">
            <p class="kv-proof-step-title">{verifyStepTitle(step.id, props.platform)}</p>
            <Show when={step.sub}>
              <p class="kv-proof-step-sub">{step.sub}</p>
            </Show>
          </div>
        </div>
      )}
    </For>
  </div>
);
