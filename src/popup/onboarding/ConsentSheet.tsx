import { Show, createSignal, type Component, type JSX } from 'solid-js';
import { ActivityDataNoticeModal } from '@/recommend-follow/ActivityDataNoticeModal';
import { PRIVACY_POLICY_URL } from '@/recommend-follow/copy';

const CheckTick: Component = () => (
  <svg
    viewBox="0 0 12 12"
    width="12"
    height="12"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M1.5 5.5 4.5 8.5 9.5 2.5" />
  </svg>
);

const Checkbox: Component<{ checked: boolean; onChange: (next: boolean) => void; label: string }> = (props) => (
  <span class="pv-check">
    <input
      type="checkbox"
      checked={props.checked}
      aria-label={props.label}
      onChange={(event) => props.onChange(event.currentTarget.checked)}
    />
    <span class="pv-check__box" aria-hidden="true">
      <CheckTick />
    </span>
  </span>
);

const ConsentRow: Component<{ checked: boolean; onChange: (next: boolean) => void; label: string; children: JSX.Element }> = (
  props,
) => (
  <div class="pv-consent-row">
    <Checkbox checked={props.checked} onChange={props.onChange} label={props.label} />
    <p class="pv-consent-row__text">{props.children}</p>
  </div>
);

export const ConsentSheet: Component<{ onAgree: (activityData: boolean) => void; onCancel: () => void }> = (
  props,
) => {
  const [acknowledged, setAcknowledged] = createSignal(false);
  const [dataUse, setDataUse] = createSignal(false);
  const [noticeOpen, setNoticeOpen] = createSignal(false);

  const ready = () => acknowledged() && dataUse();

  return (
    <>
      <div class="pv-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Before you continue">
        <div class="pv-sheet">
          <div class="pv-sheet__head">
            <p class="pv-sheet__title">Before you continue</p>
            <p class="pv-sheet__sub">Review and agree to the following:</p>
          </div>

          <div class="pv-sheet__rows">
            <ConsentRow
              checked={acknowledged()}
              onChange={setAcknowledged}
              label="I've read the Data Notice and Privacy Policy."
            >
              I've read the{' '}
              <button type="button" class="pv-consent-row__link" onClick={() => setNoticeOpen(true)}>
                Data Notice
              </button>{' '}
              and{' '}
              <a class="pv-consent-row__link" href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer noopener">
                Privacy Policy
              </a>
              .
            </ConsentRow>

            <ConsentRow
              checked={dataUse()}
              onChange={setDataUse}
              label="I agree Kaito can use limited activity data (views, clicks, and page context) to power extension features and my analytics."
            >
              I agree Kaito can use limited activity data (views, clicks, and page context) to power extension
              features and my analytics. You can turn this off later from the Activity Insights menu.
            </ConsentRow>

            <div class="pv-sheet__actions">
              <button type="button" class="pv-sheet__cancel" onClick={() => props.onCancel()}>
                Cancel
              </button>
              <button
                type="button"
                class="pv-sheet__confirm"
                disabled={!ready()}
                onClick={() => props.onAgree(dataUse())}
              >
                Agree &amp; Continue
              </button>
            </div>
          </div>
        </div>
      </div>

      <Show when={noticeOpen()}>
        <ActivityDataNoticeModal onClose={() => setNoticeOpen(false)} />
      </Show>
    </>
  );
};
