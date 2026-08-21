
import { SOCIAL_CARD_SNAP_ID } from './SocialCard';
import { ensureCardFonts } from './fonts';

const EXPORT_SCALE = 2;
const EXPORT_BACKGROUND = '#0C1014';

export async function renderCardBlob(): Promise<Blob> {

  await ensureCardFonts();

  const el = document.getElementById(SOCIAL_CARD_SNAP_ID);
  if (!el) throw new Error('social card not mounted');

  const clone = el.cloneNode(true) as HTMLElement;

  clone.removeAttribute('id');
  clone.style.position = 'fixed';
  clone.style.top = '-9999px';
  clone.style.left = '-9999px';

  clone.style.transform = 'none';
  document.body.appendChild(clone);

  try {
    const { snapdom } = await import('@zumer/snapdom');
    const result = await snapdom(clone, {
      embedFonts: true,
      scale: EXPORT_SCALE,
      backgroundColor: EXPORT_BACKGROUND,
    });
    return await result.toBlob({ type: 'png' });
  } finally {
    clone.remove();
  }
}

let warmed: Promise<Blob> | undefined;

export function warmCardImage(): void {
  if (warmed || !document.getElementById(SOCIAL_CARD_SNAP_ID)) return;
  warmed = renderCardBlob();
  warmed.catch(() => {
    warmed = undefined;
  });
}

export async function copyCardImage(): Promise<void> {
  warmCardImage();
  const blob = await (warmed ?? renderCardBlob());
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
