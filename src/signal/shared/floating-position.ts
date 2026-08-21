
export interface FloatingPositionOptions {

  gap?: number;

  margin?: number;
}

const DEFAULT_GAP = 6;
const DEFAULT_MARGIN = 8;

export function positionFloating(
  anchorRect: DOMRect,
  panelSize: { width: number; height: number },
  win: Window,
  opts: FloatingPositionOptions = {},
): { left: number; top: number } {
  const gap = opts.gap ?? DEFAULT_GAP;
  const margin = opts.margin ?? DEFAULT_MARGIN;
  const vw = win.innerWidth;
  const vh = win.innerHeight;
  const { width, height } = panelSize;

  let left = anchorRect.left;
  let top = anchorRect.bottom + gap;

  if (top + height > vh - margin && anchorRect.top - gap - height > margin) {
    top = anchorRect.top - gap - height;
  }

  left = Math.max(margin, Math.min(left, vw - margin - width));
  top = Math.min(Math.max(margin, top), Math.max(margin, vh - margin - height));

  return { left, top };
}
