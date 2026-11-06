function normalizePath(value: string): string {
  const trimmed = value.replace(/\/+$/, '');
  return trimmed.length > 0 ? trimmed : '/';
}

function routePath(url: URL): string {
  const base = normalizePath(url.pathname);
  const hashRoute = url.hash.replace(/^#\/?/, '');
  if (!hashRoute) {
    return base;
  }
  const combined = base === '/' ? `/${hashRoute}` : `${base}/${hashRoute}`;
  return normalizePath(combined);
}

function segmentCount(path: string): number {
  return path === '/' ? 0 : path.split('/').length - 1;
}

function routePathsAlign(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }
  if (b.startsWith(`${a}/`) || b.endsWith(a)) {
    return true;
  }
  return segmentCount(b) >= 2 && (a.startsWith(`${b}/`) || a.endsWith(b));
}

export function verifierUrlMatches(candidateUrl: string | undefined, guideUrl: string): boolean {
  if (!candidateUrl) {
    return false;
  }

  try {
    const guide = new URL(guideUrl);
    const candidate = new URL(candidateUrl);
    if (guide.origin !== candidate.origin) {
      return false;
    }

    const guidePath = routePath(guide);
    if (guidePath === '/') {
      return true;
    }
    return routePathsAlign(guidePath, routePath(candidate));
  } catch {
    return candidateUrl.startsWith(guideUrl);
  }
}

export function verifierOriginMatches(candidateUrl: string | undefined, guideUrl: string): boolean {
  if (!candidateUrl) {
    return false;
  }
  try {
    return new URL(candidateUrl).origin === new URL(guideUrl).origin;
  } catch {
    return false;
  }
}

export function navigationEndsProof(url: string, guideUrl: string, newDocument: boolean): boolean {
  if (verifierUrlMatches(url, guideUrl)) {
    return false;
  }
  return newDocument || !verifierOriginMatches(url, guideUrl);
}

export function verifierTabKey(guideUrl: string): string {
  try {
    const url = new URL(guideUrl);
    return `${url.origin}${routePath(url)}`;
  } catch {
    return guideUrl;
  }
}

const KNOWN_ROUTE_SEGMENTS = new Set([
  'i',
  'flow',
  'login',
  'logout',
  'signup',
  'home',
  'explore',
  'search',
  'notifications',
  'messages',
  'settings',
  'account',
  'access',
  'account_analytics',
  'premium',
  'premium_sign_up',
  'verified-choose',
  'status',
  'compose',
  'intent',
  'oauth',
  'authorize',
  'callback',
  'my',
  'wallet',
  'dashboard',
  'referral',
  'portfolio',
  'points',
  'balance',
  'overview',
]);

function isXHost(host: string): boolean {
  return (
    host === 'x.com' ||
    host.endsWith('.x.com') ||
    host === 'twitter.com' ||
    host.endsWith('.twitter.com')
  );
}

export function navigationTargetForLog(url: string, guideUrl?: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.origin === 'null') return parsed.protocol;
    const guideSegments = new Set(guideUrl ? new URL(guideUrl).pathname.split('/') : []);
    const segments = parsed.pathname.split('/');
    const xFeaturePath = isXHost(parsed.hostname) && segments[1] === 'i';
    const path = segments
      .map((segment) =>
        segment === '' ||
        KNOWN_ROUTE_SEGMENTS.has(segment) ||
        guideSegments.has(segment) ||
        (xFeaturePath && /^[a-z][a-z_-]{0,40}$/.test(segment))
          ? segment
          : ':x',
      )
      .join('/');
    return `${parsed.origin}${path}`;
  } catch {
    return 'unparseable';
  }
}

const REDACTION_INPUT_LIMIT = 4000;

const REDACTIONS: [RegExp, string | ((match: string) => string)][] = [
  [/(https?:\/\/[^\s"'\\?#]{1,500})[?#][^\s"'\\]*/g, '$1'],
  [/\b(bearer|basic)\s+[\w\-.~+/]+=*/gi, '$1 [redacted]'],
  [
    /((?:authori[sz]ation|cookie|set-cookie|csrf[\w-]*|[\w-]*token|password|passphrase|secret|session[\w-]*|signature|api[_-]?key|private[_-]?key|mnemonic|seed)\\?"?\s*[:=]\s*)(\\?"[^"\\]*\\?"|[^\s,;}&]+)/gi,
    '$1[redacted]',
  ],
  [/[\w.+-]{1,64}@[\w-]{1,63}(?:\.[\w-]{1,63}){1,8}/g, '[email]'],
  [
    /\b[A-Za-z0-9_-]{32,}\b/g,
    (match) => (/^[a-z]+(?:_[a-z]+)+$/.test(match) ? match : '[redacted]'),
  ],
];

export function redactFailureMessage(message: string): string {
  return REDACTIONS.reduce(
    (text, [pattern, replacement]) =>
      typeof replacement === 'string'
        ? text.replace(pattern, replacement)
        : text.replace(pattern, replacement),
    message.slice(0, REDACTION_INPUT_LIMIT),
  );
}

export type MainFrameOutcome = { error?: string; status?: number; at: number };

export function formatPageState(input: {
  url?: string;
  loadStatus?: string;
  guideUrl?: string;
  mainFrame?: MainFrameOutcome;
  since?: number;
}): string {
  const parts = [
    `page=${input.url ? navigationTargetForLog(input.url, input.guideUrl) : 'unknown'}`,
  ];
  if (input.loadStatus) parts.push(`load=${input.loadStatus.replace(/\W/g, '').slice(0, 12)}`);
  const frame = input.mainFrame;
  if (frame && frame.at >= (input.since ?? 0)) {
    if (frame.error) parts.push(`net=${frame.error.replace(/[^\w:.-]/g, '').slice(0, 48)}`);
    else if (typeof frame.status === 'number') parts.push(`http=${frame.status}`);
  }
  return parts.join(' ');
}
