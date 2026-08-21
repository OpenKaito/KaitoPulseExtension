#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const PINNED_EXTENSION_ID = 'clfgaheindkfogpfcneoihannkgkhmna';

function extensionIdFromKey(base64Key) {
  const digest = createHash('sha256').update(Buffer.from(base64Key, 'base64')).digest('hex');
  return digest.slice(0, 32).replace(/[0-9a-f]/g, (c) => String.fromCharCode(97 + parseInt(c, 16)));
}

const version = process.env.VERSION;
const manifestPath = process.env.MANIFEST;
const identity = process.env.IDENTITY || 'unpinned';

if (!version || !manifestPath) {
  console.error('  ✗ usage: VERSION=<x.y.z> MANIFEST=<path> [IDENTITY=pinned|unpinned] node scripts/verify-release-manifest.mjs');
  process.exit(1);
}
if (identity !== 'pinned' && identity !== 'unpinned') {
  console.error(`  ✗ IDENTITY must be 'pinned' or 'unpinned', got '${identity}'`);
  process.exit(1);
}

let m;
try {
  m = JSON.parse(readFileSync(resolve(manifestPath), 'utf8'));
} catch (err) {
  console.error(`  ✗ cannot read ${manifestPath}: ${err.message}`);
  process.exit(1);
}

const fails = [];
const passes = [];

if (m.version !== version) {
  fails.push(`manifest version (${m.version}) ≠ package.json (${version})`);
} else {
  passes.push(`manifest version = ${version}`);
}

if (identity === 'unpinned') {

  if (m.key) {
    fails.push('manifest carries a `key` — not uploadable (expected UNPINNED_EXTENSION_ID=1 via pnpm zip:upload)');
  } else {
    passes.push('manifest carries no `key` (Web Store assigns the id on publish)');
  }
} else {

  if (!m.key) {
    fails.push('manifest carries no `key` — a build loaded unpacked would get a path-derived id and could not sign in (UNPINNED_EXTENSION_ID must NOT be set for this build)');
  } else {
    const id = extensionIdFromKey(m.key);
    if (id !== PINNED_EXTENSION_ID) {
      fails.push(`manifest key derives to ${id}, not the allowlisted ${PINNED_EXTENSION_ID} — this build could not sign in`);
    } else {
      passes.push(`manifest key derives to the allowlisted id ${PINNED_EXTENSION_ID}`);
    }
  }
}

const surface = [
  ...(m.host_permissions || []),
  ...((m.externally_connectable && m.externally_connectable.matches) || []),
];
const leaks = surface.filter((p) => /dev-hub\.kaito\.ai|localhost/.test(p));
if (leaks.length) {
  fails.push(`dev/local origins left in the permission surface: ${leaks.join(', ')}`);
} else {
  passes.push('host_permissions + externally_connectable carry no dev or localhost origin');
}

const expectedVerifierOrigins = new Set([
  'https://*.polymarket.com/*',
  'https://hub.axisrobotics.ai/*',
]);
const actualVerifierOrigins = new Set(m.optional_host_permissions || []);
const missingVerifierOrigins = [...expectedVerifierOrigins].filter((origin) => !actualVerifierOrigins.has(origin));
const unexpectedVerifierOrigins = [...actualVerifierOrigins].filter((origin) => !expectedVerifierOrigins.has(origin));
if (missingVerifierOrigins.length || unexpectedVerifierOrigins.length) {
  if (missingVerifierOrigins.length) {
    fails.push(`missing verifier origins: ${missingVerifierOrigins.join(', ')}`);
  }
  if (unexpectedVerifierOrigins.length) {
    fails.push(`unexpected verifier origins: ${unexpectedVerifierOrigins.join(', ')}`);
  }
} else if (!(m.host_permissions || []).includes('https://*.x.com/*')) {
  fails.push('x.com verifier origin is missing from host_permissions');
} else {
  passes.push('verifier origins are limited to X, Polymarket, and Axis');
}

console.log(`  · ${manifestPath} (expected identity: ${identity})`);
for (const p of passes) console.log('  ✓ ' + p);
for (const f of fails) console.error('  ✗ ' + f);
process.exit(fails.length ? 1 : 0);
