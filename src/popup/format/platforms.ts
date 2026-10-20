import { PLATFORM_CATALOG } from '@/verify/catalog';
import { PROTOCOL_LABEL } from '@/signal/protocol-labels';

export { platformBrandColor } from '@/shared/platform-brand';

export function platformDisplayName(platform: string): string {
  const meta = PLATFORM_CATALOG.find((entry) => entry.platform === platform);
  if (meta) return meta.displayName;
  const known = PROTOCOL_LABEL[platform as keyof typeof PROTOCOL_LABEL];
  if (known) return known;
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

export function shortenAddress(address: string): string {
  return address.length <= 12 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const ACCOUNT_ID_PLATFORMS = new Set([
  'binance',
  'okx',
  'bybit',
  'kraken',
  'gate',
  'bitget',
  'mexc',
  'variational',
]);

export function revealNoun(platform: string): string {
  return ACCOUNT_ID_PLATFORMS.has(platform) ? 'account ID' : 'address';
}

export function accountLabelFor(platform: string, accountId: string): string {
  if (!ACCOUNT_ID_PLATFORMS.has(platform)) return shortenAddress(accountId);
  const id = accountId.trim();
  if (id.length > 8) return `${id.slice(0, 4)}****${id.slice(-4)}`;
  if (id.length > 4) return `${id.slice(0, 2)}****${id.slice(-2)}`;
  return id;
}

export function formatJoined(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  const month = date.toLocaleString('en-US', { month: 'short' }).toLowerCase();
  return `Joined ${month} ${date.getFullYear()}`;
}
