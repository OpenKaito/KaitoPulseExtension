import { createSignal, onCleanup, onMount, Show, type JSX } from 'solid-js';
import { ChevronDownIcon } from '@/verify/ui/icons';
import { Switch } from './Switch';
import { TurnOffConfirmModal } from './TurnOffConfirmModal';
import { disableActivityInsights } from './store';

export function ActivityInsightsMenu(): JSX.Element {
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  let menuRef: HTMLDivElement | undefined;

  const onDocumentMouseDown = (event: MouseEvent): void => {
    if (menuRef && event.target instanceof Node && !menuRef.contains(event.target)) setMenuOpen(false);
  };
  onMount(() => document.addEventListener('mousedown', onDocumentMouseDown));
  onCleanup(() => document.removeEventListener('mousedown', onDocumentMouseDown));

  const confirmTurnOff = (): void => {
    setConfirmOpen(false);
    setMenuOpen(false);
    void disableActivityInsights();
  };

  return (
    <div class="rf-insights-menu" ref={menuRef}>
      <button
        type="button"
        class="rf-insights-menu__trigger"
        aria-label="Activity Insights settings"
        aria-haspopup="menu"
        aria-expanded={menuOpen()}
        onClick={() => setMenuOpen(!menuOpen())}
      >
        <ChevronDownIcon size={16} />
      </button>
      <Show when={menuOpen()}>
        <div class="rf-insights-menu__pointer" aria-hidden="true" />
        <div class="rf-insights-menu__panel" role="menu">
          <span class="rf-insights-menu__label" id="rf-insights-menu-label">
            Activity insights
          </span>
          <Switch checked={true} onClick={() => setConfirmOpen(true)} labelledBy="rf-insights-menu-label" />
        </div>
      </Show>
      <Show when={confirmOpen()}>
        <TurnOffConfirmModal
          onCancel={() => {
            setConfirmOpen(false);
            setMenuOpen(false);
          }}
          onConfirm={confirmTurnOff}
        />
      </Show>
    </div>
  );
}
