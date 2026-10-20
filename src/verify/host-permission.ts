import { optionalPatternsForUrl } from '@/shared/proof-targets';

export type HostPermissionOutcome =
  | { ok: true }
  | { ok: false; reason: 'denied' }
  | { ok: false; reason: 'unavailable' };

export async function ensureProofHostPermission(targetUrl: string): Promise<HostPermissionOutcome> {
  const origins = optionalPatternsForUrl(targetUrl);
  if (origins.length === 0) return { ok: true };

  const permissions = chrome.permissions;
  if (!permissions?.request || !permissions.contains) return { ok: false, reason: 'unavailable' };

  try {
    if (await permissions.contains({ origins })) return { ok: true };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  try {
    const granted = await permissions.request({ origins });
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
