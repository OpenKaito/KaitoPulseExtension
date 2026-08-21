
export type DismissTarget = HTMLElement | (() => HTMLElement | null | undefined);

function resolveTarget(target: DismissTarget): HTMLElement | null | undefined {
  return typeof target === "function" ? target() : target;
}

export function isEventInside(event: Event, root: HTMLElement): boolean {
  return event.composedPath().includes(root);
}

export interface DismissWatcherHandlers {

  onOutsideClick?: (event: MouseEvent) => void;

  onScroll?: (event: Event) => void;
  onResize?: () => void;
}

export function attachDismissWatcher(
  win: Window,
  doc: Document,
  target: DismissTarget,
  handlers: DismissWatcherHandlers,
): () => void {
  const isInside = (event: Event): boolean => {
    const root = resolveTarget(target);
    return !!root && isEventInside(event, root);
  };
  const onDocClick = (event: MouseEvent): void => {
    if (isInside(event)) return;
    handlers.onOutsideClick?.(event);
  };
  const onScroll = (event: Event): void => {
    if (isInside(event)) return;
    handlers.onScroll?.(event);
  };
  const onResize = (): void => handlers.onResize?.();

  if (handlers.onOutsideClick) doc.addEventListener("click", onDocClick);
  if (handlers.onScroll) win.addEventListener("scroll", onScroll, true);
  if (handlers.onResize) win.addEventListener("resize", onResize);

  return () => {
    doc.removeEventListener("click", onDocClick);
    win.removeEventListener("scroll", onScroll, true);
    win.removeEventListener("resize", onResize);
  };
}
