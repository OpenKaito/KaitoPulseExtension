import { defineConfig } from 'wxt';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { remoteInline } from './scripts/vite-remote-inline';
import { mockStub } from './scripts/vite-mock-stub';
import { optionalProofTargetPatterns } from './src/shared/proof-targets';
import { toMatchPatterns } from './src/shared/connect-origins';

function assertNoMocks(outDir: string, logger: { info: (msg: string) => void }): void {
  const output = execSync(`node ${resolve('scripts/assert-no-mocks.mjs')} ${JSON.stringify(outDir)}`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  logger.info(output.trim());
}

function buildTimestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function gitOutput(command: string): string | undefined {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch {
    return undefined;
  }
}

function buildCommit(): string {
  const explicit = process.env.VITE_BUILD_COMMIT || process.env.GITHUB_SHA;
  const short = explicit ? explicit.slice(0, 7) : gitOutput('git rev-parse --short HEAD');
  if (!short) return 'local';
  const dirty = gitOutput('git status --porcelain') ? '-dirty' : '';
  return `${short}${dirty}`;
}

function envTag(mode: string): string {

  const target = process.env.VITE_KAITO_ENV || (mode === 'development' ? 'dev' : undefined);
  if (!target) return 'unknown';
  if (target === 'production') return 'prod';
  const normalized = target === 'development' ? 'dev' : target;

  if (normalized === 'dev' && /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(process.env.VITE_KAITO_API_BASE_URL || '')) {
    return 'local';
  }
  return normalized;
}

function identityTag(): string {
  return extensionIdentity() === 'unpinned' ? 'nokey' : 'storeid';
}

function zipTag(mode: string): string {
  const modeSuffix = mode === 'development' ? '-devmode' : '';
  return `${envTag(mode)}-${identityTag()}${modeSuffix}`;
}

function zipArtifactTemplate(tag: string): string {
  return `{{name}}-{{version}}-{{browser}}-${tag}-${buildTimestamp()}.zip`;
}

const PROD_EXTENSION_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAx3Qalrcva06OgksixIQX8Li4jj2hHFz6tZnMFvFzfR3De/HKyuH2XKSej5lR6LzX6vjtTBcabDiqnEp1IW9GLB23Pb3c9WkCn4+UORH804Lt6SHPmABrMau7bWzF41Xft+xLOHFnjEDNijQNs+qTKrUe4JZAaAhmabL5EOWYKQo+mFmGHXQ4FVVKyowSlxgVNI1mIh6NA+QQZUuTvA1ROz/T0Z3qUeXGmovtsKKJVPm//2hec6ySChgkZ3cSn7Y5hgxb4j6xmUF63b8CRcdT+UkdkJ26d7++XrcVxDsPpY2Efp2yhd1z/UeIFJY0okvf0gP+akpsxarhTbpv+20aYwIDAQAB';

type ExtensionIdentity = 'pinned' | 'unpinned';

function extensionIdentity(): ExtensionIdentity {
  return process.env.UNPINNED_EXTENSION_ID ? 'unpinned' : 'pinned';
}

function extensionKey(): string | undefined {
  return extensionIdentity() === 'unpinned' ? undefined : PROD_EXTENSION_KEY;
}

const REQUIRED_HOST_PERMISSIONS = [
  'https://x.com/*',
  'https://*.x.com/*',
];

const OPTIONAL_VERIFIER_HOST_PERMISSIONS = optionalProofTargetPatterns();

function deriveConnectableMatches(): string[] {
  return toMatchPatterns(import.meta.env.VITE_KAITO_CONNECT_URL as string | undefined);
}

export default defineConfig({
  srcDir: 'src',
  outDir: 'dist',

  outDirTemplate: '{{browser}}-mv{{manifestVersion}}{{modeSuffix}}',
  alias: { '@': resolve('src') },

  webExt: {
    disabled: true,
  },

  modules: ['@wxt-dev/module-solid', '@wxt-dev/auto-icons'],

  autoIcons: {
    developmentIndicator: 'overlay',
  },

  vite: (env) => ({
    define: {
      __KAITO_BUILD_COMMIT__: JSON.stringify(buildCommit()),
    },
    build: { sourcemap: false },
    plugins: [mockStub(env.mode !== 'development'), remoteInline()],

    resolve: {
      alias: {
        'json-formatter-js/dist/json-formatter.css': resolve('node_modules/json-formatter-js/dist/json-formatter.css'),
      },
    },
  }),
  hooks: {
    'zip:start': (wxt) => {

      wxt.config.zip.artifactTemplate = zipArtifactTemplate(zipTag(wxt.config.mode));

      wxt.logger.info(`[kaito] zip artifact: ${wxt.config.zip.artifactTemplate}`);

      if (wxt.config.mode !== 'development') assertNoMocks(wxt.config.outDir, wxt.logger);
    },
  },

  zip: {
    artifactTemplate: zipArtifactTemplate('unknown-unknown'),
  },

  manifest: () => ({
    name: 'Kaito Pulse',
    short_name: 'Kaito Pulse',
    description:
      'X activity insights, plus zkTLS proofs of your third-party platform data submitted to Kaito.',
    minimum_chrome_version: '120',
    key: extensionKey(),
    action: {
      default_title: 'Kaito Pulse',

      default_icon: { 16: 'icons/16.png', 32: 'icons/32.png', 48: 'icons/48.png', 128: 'icons/128.png' },
    },

    permissions: ['storage', 'alarms', 'scripting', 'webRequest'],
    host_permissions: [...REQUIRED_HOST_PERMISSIONS, ...deriveConnectableMatches()],
    optional_host_permissions: OPTIONAL_VERIFIER_HOST_PERMISSIONS,
    externally_connectable: {
      matches: deriveConnectableMatches(),
    },

  }),
});
