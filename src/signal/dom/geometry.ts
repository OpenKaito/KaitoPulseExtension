import type { AvatarSignalProfile } from "../types";

export function detectAvatarShape(avatarRoot: HTMLElement): 'circle' | 'square' {
  const hasSquareClip =
    avatarRoot.getAttribute('style')?.includes('shape-square') ||
    Boolean(avatarRoot.querySelector('[style*="shape-square"]'));

  return hasSquareClip ? 'square' : 'circle';
}

export function detectAvatarSize(avatarRoot: HTMLElement): AvatarSignalProfile['avatarSize'] {
  const style = avatarRoot.getAttribute('style') || '';
  const inlineW = Number.parseFloat(style.match(/width:\s*(\d+(?:\.\d+)?)px/i)?.[1] || '');
  const inlineH = Number.parseFloat(style.match(/height:\s*(\d+(?:\.\d+)?)px/i)?.[1] || '');
  const rect = avatarRoot.getBoundingClientRect();
  const size = Math.max(
    rect.width,
    rect.height,
    Number.isFinite(inlineW) ? inlineW : 0,
    Number.isFinite(inlineH) ? inlineH : 0,
  );

  if (size && size <= 32) return 'compact';
  if (size >= 80) return 'large';
  return 'regular';
}
