type UnregisterTickerAnchor = (anchor: HTMLElement) => void;

export function invalidateTickerAnchor(
  anchor: HTMLElement,
  chipAttribute: string,
  unregister: UnregisterTickerAnchor,
): void {
  unregister(anchor);
  anchor.removeAttribute(chipAttribute);
}
