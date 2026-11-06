export const DEFAULT_CONNECT_ORIGIN = 'https://kaito.ai';

function parseEntries(connectOrigin: string | undefined): string[] {
  const entries = (connectOrigin || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries.length > 0 ? entries : [DEFAULT_CONNECT_ORIGIN];
}

function normalizeOrigin(entry: string): string {
  try {
    const url = new URL(entry);
    return `${url.protocol}//${url.host}`;
  } catch {
    return entry;
  }
}

export function toOriginList(connectOrigin?: string): string[] {
  return Array.from(new Set(parseEntries(connectOrigin).map(normalizeOrigin)));
}

export function toMatchPatterns(connectOrigin?: string): string[] {
  const matches = new Set<string>();
  for (const entry of parseEntries(connectOrigin)) {
    try {
      const url = new URL(entry.includes('://') ? entry : `https://${entry}`);
      const host = url.hostname;
      const isPlainHost = !host.includes('.') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
      matches.add(`${url.protocol}//${host}/*`);
      if (!isPlainHost) matches.add(`${url.protocol}//*.${host}/*`);
    } catch {}
  }
  return Array.from(matches);
}

export const ACCOUNT_CHOICE_PARAM = 'prompt';
export const ACCOUNT_CHOICE_VALUE = 'select_account';

export function withAccountChoice(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.pathname !== '/login' || !parsed.searchParams.has('extensionId')) return url;
    parsed.searchParams.set(ACCOUNT_CHOICE_PARAM, ACCOUNT_CHOICE_VALUE);
    return parsed.toString();
  } catch {
    return url;
  }
}
