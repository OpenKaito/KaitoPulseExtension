
const sheetCache = new Map<string, CSSStyleSheet>();

function sheetFor(css: string): CSSStyleSheet {
  let sheet = sheetCache.get(css);
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    sheetCache.set(css, sheet);
  }
  return sheet;
}

export interface ShadowHost {
  host: HTMLDivElement;
  shadow: ShadowRoot;
}

export function createShadowHost(css: string | string[], hostClass?: string): ShadowHost {
  const host = document.createElement("div");
  if (hostClass) host.className = hostClass;
  const shadow = host.attachShadow({ mode: "open" });
  shadow.adoptedStyleSheets = (Array.isArray(css) ? css : [css]).map(sheetFor);
  return { host, shadow };
}

export function markTopLayerHost(host: HTMLElement): void {
  if (typeof host.showPopover !== "function") return;
  host.popover = "manual";
}

export function promoteToTopLayer(host: HTMLElement): void {
  if (typeof host.showPopover !== "function") return;

  if (host.matches(":popover-open")) host.hidePopover();
  host.showPopover();
}
