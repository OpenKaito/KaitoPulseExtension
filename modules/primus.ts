import { defineWxtModule } from 'wxt/modules';
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, relative, join } from 'node:path';
import { optionalProofTargetPatterns } from '../src/shared/proof-targets';

const VENDOR_BUILD_DIR = resolve('vendor/primus-core/build');
const VENDOR_SRC_DIR = resolve('vendor/primus-core');
const GPL3_TEXT_PATH = resolve('licenses/GPL-3.0.txt');
const VENDOR_VERSION_PATH = resolve('licenses/PRIMUS_VERSION');

const GPL3_ACCEPTED_SHA256 = new Set([
  '8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903',
  '3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986',
]);

const RUNTIME_GUARD_SCRIPT = 'kaito-runtime-guard.js';

const RUNTIME_GUARD_SOURCE = [
  '(() => {',
  '  const ignored = /Could not establish connection|Receiving end does not exist|The message port closed/i;',
  '  const isIgnored = (error) => ignored.test(error?.message || String(error));',
  "  globalThis.addEventListener?.('unhandledrejection', (event) => {",
  '    if (isIgnored(event.reason)) {',
  '      event.preventDefault();',
  "      console.debug('[kaito-ext] ignored optional message target miss:', event.reason?.message || String(event.reason));",
  '    }',
  '  });',
  '  const runtime = globalThis.chrome?.runtime;',
  '  if (!runtime?.sendMessage || runtime.__kaitoRuntimeGuardInstalled) return;',
  '  runtime.__kaitoRuntimeGuardInstalled = true;',
  '  const consumeLastError = () => {',
  "    const message = runtime.lastError?.message || '';",
  '    if (message && ignored.test(message)) {',
  "      console.debug('[kaito-ext] ignored optional message target miss:', message);",
  '    }',
  '  };',
  '  const wrapCallback = (callback) => (...args) => {',
  '    consumeLastError();',
  "    return typeof callback === 'function' ? callback(...args) : undefined;",
  '  };',
  '  const wrapPromise = (result) => {',
  "    if (!result || typeof result.catch !== 'function') return result;",
  '    return result.catch((error) => {',
  '      if (isIgnored(error)) {',
  "        console.debug('[kaito-ext] ignored optional message target miss:', error?.message || String(error));",
  '        return undefined;',
  '      }',
  '      throw error;',
  '    });',
  '  };',
  '  const sendMessage = runtime.sendMessage.bind(runtime);',
  '  runtime.sendMessage = (...args) => {',
  '    const last = args[args.length - 1];',
  "    if (typeof last === 'function') {",
  '      args[args.length - 1] = wrapCallback(last);',
  '      return wrapPromise(sendMessage(...args));',
  '    }',
  '    return sendMessage(...args, wrapCallback(() => undefined));',
  '  };',
  '})();',
  '',
].join('\n');

function patchAssert(source: string, find: string, replaceWith: string, label: string): string {
  if (!source.includes(find)) {
    throw new Error(
      `[primus] patch miss: ${label} — the match string was not found. The Primus fork has probably re-minified; re-extract it from the new bundle.`,
    );
  }
  return source.split(find).join(replaceWith);
}

function installSafeSendMessageHelpers(source: string): string {
  const helper =
    'var __kaitoIgnoredMessageError=/Could not establish connection|Receiving end does not exist|The message port closed/i,' +
    '__kaitoConsumeLastError=()=>{const e=chrome.runtime.lastError?.message||"";e&&__kaitoIgnoredMessageError.test(e)&&console.debug("[kaito-ext] ignored optional message target miss:",e)},' +
    '__kaitoWrapMessagePromise=e=>e&&"function"==typeof e.catch?e.catch(e=>{if(__kaitoIgnoredMessageError.test(e?.message||String(e)))return console.debug("[kaito-ext] ignored optional message target miss:",e?.message||String(e)),void 0;throw e}):e,' +
    '__kaitoWrapCallback=e=>(...t)=>(__kaitoConsumeLastError(),"function"==typeof e?e(...t):void 0),' +
    '__kaitoRuntimeSendMessage=(...e)=>{const t=e[e.length-1];return"function"==typeof t?(e[e.length-1]=__kaitoWrapCallback(t),__kaitoWrapMessagePromise(chrome.runtime.sendMessage(...e))):chrome.runtime.sendMessage(...e,__kaitoWrapCallback())},' +
    '__kaitoTabsSendMessage=(...e)=>{const t=e[e.length-1];return"function"==typeof t?(e[e.length-1]=__kaitoWrapCallback(t),__kaitoWrapMessagePromise(chrome.tabs.sendMessage(...e))):chrome.tabs.sendMessage(...e,__kaitoWrapCallback())};';

  const wrapped = source
    .split('chrome.runtime.sendMessage(')
    .join('__kaitoRuntimeSendMessage(')
    .split('chrome.tabs.sendMessage(')
    .join('__kaitoTabsSendMessage(');

  if (wrapped.includes('__kaitoRuntimeSendMessage')) {
    if (wrapped.startsWith('(()=>{')) {
      return wrapped.replace('(()=>{', `(()=>{${helper}`);
    }
    return `${helper}${wrapped}`;
  }

  return wrapped;
}

function patchPrimusPageDecodeTabCreation(source: string): string {

  if (!source.includes('kaitoPrimusDisallowTabCreate'))
    throw new Error(
      '[primus] expected upstreamed tab-reuse marker kaitoPrimusDisallowTabCreate missing from background bundle — vendor may have dropped it',
    );
  return source;
}

function patchPrimusRuntimeEntrypoints(text: string): string {
  let patched = text
    .split('files:["pageDecode.bundle.js"]')
    .join(`files:["${RUNTIME_GUARD_SCRIPT}","pageDecode.bundle.js"]`)
    .split("files: ['pageDecode.bundle.js']")
    .join(`files: ['${RUNTIME_GUARD_SCRIPT}', 'pageDecode.bundle.js']`);

  patched = patchPrimusPageDecodeTabCreation(patched);
  patched = installSafeSendMessageHelpers(patched);

  return patched;
}

function injectGuardIntoOffscreen(text: string): string {
  if (text.includes(`src="${RUNTIME_GUARD_SCRIPT}"`)) {
    return text;
  }
  return text.replace(
    '<script src="offscreen.js"></script>',
    `<script src="${RUNTIME_GUARD_SCRIPT}"></script>\n  <script src="offscreen.js"></script>`,
  );
}

function patchPrimusFloatingStatusUiJs(text: string): string {
  if (!text.includes('document.body.appendChild(g),console.log("content_scripts-content-decode inject"')) {
    return text;
  }
  return patchAssert(
    text,
    'document.body.appendChild(g),console.log("content_scripts-content-decode inject"',
    'g.style.display="none",document.body.appendChild(g),console.log("content_scripts-content-decode inject"',
    'floating status UI hide (pageDecode.bundle.js)',
  );
}

function appendPageDecodeHideRule(text: string): string {
  const hideRule =
    '#pado-extension-content{display:none!important;visibility:hidden!important;pointer-events:none!important}';
  if (text.includes(hideRule)) {
    return text;
  }
  return `${text}\n${hideRule}\n`;
}

const EXCLUDE_SENDER_PATCH = (relativeDest: string): boolean =>
  relativeDest === 'service-worker.js' ||
  relativeDest === 'background.bundle.js' ||
  relativeDest === 'background.js' ||
  relativeDest === 'background/worker.js' ||
  relativeDest.endsWith('content-scripts/twitter.js') ||
  relativeDest === 'content/twitter.js';

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = resolve(dir, entry);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

function unionStrings(...groups: Array<string[] | undefined>): string[] {
  return Array.from(new Set(groups.flatMap((g) => g || [])));
}

const VENDOR_ALLOWED_PERMISSIONS: readonly string[] = [
  'storage',
  'unlimitedStorage',
  'offscreen',
  'scripting',
  'webRequest',
  'cookies',
];

function assertVendorPermissions(vendorPermissions: unknown): string[] {
  if (vendorPermissions == null) return [];
  if (!Array.isArray(vendorPermissions) || vendorPermissions.some((p) => typeof p !== 'string')) {
    throw new Error(
      `[primus] vendor manifest "permissions" must be an array of strings: ${JSON.stringify(vendorPermissions)}`,
    );
  }
  const unreviewed = vendorPermissions.filter((p: string) => !VENDOR_ALLOWED_PERMISSIONS.includes(p));
  if (unreviewed.length > 0) {
    throw new Error(
      `[primus] vendor manifest declares unreviewed API permission(s): ${unreviewed.join(', ')}. ` +
        'Every permission in the shipped manifest has to be justified to the Chrome Web Store and to users — ' +
        'decide whether this one is needed, then add it to VENDOR_ALLOWED_PERMISSIONS in modules/primus.ts ' +
        'with a note saying who uses it.',
    );
  }
  return vendorPermissions;
}

function extensionReachableMatches(): string[] {
  return ['https://x.com/*', 'https://*.x.com/*', ...optionalProofTargetPatterns()];
}

function narrowVendorResourceMatches(
  entries: Array<{ resources: string[]; matches: string[] }> = [],
): Array<{ resources: string[]; matches: string[] }> {
  const reachable = extensionReachableMatches();
  return entries.map((entry) =>
    entry.matches?.includes('<all_urls>') ? { ...entry, matches: reachable } : entry,
  );
}

function mergeWebAccessibleResources(
  a: Array<{ resources: string[]; matches: string[] }> = [],
  b: Array<{ resources: string[]; matches: string[] }> = [],
) {
  const seen = new Set<string>(); const merged: typeof a = [];
  for (const entry of [...a, ...b]) {
    const key = JSON.stringify(entry);
    if (seen.has(key)) continue;
    seen.add(key); merged.push(entry);
  }
  return merged;
}

function primusLicenseAssets(): Array<{ relativeDest: string; contents: string }> {
  const lgpl = join(VENDOR_SRC_DIR, 'LICENSE');
  if (!existsSync(lgpl)) {
    throw new Error(
      '[primus] vendor/primus-core/LICENSE is missing — run `git submodule update --init` first',
    );
  }
  if (!existsSync(GPL3_TEXT_PATH)) {
    throw new Error(
      '[primus] licenses/GPL-3.0.txt is missing. LGPL-3.0 incorporates GPL-3.0 by '
      + 'reference, so the release artifact must carry both texts. Save the verbatim '
      + 'text from https://www.gnu.org/licenses/gpl-3.0.txt to licenses/GPL-3.0.txt.',
    );
  }
  const gpl = readFileSync(GPL3_TEXT_PATH, 'utf8');
  const gplDigest = createHash('sha256').update(gpl).digest('hex');
  if (!GPL3_ACCEPTED_SHA256.has(gplDigest)) {
    throw new Error(
      `[primus] licenses/GPL-3.0.txt has been modified (sha256 ${gplDigest}). The GPL `
      + 'text may only be distributed verbatim, so this build will not ship it. Restore '
      + 'a clean copy from https://www.gnu.org/licenses/gpl-3.0.txt. If the FSF has '
      + 'published a new revision, add its digest to GPL3_ACCEPTED_SHA256 deliberately '
      + `— see licenses/README.md.`,
    );
  }

  const commit = vendorCommit();
  return [
    {
      relativeDest: 'licenses/primus/LGPL-3.0.txt',
      contents: readFileSync(lgpl, 'utf8'),
    },
    {
      relativeDest: 'licenses/primus/GPL-3.0.txt',
      contents: gpl,
    },
    {
      relativeDest: 'licenses/primus/PRIMUS.txt',
      contents: [
        'Primus zkTLS core — GNU Lesser General Public License, version 3',
        '================================================================',
        '',
        'This extension is a COMBINED WORK. It includes code from the Primus',
        'browser extension, which is licensed under LGPL-3.0, alongside code',
        'authored by Kaito under a separate licence (see LICENSE in this package).',
        '',
        'The LGPL-3.0 portion, and any modification to it, remains under LGPL-3.0.',
        'Full licence texts accompany this file: LGPL-3.0.txt and GPL-3.0.txt.',
        '',
        'Complete corresponding source for the LGPL portion',
        '--------------------------------------------------',
        '',
        `  fork      https://github.com/OpenKaito/primus-extension-fork`,
        `  commit    ${commit}`,
        '  upstream  https://github.com/primus-labs/primus-extension',
        '',
        'The build-time modifications applied to that source while assembling this',
        'extension are in modules/primus.ts of the Kaito Pulse repository, at the',
        'same release tag as this artifact.',
        '',
        'Rebuilding or replacing the Primus portion',
        '------------------------------------------',
        '',
        '  1. git clone https://github.com/OpenKaito/primus-extension-fork',
        `  2. git checkout ${commit}    (or your own modified revision)`,
        '  3. Build it, then replace the corresponding files in this package.',
        '  4. Load the resulting directory via chrome://extensions -> Load unpacked.',
        '',
        'Nothing in the Kaito licence restricts reverse engineering, decompilation,',
        'modification or relinking to the extent needed to exercise these LGPL-3.0',
        'rights over the Primus portion.',
        '',
      ].join('\n'),
    },
  ];
}

function vendorCommit(): string {
  const fromGitlink = readGitlinkCommit();
  if (fromGitlink) {
    if (readFileIfExists(VENDOR_VERSION_PATH)?.trim() !== fromGitlink) {
      writeFileSync(VENDOR_VERSION_PATH, `${fromGitlink}\n`, 'utf8');
    }
    return fromGitlink;
  }

  const pinned = readFileIfExists(VENDOR_VERSION_PATH)?.trim();
  if (pinned && /^[0-9a-f]{40}$/.test(pinned)) return pinned;

  throw new Error(
    '[primus] cannot determine the pinned vendor/primus-core commit. It is required by '
    + 'the LGPL notice in the release artifact. Either restore the submodule gitlink, or '
    + 'commit the 40-character SHA to licenses/PRIMUS_VERSION.',
  );
}

function readGitlinkCommit(): string | undefined {
  try {
    const line = execSync('git ls-tree HEAD vendor/primus-core', { encoding: 'utf8' });
    const sha = /^\S+\s+commit\s+([0-9a-f]{40})\s/.exec(line)?.[1];
    return sha;
  } catch {
    return undefined;
  }
}

function readFileIfExists(path: string): string | undefined {
  return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
}

export default defineWxtModule({
  setup(wxt) {
    wxt.hook('build:publicAssets', (_, assets) => {
      if (!existsSync(join(VENDOR_BUILD_DIR, 'manifest.json'))) {
        throw new Error(
          '[primus] vendor/primus-core/build/ is missing — run `pnpm build:vendor` first',
        );
      }

      if (wxt.config.command === 'build') {
        for (const asset of primusLicenseAssets()) {
          assets.push(asset);
        }
      }
      for (const filePath of listFiles(VENDOR_BUILD_DIR)) {
        const relativeDest = relative(VENDOR_BUILD_DIR, filePath);
        if (relativeDest === 'manifest.json') continue;

        const isText = /\.(js|html|css)$/.test(relativeDest);
        if (!isText) {

          assets.push({ absoluteSrc: filePath, relativeDest });
          continue;
        }

        let text = readFileSync(filePath, 'utf8');
        if (relativeDest === 'background.bundle.js') {

          text = patchPrimusRuntimeEntrypoints(text);
        }
        if (relativeDest === 'pageDecode.bundle.js') {
          text = patchPrimusFloatingStatusUiJs(text);
        }
        if (relativeDest === 'static/css/pageDecode.css') {
          text = appendPageDecodeHideRule(text);
        }
        if (relativeDest === 'offscreen.html') {
          text = injectGuardIntoOffscreen(text);
        }
        if (relativeDest.endsWith('.js') && !EXCLUDE_SENDER_PATCH(relativeDest)) {

          text = installSafeSendMessageHelpers(text);
        }
        assets.push({ relativeDest, contents: text });
      }

      assets.push({ relativeDest: RUNTIME_GUARD_SCRIPT, contents: RUNTIME_GUARD_SOURCE });
    });

    wxt.hook('build:manifestGenerated', (_, manifest) => {
      const primus = JSON.parse(readFileSync(join(VENDOR_BUILD_DIR, 'manifest.json'), 'utf8'));
      const primusHostPermissions = primus.host_permissions;
      if (
        (Array.isArray(primusHostPermissions) && primusHostPermissions.length > 0)
        || (!Array.isArray(primusHostPermissions) && primusHostPermissions != null)
      ) {
        throw new Error(
          `[primus] vendor manifest must not declare required host_permissions: ${JSON.stringify(primusHostPermissions)}`,
        );
      }
      manifest.permissions = unionStrings(manifest.permissions, assertVendorPermissions(primus.permissions));

      if (primus.content_security_policy && wxt.config.command === 'build') {
        manifest.content_security_policy = primus.content_security_policy;
      }
      manifest.web_accessible_resources = mergeWebAccessibleResources(
        manifest.web_accessible_resources as any,
        narrowVendorResourceMatches(primus.web_accessible_resources),
      );

      if (manifest.externally_connectable?.matches) {
        manifest.externally_connectable.matches = manifest.externally_connectable.matches.filter(
          (m: string) => m !== 'http://localhost:5173/*',
        );
      }
    });
  },
});
