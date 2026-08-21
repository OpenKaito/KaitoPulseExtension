
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

export function verifierTabKey(guideUrl: string): string {
  try {
    const url = new URL(guideUrl);
    return `${url.origin}${routePath(url)}`;
  } catch {
    return guideUrl;
  }
}
