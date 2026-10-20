import type { SignalProtocol } from './types';

export type PlatformCategory = 'perps' | 'cex' | 'prediction' | 'memecoin';

export interface SignalPlatformMeta {
  label: string;

  category: PlatformCategory;

  snapshot: boolean;
}

export const SIGNAL_PLATFORMS: Record<SignalProtocol, SignalPlatformMeta> = {
  hyperliquid: { label: 'Hyperliquid', category: 'perps', snapshot: false },
  polymarket: { label: 'Polymarket', category: 'prediction', snapshot: false },
  fomo: { label: 'Fomo', category: 'memecoin', snapshot: false },
  pumpfun: { label: 'Pump.fun', category: 'memecoin', snapshot: false },
  binance: { label: 'Binance', category: 'cex', snapshot: true },
  okx: { label: 'OKX', category: 'cex', snapshot: true },
  bybit: { label: 'Bybit', category: 'cex', snapshot: true },
  variational: { label: 'Variational', category: 'perps', snapshot: true },
  lighter: { label: 'Lighter', category: 'perps', snapshot: false },
};

export const SIGNAL_PROTOCOLS = Object.keys(SIGNAL_PLATFORMS) as SignalProtocol[];

export const PLATFORM_CATEGORIES: ReadonlyArray<{ key: PlatformCategory; label: string }> = [
  { key: 'perps', label: 'Perps' },
  { key: 'cex', label: 'CEX' },
  { key: 'prediction', label: 'Prediction' },
  { key: 'memecoin', label: 'Memecoin' },
];

const CATEGORY_MEMBER_ORDER: SignalProtocol[] = [
  'hyperliquid',
  'lighter',
  'variational',
  'binance',
  'okx',
  'bybit',
  'polymarket',
  'fomo',
  'pumpfun',
];

export const CATEGORY_TABS_MIN_PLATFORMS = 5;

export function isSignalProtocol(name: string): name is SignalProtocol {
  return Object.hasOwn(SIGNAL_PLATFORMS, name);
}

export function platformCategory(
  protocol: SignalProtocol,
  served?: string | null,
): PlatformCategory {
  const known = PLATFORM_CATEGORIES.find((c) => c.key === served);
  return known ? known.key : SIGNAL_PLATFORMS[protocol].category;
}

export function isSnapshotPlatform(protocol: SignalProtocol, source?: string | null): boolean {
  return source == null ? SIGNAL_PLATFORMS[protocol].snapshot : source === 'attestation';
}

type CardPlatforms = Partial<Record<SignalProtocol, unknown>> & {
  platformMetrics?: Partial<Record<SignalProtocol, unknown>>;
};

export function boundPlatforms(data: CardPlatforms): SignalProtocol[] {
  return SIGNAL_PROTOCOLS.filter(
    (protocol) => data[protocol] != null || data.platformMetrics?.[protocol] != null,
  );
}

export type ProfileTab = 'x' | SignalProtocol;

export function profileTabs(data: CardPlatforms): ProfileTab[] {
  return ['x', ...boundPlatforms(data)];
}

export interface CategoryTab {
  category: PlatformCategory;
  label: string;
  platforms: SignalProtocol[];
}

export type PopoverLayout =
  | { kind: 'flat'; platforms: SignalProtocol[] }
  | { kind: 'tabs'; tabs: CategoryTab[] };

export function popoverLayout(
  platforms: SignalProtocol[],
  categories: Partial<Record<SignalProtocol, PlatformCategory>> = {},
): PopoverLayout {
  if (platforms.length < CATEGORY_TABS_MIN_PLATFORMS) return { kind: 'flat', platforms };
  const tabs = PLATFORM_CATEGORIES.map(({ key, label }) => ({
    category: key,
    label,
    platforms: platforms
      .filter((p) => (categories[p] ?? platformCategory(p)) === key)
      .sort((a, b) => CATEGORY_MEMBER_ORDER.indexOf(a) - CATEGORY_MEMBER_ORDER.indexOf(b)),
  })).filter((tab) => tab.platforms.length > 0);
  return { kind: 'tabs', tabs };
}
