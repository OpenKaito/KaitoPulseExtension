
export function isAllowedOrigin(url: string | undefined, allowed: string[]): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const origin = `${parsed.protocol}//${parsed.host}`;
  return allowed.some((entry) => {
    try {
      const allowedUrl = new URL(entry);
      if (allowedUrl.protocol !== parsed.protocol) return false;
      return allowedUrl.host === parsed.host || (allowedUrl.host.startsWith('.')
        ? parsed.host.endsWith(allowedUrl.host)
        : parsed.host === allowedUrl.host || parsed.host.endsWith(`.${allowedUrl.host}`));
    } catch {
      return origin === entry;
    }
  });
}
