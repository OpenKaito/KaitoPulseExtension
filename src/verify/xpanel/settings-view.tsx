
import { For, createResource, type Component } from 'solid-js';
import {
  isEnabled,
  loadSettings,
  setMany,
  setSurface,
  type SignalSettings,
  type SignalSurfaceKey,
} from '@/signal/settings';

const AVATAR_KEYS: SignalSurfaceKey[] = ['avatar.feed', 'avatar.quoted', 'avatar.usercell', 'avatar.hovercard'];

type Row = {
  label: string;
  isOn: (s: SignalSettings) => boolean;
  toggle: (s: SignalSettings) => Promise<void>;
};

const simpleRow = (label: string, key: SignalSurfaceKey): Row => ({
  label,
  isOn: (s) => isEnabled(s, key),
  toggle: (s) => setSurface(key, !isEnabled(s, key)),
});

const ROWS: Row[] = [
  {
    label: 'Show Avatar Smart Followers',
    isOn: (s) => AVATAR_KEYS.every((k) => isEnabled(s, k)),
    toggle: (s) => {
      const next = !AVATAR_KEYS.every((k) => isEnabled(s, k));
      return setMany(Object.fromEntries(AVATAR_KEYS.map((k) => [k, next])));
    },
  },
  simpleRow('Show Hyperliquid Data', 'protocol.hyperliquid'),
  simpleRow('Show Polymarket Data', 'protocol.polymarket'),
  simpleRow('Show User Name History', 'profile.usernameHistory'),
  simpleRow('Show Profile Data', 'profile.userInfo'),
];

export const SettingsView: Component<{ onBack: () => void }> = (props) => {
  const [settings, { refetch }] = createResource<SignalSettings>(() => loadSettings(), { initialValue: {} });

  return (
    <div>
      <button type="button" class="kv-settings-title" onClick={() => props.onBack()}>
        ‹ Setting
      </button>
      <For each={ROWS}>
        {(row) => (
          <div class="kv-setting-row">
            <span>{row.label}</span>
            <button
              type="button"
              class="kv-toggle"
              classList={{ on: row.isOn(settings()) }}
              role="switch"
              aria-checked={row.isOn(settings())}
              aria-label={row.label}
              onClick={() => void row.toggle(settings()).then(() => refetch())}
            />
          </div>
        )}
      </For>
    </div>
  );
};
