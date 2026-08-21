
type LandingOverride = { verifierId: string; platform?: never; path: string } | { platform: string; verifierId?: never; path: string };

const LANDING_OVERRIDES: readonly LandingOverride[] = [
  { verifierId: 'x_analytics_overview', path: '/i/account_analytics' },
  { platform: 'polymarket', path: '/portfolio' },
];

export function verifierLandingUrl(
  verifier: { id: string; platform: string },
  guideUrl: string
): string {
  const override = LANDING_OVERRIDES.find((entry) =>
    entry.verifierId === undefined ? entry.platform === verifier.platform : entry.verifierId === verifier.id
  );
  if (!override) {
    return guideUrl;
  }

  let url: URL;
  try {
    url = new URL(guideUrl);
  } catch {
    return guideUrl;
  }

  const current = url.pathname.replace(/\/+$/, '');
  if (current === override.path || current.startsWith(`${override.path}/`)) {
    return guideUrl;
  }

  url.pathname = override.path;
  url.search = '';
  url.hash = '';
  return url.toString();
}
