
import { signalSettingsItem } from '@/shared/storage';

export type SignalSurfaceKey =
  | 'avatar.feed'
  | 'avatar.quoted'
  | 'avatar.usercell'
  | 'avatar.hovercard'
  | 'nametag.feed'
  | 'nametag.feedPopover'
  | 'nametag.hovercard'
  | 'stats.hovercard'
  | 'profile.usernameHistory'
  | 'profile.userInfo'

  | 'protocol.hyperliquid'
  | 'protocol.polymarket'

  | 'adFlag.feed'
  | 'tokenChart.feed';

export type SignalSettings = Partial<Record<SignalSurfaceKey, boolean>>;

export interface SignalSurfaceMeta {
  key: SignalSurfaceKey;
  label: string;
  description: string;

  parentKey?: SignalSurfaceKey;

  defaultOn?: boolean;
}

export interface SignalCategoryMeta {
  id: string;
  label: string;
  surfaces: SignalSurfaceMeta[];
}

export const SIGNAL_SURFACE_GROUPS: SignalCategoryMeta[] = [
  {
    id: 'avatar',
    label: 'Avatar badges',
    surfaces: [
      { key: 'avatar.feed', label: 'Feed tweet avatars', description: 'Badge on avatars in timeline tweets' },
      { key: 'avatar.quoted', label: 'Quoted tweet avatars', description: 'Badge on the quoted tweet / quoted Article author avatar inside a feed tweet' },
      { key: 'avatar.usercell', label: 'User cell avatars', description: '“Who to follow”, following/followers lists, search results, list members' },
      { key: 'avatar.hovercard', label: 'Hover card avatars', description: 'Avatar in the profile preview card shown on hover' },
    ],
  },
  {
    id: 'nametag',
    label: 'Name tags',
    surfaces: [
      { key: 'nametag.feed', label: 'Feed tweet name tag', description: 'Protocol pill on the display-name row (after the timestamp)' },
      { key: 'nametag.feedPopover', label: 'Hover data popover', description: 'Data card shown when hovering the feed name tag', parentKey: 'nametag.feed' },
      { key: 'nametag.hovercard', label: 'Hover card name tag', description: 'Protocol pill on the hover card name row', defaultOn: false },
    ],
  },
  {
    id: 'stats',
    label: 'Sector stats',
    surfaces: [
      { key: 'stats.hovercard', label: 'Hover card sector stats', description: 'Crypto/AI/Equity Trading Smart Follower row below the Following/Followers line' },
    ],
  },
  {
    id: 'profile',
    label: 'Profile modules',
    surfaces: [
      { key: 'profile.usernameHistory', label: 'Username history', description: 'Username history on the profile header @handle row' },
      { key: 'profile.userInfo', label: 'User info module', description: 'X / Hyperliquid / Polymarket card above the tab bar' },
    ],
  },
  {
    id: 'protocols',
    label: 'Protocol data',
    surfaces: [
      { key: 'protocol.hyperliquid', label: 'Show Hyperliquid data', description: 'Hyperliquid blocks in name tags / profile modules' },
      { key: 'protocol.polymarket', label: 'Show Polymarket data', description: 'Polymarket blocks in name tags / profile modules' },
    ],
  },
  {
    id: 'adFlag',
    label: 'Ad flag',
    surfaces: [
      { key: 'adFlag.feed', label: 'Flag as promotional content', description: 'Adds an "Ad?" button to feed tweets for flagging potential ads' },
    ],
  },
  {
    id: 'tokenChart',
    label: 'Token charts',
    surfaces: [
      {
        key: 'tokenChart.feed',
        label: 'Cashtag hover charts',
        description: 'Shows a Price + Sentiment chart popover when hovering a $TOKEN cashtag in a tweet',
      },
    ],
  },
];

export const ALL_SIGNAL_SURFACE_KEYS: SignalSurfaceKey[] =
  SIGNAL_SURFACE_GROUPS.flatMap((g) => g.surfaces.map((s) => s.key));

const DEFAULT_OFF_SURFACE_KEYS: ReadonlySet<SignalSurfaceKey> = new Set(
  SIGNAL_SURFACE_GROUPS.flatMap((g) => g.surfaces).filter((s) => s.defaultOn === false).map((s) => s.key),
);

function defaultOn(key: SignalSurfaceKey): boolean {
  return !DEFAULT_OFF_SURFACE_KEYS.has(key);
}

export function isEnabled(settings: SignalSettings, key: SignalSurfaceKey): boolean {
  const stored = settings[key];
  return stored === undefined ? defaultOn(key) : stored;
}

export async function loadSettings(): Promise<SignalSettings> {
  try {
    return await signalSettingsItem.getValue();
  } catch {
    return {};
  }
}

async function writeSettings(next: SignalSettings): Promise<void> {
  await signalSettingsItem.setValue(next);
}

export async function setSurface(key: SignalSurfaceKey, on: boolean): Promise<void> {
  const next: SignalSettings = { ...(await loadSettings()) };
  if (on === defaultOn(key)) delete next[key];
  else next[key] = on;
  await writeSettings(next);
}

export async function setMany(patch: Partial<Record<SignalSurfaceKey, boolean>>): Promise<void> {
  const next: SignalSettings = { ...(await loadSettings()) };
  for (const [k, on] of Object.entries(patch) as [SignalSurfaceKey, boolean][]) {
    if (on === defaultOn(k)) delete next[k];
    else next[k] = on;
  }
  await writeSettings(next);
}

export function subscribe(cb: (settings: SignalSettings) => void): () => void {
  return signalSettingsItem.watch((settings) => cb(settings));
}
