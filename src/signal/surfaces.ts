import type { SignalSurfaceKey } from "./settings";

export type AnchorKind =
  | 'feed-avatar'
  | 'quoted-avatar'
  | 'feed-name'
  | 'feed-adflag'
  | 'feed-cashtag'
  | 'usercell-avatar'
  | 'hovercard-avatar'
  | 'hovercard-name'
  | 'hovercard-stats';

export type WidgetKind = 'avatar' | 'nametag' | 'popover' | 'stats' | 'adflag' | 'tokenPopover';

export type ScanKind = 'feed' | 'userCell' | 'hoverCard';

export interface SurfaceDef {
  key: SignalSurfaceKey;
  anchor: AnchorKind;
  widget: WidgetKind;

  parent?: SignalSurfaceKey;
}

export const ORCHESTRATOR_SURFACE_REGISTRY: SurfaceDef[] = [
  { key: 'avatar.feed', anchor: 'feed-avatar', widget: 'avatar' },

  { key: 'avatar.quoted', anchor: 'quoted-avatar', widget: 'avatar' },
  { key: 'avatar.usercell', anchor: 'usercell-avatar', widget: 'avatar' },
  { key: 'avatar.hovercard', anchor: 'hovercard-avatar', widget: 'avatar' },
  { key: 'nametag.feed', anchor: 'feed-name', widget: 'nametag' },
  { key: 'nametag.feedPopover', anchor: 'feed-name', widget: 'popover', parent: 'nametag.feed' },
  { key: 'nametag.hovercard', anchor: 'hovercard-name', widget: 'nametag' },
  { key: 'stats.hovercard', anchor: 'hovercard-stats', widget: 'stats' },
  { key: 'adFlag.feed', anchor: 'feed-adflag', widget: 'adflag' },
  { key: 'tokenChart.feed', anchor: 'feed-cashtag', widget: 'tokenPopover' },
];

const ANCHOR_SCAN: Record<AnchorKind, ScanKind> = {
  'feed-avatar': 'feed',
  'quoted-avatar': 'feed',
  'feed-name': 'feed',
  'feed-adflag': 'feed',
  'feed-cashtag': 'feed',
  'usercell-avatar': 'userCell',
  'hovercard-avatar': 'hoverCard',
  'hovercard-name': 'hoverCard',
  'hovercard-stats': 'hoverCard',
};

export function scanForAnchor(anchor: AnchorKind): ScanKind {
  return ANCHOR_SCAN[anchor];
}
