
import { twitterIdMap } from "./twitter-id-map";

export function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, '').toLowerCase();
}

export function normalizeHandleFromHref(href: string | null | undefined): string | null {
  if (!href) return null;

  const pathname = href.startsWith('http')
    ? new URL(href).pathname
    : href;
  const handle = pathname.split('/').filter(Boolean)[0];

  return handle ? normalizeHandle(handle) : null;
}

export function normalizeHandleFromText(text: string | null | undefined): string | null {
  const match = text?.match(/@([A-Za-z0-9_]{1,15})/);
  return match?.[1] ? normalizeHandle(match[1]) : null;
}

function toBareTwitterId(value: string | null | undefined): string | null {
  if (!value) return null;
  const bare = value.startsWith('user:') ? value.slice('user:'.length) : value;
  return /^\d{1,32}$/.test(bare) ? bare : null;
}

export function resolveTwitterId(handle: string | null, idHint?: string | null): Promise<string | null> {
  const fromHint = toBareTwitterId(idHint);
  if (fromHint) return Promise.resolve(fromHint);
  if (handle) return twitterIdMap.resolveAsync(handle);
  return Promise.resolve(null);
}
