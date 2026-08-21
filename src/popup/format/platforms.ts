
import { PLATFORM_CATALOG } from '@/verify/catalog';

const BRAND_COLORS: Record<string, string> = {
  hyperliquid: '#96fce4',
  polymarket: '#89a2ff',
};

const DEFAULT_BRAND_COLOR = '#ffffff';

export function platformBrandColor(platform: string): string {
  return BRAND_COLORS[platform] ?? DEFAULT_BRAND_COLOR;
}

export function platformDisplayName(platform: string): string {
  const meta = PLATFORM_CATALOG.find((entry) => entry.platform === platform);
  if (meta) return meta.displayName;
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

export function shortenAddress(address: string): string {
  return address.length <= 12 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatJoined(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  const month = date.toLocaleString('en-US', { month: 'short' }).toLowerCase();
  return `Joined ${month} ${date.getFullYear()}`;
}
