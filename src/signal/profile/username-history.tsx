import { createSignal, onCleanup, Show, For, type JSX } from "solid-js";
import { Portal, render } from "solid-js/web";
import type { UsernameChange } from "../types";
import { PROFILE_ATTRS } from "./profile-dom";
import { hostPrefersDark } from "../host-theme";
import { positionFloating } from "../shared/floating-position";
import { attachDismissWatcher } from "../shared/dismiss";

const CLOCK_ICON =
  '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">' +
  '<circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.4"/>' +
  '<path d="M8 4.75V8l2.25 1.5" stroke="currentColor" stroke-width="1.4" ' +
  'stroke-linecap="round" stroke-linejoin="round"/></svg>';

export interface UsernameHistoryHandle {

  root: HTMLElement;

  destroy: () => void;
}

const OPEN_DELAY = 120;
const CLOSE_DELAY = 200;

function ChangeRow(props: { change: UsernameChange }): JSX.Element {
  return (
    <div class="signal-uname__row">
      <div class="signal-uname__names">
        <span class="signal-uname__name">{props.change.from}</span>
        <span class="signal-uname__arrow">→</span>
        <span class="signal-uname__name">{props.change.to}</span>
      </div>
      <span class="signal-uname__date">{props.change.date}</span>
    </div>
  );
}

function UsernameHistoryWidget(props: { changes: UsernameChange[]; isDark: boolean }): JSX.Element {
  const [open, setOpen] = createSignal(false);
  let toggleRef!: HTMLButtonElement;
  let dropdownRef: HTMLDivElement | undefined;

  const position = (): void => {
    if (!dropdownRef) return;
    const rect = toggleRef.getBoundingClientRect();
    const { left, top } = positionFloating(
      rect,
      { width: dropdownRef.offsetWidth, height: dropdownRef.offsetHeight },
      window,
    );
    dropdownRef.style.left = `${Math.round(left)}px`;
    dropdownRef.style.top = `${Math.round(top)}px`;
  };

  let stopDismissWatcher: (() => void) | null = null;

  function setOpenSafe(next: boolean): void {
    if (next === open()) return;
    setOpen(next);
    if (next) {
      stopDismissWatcher = attachDismissWatcher(window, document, () => dropdownRef, {
        onScroll: () => setOpenSafe(false),
        onResize: () => setOpenSafe(false),
      });
    } else {
      stopDismissWatcher?.();
      stopDismissWatcher = null;
    }
  }

  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const cancelOpen = (): void => {
    if (openTimer !== undefined) {
      clearTimeout(openTimer);
      openTimer = undefined;
    }
  };
  const cancelClose = (): void => {
    if (closeTimer !== undefined) {
      clearTimeout(closeTimer);
      closeTimer = undefined;
    }
  };
  const scheduleOpen = (): void => {
    cancelClose();
    if (open()) return;
    cancelOpen();
    openTimer = setTimeout(() => {
      openTimer = undefined;
      setOpenSafe(true);
    }, OPEN_DELAY);
  };
  const scheduleClose = (): void => {
    cancelOpen();
    cancelClose();
    closeTimer = setTimeout(() => {
      closeTimer = undefined;
      setOpenSafe(false);
    }, CLOSE_DELAY);
  };

  onCleanup(() => {
    cancelOpen();
    cancelClose();
    setOpenSafe(false);
  });

  return (
    <>
      <button
        type="button"
        class="signal-uname__toggle"
        ref={toggleRef}
        aria-expanded={open()}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
      >
        <span class="signal-uname__icon" innerHTML={CLOCK_ICON} />
        <span>User Name History</span>
      </button>
      {}
      <Show when={open()}>
        <Portal mount={document.body}>
          <div
            class={`signal-uname__dropdown signal-uname__dropdown--open${props.isDark ? " signal-uname__dropdown--dark" : ""}`}
            ref={(el) => {
              dropdownRef = el;
              position();
            }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <div class="signal-uname__head">Recent Username Changes</div>
            <For each={props.changes}>{(change) => <ChangeRow change={change} />}</For>
          </div>
        </Portal>
      </Show>
    </>
  );
}

export function createUsernameHistory(changes: UsernameChange[]): UsernameHistoryHandle {
  const root = document.createElement("div");
  root.className = "signal-uname";
  root.setAttribute(PROFILE_ATTRS.USERNAME_HISTORY_FLAG, "");

  const isDark = hostPrefersDark(document);
  if (isDark) root.classList.add("signal-uname--dark");

  const dispose = render(() => <UsernameHistoryWidget changes={changes} isDark={isDark} />, root);

  return {
    root,
    destroy: () => {
      dispose();
      root.remove();
    },
  };
}
