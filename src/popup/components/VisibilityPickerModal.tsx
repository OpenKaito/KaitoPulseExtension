import { Show, createSignal, type Component, type JSX } from 'solid-js';
import previewArt from '../assets/trading-visibility-preview.png';

const Radio: Component<{ checked: boolean }> = (props) => (
  <span class="pv-radio" classList={{ 'pv-radio--on': props.checked }} aria-hidden="true" />
);

const Option: Component<{
  checked: boolean;
  onSelect: () => void;
  name: string;
  title: string;
  body: string;
  children?: JSX.Element;
}> = (props) => (
  <label class="pv-vopt" classList={{ 'pv-vopt--on': props.checked }}>
    <input
      type="radio"
      name={props.name}
      class="pv-vopt__input"
      checked={props.checked}
      onChange={() => props.onSelect()}
    />
    <span class="pv-vopt__head">
      <Radio checked={props.checked} />
      <span class="pv-vopt__copy">
        <span class="pv-vopt__title">{props.title}</span>
        <span class="pv-vopt__body">{props.body}</span>
      </span>
    </span>
    {props.children}
  </label>
);

export const VisibilityPickerModal: Component<{
  initial: boolean;
  onClose: () => void;

  onSave: (next: boolean) => Promise<boolean>;
}> = (props) => {
  const [draft, setDraft] = createSignal(props.initial);
  const [saving, setSaving] = createSignal(false);
  const [failed, setFailed] = createSignal(false);

  const save = async (): Promise<void> => {
    if (saving()) return;
    setSaving(true);
    setFailed(false);
    try {
      const ok = await props.onSave(draft());
      if (!ok) setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="pv-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Show your verified data on X?">
      <div class="pv-sheet pv-sheet--visibility">
        <div class="pv-sheet__head">
          <p class="pv-sheet__title pv-sheet__title--lg">Show your verified data on X?</p>
          <p class="pv-sheet__sub">
            This is the master switch for verified trading data shown on X. Individual platform privacy settings
            still apply.
          </p>
        </div>

        <div class="pv-vopts">
          <Option
            name="pv-trading-visibility"
            checked={!draft()}
            onSelect={() => setDraft(false)}
            title="Off – hidden from everyone"
            body="Nothing appears on X. All your settings are saved and restored when you turn this back on."
          />
          <Option
            name="pv-trading-visibility"
            checked={draft()}
            onSelect={() => setDraft(true)}
            title="On – visible on X"
            body="Eligible trading data appears on your X profile when its platform setting is Public."
          >
            <Show when={draft()}>
              <span class="pv-vopt__preview">
                <img src={previewArt} alt="" />
              </span>
            </Show>
          </Option>
        </div>

        {}
        <Show when={failed()}>
          <p class="pv-sheet__error">Couldn't save that just now — your visibility is unchanged.</p>
        </Show>

        <div class="pv-sheet__actions">
          <button type="button" class="pv-sheet__cancel" disabled={saving()} onClick={() => props.onClose()}>
            Cancel
          </button>
          <button type="button" class="pv-sheet__confirm" disabled={saving()} onClick={() => void save()}>
            {saving() ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
