export type ProofTarget = {
  domain: string;
  hostPattern: string;
  manifestRole: 'required' | 'optional';
  guideDomain?: string;
};

export const PROOF_TARGETS: readonly ProofTarget[] = [
  { domain: 'polymarket.com', hostPattern: 'https://*.polymarket.com/*', manifestRole: 'optional' },

  {
    domain: 'axisrobotics.ai',
    hostPattern: 'https://hub.axisrobotics.ai/*',
    manifestRole: 'optional',
  },

  { domain: 'x.com', hostPattern: 'https://*.x.com/*', manifestRole: 'required' },

  {
    domain: 'variational.io',
    hostPattern: 'https://omni.variational.io/*',
    manifestRole: 'optional',
  },

  { domain: 'lighter.xyz', hostPattern: 'https://app.lighter.xyz/*', manifestRole: 'optional' },
  {
    domain: 'zklighter.elliot.ai',
    hostPattern: 'https://mainnet.zklighter.elliot.ai/*',
    manifestRole: 'optional',
    guideDomain: 'lighter.xyz',
  },
];

export function optionalProofTargetPatterns(): string[] {
  return PROOF_TARGETS.filter((t) => t.manifestRole === 'optional').map((t) => t.hostPattern);
}

export function optionalPatternsForUrl(url: string): string[] {
  let host: string;
  try {
    host = normalizeHost(new URL(url).hostname);
  } catch {
    return [];
  }
  return PROOF_TARGETS.filter((t) => {
    if (t.manifestRole !== 'optional') return false;
    const domain = t.guideDomain ?? t.domain;
    return host === domain || host.endsWith(`.${domain}`);
  }).map((t) => t.hostPattern);
}

export function optionalPatternForUrl(url: string): string | null {
  return optionalPatternsForUrl(url)[0] ?? null;
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, '');
}

function isAllowedHost(host: string): boolean {
  return PROOF_TARGETS.some(({ domain }) => host === domain || host.endsWith(`.${domain}`));
}

export function checkProofTargetUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    console.warn('[proof-target] rejected an unparseable URL', url);
    return null;
  }
  if (parsed.protocol !== 'https:') {
    console.warn('[proof-target] rejected a non-https target', parsed.protocol, parsed.hostname);
    return null;
  }
  if (!isAllowedHost(normalizeHost(parsed.hostname))) {
    console.warn(
      `[proof-target] rejected "${parsed.hostname}": not a declared proof target. ` +
        'If this is a legitimate verification target, add it to PROOF_TARGETS in ' +
        'src/shared/proof-targets.ts — the manifest permission is derived from the same list.',
    );
    return null;
  }
  return url;
}
