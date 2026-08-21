
export function hostPrefersDark(doc: Document): boolean {
  const view = doc.defaultView ?? window;
  for (const node of [doc.body, doc.documentElement]) {
    if (!node) continue;
    const match = view.getComputedStyle(node).backgroundColor.match(/^rgba?\(([^)]+)\)/);
    if (!match) continue;
    const [r, g, b, a = 1] = match[1].split(",").map((part) => parseFloat(part));
    if (!(a > 0) || Number.isNaN(r)) continue;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
  }
  return false;
}
