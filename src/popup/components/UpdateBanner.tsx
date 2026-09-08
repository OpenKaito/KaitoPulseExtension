import { Show, createSignal, onCleanup, onMount, type Component } from 'solid-js';
import { sendKaitoMessage } from '@/signal/messaging';

const UPDATE_CHECK_CACHE_KEY = 'kaitoExtensionUpdateCheck';

type AvailableUpdate = {
  version?: string;
};

export const UpdateBanner: Component = () => {
  const [update, setUpdate] = createSignal<AvailableUpdate | null>(null);
  const [updating, setUpdating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  onMount(() => {
    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ): void => {
      if (areaName !== 'session') return;
      const value = changes[UPDATE_CHECK_CACHE_KEY]?.newValue as
        | { status?: unknown; availableVersion?: unknown }
        | undefined;
      if (value?.status !== 'update_available') return;
      setUpdate({
        version: typeof value.availableVersion === 'string' ? value.availableVersion : undefined,
      });
    };

    chrome.storage.onChanged.addListener(onStorageChanged);
    onCleanup(() => chrome.storage.onChanged.removeListener(onStorageChanged));

    void sendKaitoMessage({ target: 'kaitoExtension', action: 'checkForUpdate' })
      .then((response) => {
        if (response.status === 'update_available') {
          setUpdate({ version: response.availableVersion });
        }
      })
      .catch((cause: unknown) => {
        console.debug('[popup] update check unavailable', cause);
      });
  });

  const applyUpdate = async (): Promise<void> => {
    if (updating()) return;
    setUpdating(true);
    setError(null);

    try {
      const response = await sendKaitoMessage({ target: 'kaitoExtension', action: 'applyUpdate' });
      if (!response.ok) {
        setError(
          response.error === 'verification_in_progress'
            ? 'Finish the active verification before updating.'
            : 'The update could not be applied. Try again.',
        );
        setUpdating(false);
      }
    } catch (cause) {
      console.error('[popup] failed to apply extension update', cause);
      setError('The update could not be applied. Try again.');
      setUpdating(false);
    }
  };

  return (
    <Show when={update()}>
      {(available) => (
        <aside class="pv-update" aria-label="Extension update available">
          <div class="pv-update__copy">
            <p class="pv-update__title">
              Kaito Pulse {available().version ? `${available().version} ` : ''}is ready
            </p>
            <p class="pv-update__message" aria-live="polite">
              {error() ?? 'A newer version is ready to install.'}
            </p>
          </div>
          <button
            type="button"
            class="pv-update__action"
            disabled={updating()}
            onClick={() => void applyUpdate()}
          >
            {updating() ? 'Updating…' : 'Update now'}
          </button>
        </aside>
      )}
    </Show>
  );
};
