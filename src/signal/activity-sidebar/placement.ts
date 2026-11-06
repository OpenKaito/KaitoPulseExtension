import { PROFILE_SELECTORS } from '../dom/selectors';

const MODULE_PROBE = 'h2[role="heading"], section[role="region"], aside, nav[role="navigation"]';

function childOf(ancestor: Element, node: Element): Element | null {
  let current: Element | null = node;
  while (current && current.parentElement !== ancestor) current = current.parentElement;
  return current;
}

export function findSidebarModuleAnchor(doc: Document, own: Element | null): Element | null {
  const column = doc.querySelector(PROFILE_SELECTORS.SIDEBAR_COLUMN);
  if (!column) return null;
  const probes = [...column.querySelectorAll(MODULE_PROBE)].filter((el) => !own?.contains(el));
  if (probes.length < 2) return null;
  const first = probes[0];
  const last = probes[probes.length - 1];
  let list: Element | null = first.parentElement;
  while (list && !list.contains(last)) list = list.parentElement;
  if (!list || !column.contains(list) || list.childElementCount < 3) return null;
  return childOf(list, first);
}
