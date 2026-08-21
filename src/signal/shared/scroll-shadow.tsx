import { createSignal, onCleanup, onMount, type JSX } from "solid-js";

export function ScrollShadowRegion(props: { maxHeight: number; class?: string; children: JSX.Element }): JSX.Element {
  const [scrolledUp, setScrolledUp] = createSignal(false);
  let el!: HTMLDivElement;
  let inner!: HTMLDivElement;

  const checkScroll = (): void => {
    setScrolledUp(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  };

  onMount(() => {
    el.addEventListener("scroll", checkScroll, { passive: true });

    const ro = new ResizeObserver(checkScroll);
    ro.observe(inner);
    onCleanup(() => ro.disconnect());
  });
  onCleanup(() => el.removeEventListener("scroll", checkScroll));

  return (
    <div
      ref={el}
      class={`signal-popover__scroll${props.class ? ` ${props.class}` : ""}${scrolledUp() ? " signal-popover__scroll--shadow" : ""}`}
      style={{ "max-height": `${props.maxHeight}px` }}
    >
      <div ref={inner}>{props.children}</div>
    </div>
  );
}

export function StickyShadowCard(props: { class?: string; children: JSX.Element }): JSX.Element {
  const [scrolledUp, setScrolledUp] = createSignal(false);
  let el!: HTMLDivElement;
  let ancestor: HTMLElement | null = null;

  const check = (): void => {
    if (!ancestor) return;
    setScrolledUp(el.getBoundingClientRect().bottom > ancestor.getBoundingClientRect().bottom + 1);
  };

  onMount(() => {
    ancestor = el.closest<HTMLElement>(".signal-popover");
    ancestor?.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    check();
    onCleanup(() => {
      ancestor?.removeEventListener("scroll", check);
      ro.disconnect();
    });
  });

  return (
    <div ref={el} class={`${props.class ?? ""}${scrolledUp() ? " signal-popover__card--shadow" : ""}`}>
      {props.children}
    </div>
  );
}
