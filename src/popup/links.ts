
import { ENV } from '@/lib/env';

function buildSiteUrl(pathname: string): string {
  try {
    const url = new URL(ENV.connectOrigin);
    url.pathname = pathname;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return ENV.connectOrigin;
  }
}

export const AURA_SETUP_URL = buildSiteUrl('/aura');

export function openAuraSetup(): void {
  window.open(AURA_SETUP_URL, '_blank', 'noopener');
}

export const VERIFICATION_HUB_URL = buildSiteUrl('/verification-hub');

export function openVerificationHub(): void {
  window.open(VERIFICATION_HUB_URL, '_blank', 'noopener');
}

export const MY_SOCIALS_URL = buildSiteUrl('/my-socials');

export function siteUrlFromWire(wireUrl: string | null | undefined, fallback: string): string {
  if (!wireUrl) return fallback;
  try {
    const target = new URL(wireUrl, ENV.connectOrigin);
    const site = new URL(ENV.connectOrigin);

    target.protocol = site.protocol;
    target.host = site.host;
    return target.toString();
  } catch {
    return fallback;
  }
}
