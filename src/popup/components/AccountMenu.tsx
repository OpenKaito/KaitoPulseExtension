import { Show, createSignal, onCleanup, onMount, type Component } from 'solid-js';
import { GearIcon, SignOutIcon } from '@/verify/ui/icons';
import { signOut, viewer } from '../data/store';

export const AccountMenu: Component = () => {

  const name = () => viewer()?.kaitoName || viewer()?.username || viewer()?.email || 'Kaito.ai';
  const subtitle = () => viewer()?.email || (viewer()?.username ? `@${viewer()?.username}` : '');
  const avatar = () => viewer()?.avatarUrl || '';

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

  const openSettings = (): void => {
    void chrome.runtime.openOptionsPage().catch((error: unknown) => {
      console.error('[popup] failed to open settings', error);
    });
  };

  return (
    <div class="pv-account" ref={accountRef}>
      <button
        type="button"
        class="pv-account__settings"
        aria-label="Account and settings"
        aria-haspopup="menu"
        aria-expanded={open()}
        onClick={() => setOpen(!open())}
      >
        <GearIcon size={20} />
      </button>
      <Show when={open()}>
        <div class="pv-account-menu" role="menu">
          <div class="pv-account-menu__identity">
            <Show
              when={avatar()}
              fallback={<div class="pv-account-menu__avatar" aria-hidden="true" />}
            >
              {(url) => <img class="pv-account-menu__avatar" src={url()} alt="" />}
            </Show>
            <div class="pv-account-menu__names">
              <p class="pv-account-menu__name">{name()}</p>
              <Show when={subtitle()}>
                {(text) => <p class="pv-account-menu__sub">{text()}</p>}
              </Show>
            </div>
          </div>
          <button type="button" class="pv-account-menu__item" role="menuitem" onClick={openSettings}>
            <GearIcon size={14} />
            <span>Settings</span>
          </button>
          <button
            type="button"
            class="pv-account-menu__item"
            role="menuitem"
            disabled={signingOut()}
            onClick={() => void handleSignOut()}
          >
            <SignOutIcon size={14} />
            <span>{signingOut() ? 'Signing out…' : 'Sign out'}</span>
          </button>
        </div>
      </Show>
    </div>
  );
};
