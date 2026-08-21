import { createSignal, onCleanup, onMount, Show, type JSX } from 'solid-js';
import { KaitoWordmark, ChevronDownIcon, SignOutIcon } from '@/verify/ui/icons';
import menuIconUrl from './assets/topbar-menu-icon.png';
import { viewer, signOut } from './store';

const FALLBACK_MENU_LABEL = 'Kaito.ai';

export function RecommendationHeader(): JSX.Element {

  const menuLabel = () => viewer()?.kaitoName || viewer()?.username || viewer()?.email || FALLBACK_MENU_LABEL;
  const [open, setOpen] = createSignal(false);
  const [signingOut, setSigningOut] = createSignal(false);
  let accountRef: HTMLDivElement | undefined;

  const onDocumentMouseDown = (event: MouseEvent): void => {
    if (accountRef && event.target instanceof Node && !accountRef.contains(event.target)) setOpen(false);
  };
  onMount(() => document.addEventListener('mousedown', onDocumentMouseDown));
  onCleanup(() => document.removeEventListener('mousedown', onDocumentMouseDown));

  const handleSignOut = async (): Promise<void> => {
    if (signingOut()) return;
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div class="rf-topbar">
      <KaitoWordmark height={17} />
      <div class="rf-topbar__account" ref={accountRef}>
        <button
          type="button"
          class="rf-topbar__menu"
          aria-haspopup="menu"
          aria-expanded={open()}
          onClick={() => setOpen(!open())}
        >
          <img class="rf-topbar__menu-icon" src={menuIconUrl} alt="" />
          <span class="rf-topbar__menu-label">{menuLabel()}</span>
          <span class="rf-topbar__chevron" classList={{ 'rf-topbar__chevron--open': open() }}>
            <ChevronDownIcon size={16} />
          </span>
        </button>
        <Show when={open()}>
          <div class="rf-account-menu" role="menu">
            <button
              type="button"
              class="rf-account-menu__item"
              role="menuitem"
              disabled={signingOut()}
              onClick={() => void handleSignOut()}
            >
              <SignOutIcon size={14} />
              <span>Sign out</span>
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}
