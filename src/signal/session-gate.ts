
import { meCacheItem, sessionItem } from '@/shared/storage';
import type { SignalSettings, SignalSurfaceKey } from './settings';

export const SIGNED_IN_ONLY_SURFACES: readonly SignalSurfaceKey[] = [
  'avatar.feed',
  'avatar.quoted',
  'avatar.usercell',
  'avatar.hovercard',
  'nametag.feed',
  'nametag.feedPopover',
  'nametag.hovercard',
  'stats.hovercard',
  'profile.usernameHistory',
  'profile.userInfo',
  'adFlag.feed',
  'tokenChart.feed',
];

export function gateSettings(settings: SignalSettings, signedIn: boolean): SignalSettings {
  if (signedIn) return settings;
  const gated: SignalSettings = { ...settings };
  for (const key of SIGNED_IN_ONLY_SURFACES) gated[key] = false;
  return gated;
}

export async function readSignedIn(): Promise<boolean> {
  try {
    return (await sessionItem.getValue()) !== null;
  } catch {
    return false;
  }
}

export async function readTermsOk(): Promise<boolean> {
  try {
    const me = await meCacheItem.getValue();
    return me?.termsAccepted !== false;
  } catch {
    return false;
  }
}

export function termsOkFromMe(me: { termsAccepted?: boolean } | null | undefined): boolean {
  return me?.termsAccepted !== false;
}
