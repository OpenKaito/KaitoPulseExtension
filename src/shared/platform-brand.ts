import { PROTOCOL_ICON_DATA_URI } from '@/signal/protocol-icons';
import { PLATFORM_CATALOG } from '@/verify/catalog';

const BRAND_COLORS: Record<string, string> = {
  hyperliquid: '#96fce4',
  polymarket: '#89a2ff',
  pumpfun: '#86efac',
  binance: '#f3ba2f',
  variational: '#5b9ef5',
};

const DEFAULT_BRAND_COLOR = '#ffffff';

export function platformBrandColor(platform: string): string {
  return BRAND_COLORS[platform] ?? DEFAULT_BRAND_COLOR;
}

const MONOGRAM_BG = '#3a3f47';
const MONOGRAM_FG = '#f5f7fa';

function monogramMark(platform: string): string {
  const tile = PLATFORM_CATALOG.find((meta) => meta.platform === platform)?.tile;
  const letter = tile?.letter ?? (platform.trim()[0] ?? '?').toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">` +
    `<rect width="16" height="16" rx="4" fill="${tile?.bg ?? MONOGRAM_BG}"/>` +
    `<text x="8" y="11.5" text-anchor="middle" fill="${tile?.fg ?? MONOGRAM_FG}"` +
    ` font-family="system-ui,-apple-system,sans-serif" font-size="9" font-weight="600">` +
    `${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const SHIPPED_MARKS: Record<string, string | undefined> = PROTOCOL_ICON_DATA_URI;

export function platformMarkSrc(platform: string): string {
  return SHIPPED_MARKS[platform] ?? monogramMark(platform);
}
