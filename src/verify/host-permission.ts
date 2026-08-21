
import { optionalPatternForUrl } from '@/shared/proof-targets';

export type HostPermissionOutcome =

  | { ok: true }

  | { ok: false; reason: 'denied' }

  | { ok: false; reason: 'unavailable' };

export async function ensureProofHostPermission(targetUrl: string): Promise<HostPermissionOutcome> {
  const pattern = optionalPatternForUrl(targetUrl);
  if (!pattern) return { ok: true };

  const permissions = chrome.permissions;
  if (!permissions?.request || !permissions.contains) return { ok: false, reason: 'unavailable' };

  try {
    if (await permissions.contains({ origins: [pattern] })) return { ok: true };
  } catch {

    return { ok: false, reason: 'unavailable' };
  }

  try {
    const granted = await permissions.request({ origins: [pattern] });
    return granted ? { ok: true } : { ok: false, reason: 'denied' };
  } catch {

    return { ok: false, reason: 'unavailable' };
  }
}

export function permissionHostLabel(targetUrl: string): string {
  try {
    return new URL(targetUrl).hostname;
  } catch {
    return targetUrl;
  }
}
