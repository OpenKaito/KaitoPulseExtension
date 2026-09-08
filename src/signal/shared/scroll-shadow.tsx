import { createSignal, onCleanup, onMount, type JSX } from 'solid-js';

export function StickyShadowCard(props: { class?: string; children: JSX.Element }): JSX.Element {
  const [scrolledUp, setScrolledUp] = createSignal(false);
  let el!: HTMLDivElement;
  let ancestor: HTMLElement | null = null;

  const check = (): void => {
    if (!ancestor) return;
    setScrolledUp(el.getBoundingClientRect().bottom > ancestor.getBoundingClientRect().bottom + 1);
  };

  onMount(() => {
    ancestor = el.closest<HTMLElement>('.signal-popover');
    ancestor?.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    check();
    onCleanup(() => {
      ancestor?.removeEventListener('scroll', check);
      ro.disconnect();
    });
  });

  return (
    <div
      ref={el}
      class={`${props.class ?? ''}${scrolledUp() ? ' signal-popover__card--shadow' : ''}`}
    >
      {props.children}
    </div>
  );
}
