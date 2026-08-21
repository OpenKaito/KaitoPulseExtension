import { PROFILE_SELECTORS, PROFILE_ATTRS } from "../dom/selectors";

export { PROFILE_SELECTORS, PROFILE_ATTRS };

const HANDLE_RE = /^@([A-Za-z0-9_]{1,15})$/;

export function findProfileHeader(doc: Document): HTMLElement | null {
  const column = doc.querySelector(PROFILE_SELECTORS.PRIMARY_COLUMN);
  return (column?.querySelector(PROFILE_SELECTORS.PROFILE_USER_NAME) as HTMLElement | null) ?? null;
}

export function getViewedHandle(header: HTMLElement, doc: Document): string | null {
  for (const span of header.querySelectorAll("span")) {
    const match = span.textContent?.trim().match(HANDLE_RE);
    if (match) return match[1];
  }

  const segment = doc.location.pathname.split("/")[1];
  return segment && HANDLE_RE.test(`@${segment}`) ? segment : null;
}

export function findHandleAnchor(header: HTMLElement): HTMLElement | null {
  let handle: HTMLElement | null = null;
  for (const span of header.querySelectorAll("span")) {
    if (span.textContent?.trim().match(HANDLE_RE)) {
      handle = span as HTMLElement;
      break;
    }
  }
  if (!handle) return null;

  let nameNode: Element | null = null;
  for (const dir of header.querySelectorAll("[dir]")) {
    if (!dir.contains(handle)) {
      nameNode = dir;
      break;
    }
  }

  const view = header.ownerDocument.defaultView ?? window;
  for (
    let node = handle.parentElement;
    node && node !== header.parentElement;
    node = node.parentElement
  ) {
    const style = view.getComputedStyle(node);
    const isRow =
      (style.display === "flex" || style.display === "inline-flex") &&
      style.flexDirection === "row";
    if (isRow && !(nameNode && node.contains(nameNode))) return node as HTMLElement;
  }
  return null;
}

export function findTabNavAnchor(doc: Document): HTMLElement | null {
  const column = doc.querySelector(PROFILE_SELECTORS.PRIMARY_COLUMN);
  const tablist = column?.querySelector(PROFILE_SELECTORS.TABLIST);
  return (tablist?.closest('nav[role="navigation"]') as HTMLElement | null) ?? null;
}

export function findProfileHeaderBlockAnchor(doc: Document): HTMLElement | null {
  const column = doc.querySelector(PROFILE_SELECTORS.PRIMARY_COLUMN);
  const userName =
    (column?.querySelector(PROFILE_SELECTORS.PROFILE_USER_NAME) as HTMLElement | null) ?? null;
  const nav = findTabNavAnchor(doc);
  if (!userName || !nav) return null;

  const nameAncestors = new Set<Element>();
  for (let n: Element | null = userName; n; n = n.parentElement) nameAncestors.add(n);
  let lca: Element | null = null;
  for (let n: Element | null = nav; n; n = n.parentElement) {
    if (nameAncestors.has(n)) {
      lca = n;
      break;
    }
  }
  if (!lca) return null;

  let block: HTMLElement = userName;
  while (block.parentElement && block.parentElement !== lca) block = block.parentElement;
  return block.parentElement === lca ? block : null;
}
