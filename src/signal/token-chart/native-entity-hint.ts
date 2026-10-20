const NATIVE_ENTITY_TOKEN = /(?:^|[\s(])([A-Za-z0-9._-]{1,64}:native)(?=$|[\s)])/gi;

export function parseNativeEntityHint(href: string | null | undefined): string | undefined {
  if (typeof href !== 'string' || !href.trim()) return undefined;

  try {
    const query = new URL(href, 'https://x.com').searchParams.get('q');
    if (!query) return undefined;
    const matches = [...query.matchAll(NATIVE_ENTITY_TOKEN)].map((match) => match[1]);
    return matches.length === 1 ? matches[0] : undefined;
  } catch {
    return undefined;
  }
}
