#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import process from 'node:process';

const ROOT = resolve(import.meta.dirname, '..');
const VENDOR_BUILD = join(ROOT, 'vendor/primus-core/build');
const MOCK_DIR = join(ROOT, 'src/mock');
const SRC_DIR = join(ROOT, 'src');
const DEFAULT_TARGET = join(ROOT, 'dist/chrome-mv3');

const isMockSource = (name) => name.endsWith('.ts') && !name.endsWith('.stub.ts') && name !== 'parity.ts';

function walk(dir, keep) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path, keep));
    else if (keep(path)) out.push(path);
  }
  return out;
}

function needlesFrom(source) {
  const found = new Set();
  for (const [, , text] of source.matchAll(/(['"])([^'"\n]{8,80})\1/g)) {

    if (/^[@~./]/.test(text) || text.includes('node:')) continue;
    found.add(text);
  }
  for (const [, digits] of source.matchAll(/\b(\d[\d_]{6,})\b/g)) {
    found.add(digits.replaceAll('_', ''));
  }
  return found;
}

const target = resolve(process.argv[2] ?? DEFAULT_TARGET);

let targetIsDir = false;
try {
  targetIsDir = statSync(target).isDirectory();
} catch {
  targetIsDir = false;
}
if (!targetIsDir) {
  console.error(`[assert-no-mocks] ${relative(ROOT, target)} is not a directory — nothing was checked`);
  process.exit(2);
}

const mockFiles = readdirSync(MOCK_DIR).filter(isMockSource);
if (mockFiles.length === 0) {

  console.log('[assert-no-mocks] no mock modules in src/mock/ — nothing to check');
  process.exit(0);
}

const shippedSource = walk(
  SRC_DIR,
  (p) => /\.(ts|tsx|css)$/.test(p) && (!p.startsWith(MOCK_DIR + '/') || p.endsWith('.stub.ts')),
)
  .map((p) => readFileSync(p, 'utf8'))
  .join('\n');

const needles = new Map();
const perModule = new Map();
for (const file of mockFiles) {
  const source = readFileSync(join(MOCK_DIR, file), 'utf8');
  let kept = 0;
  for (const needle of needlesFrom(source)) {
    if (shippedSource.includes(needle)) continue;
    needles.set(needle, file);
    kept += 1;
  }
  perModule.set(file, kept);
}

const bare = [...perModule].filter(([, count]) => count === 0).map(([file]) => file);
if (bare.length > 0) {
  console.error(
    `[assert-no-mocks] no mock-only literal could be derived from ${bare.join(', ')} — ` +
      `the check cannot prove anything about ${relative(ROOT, target)}. Give the module a distinctive ` +
      `string or number literal, or drop it from src/mock/.`,
  );
  process.exit(2);
}

let vendorCopies = new Set();
try {
  vendorCopies = new Set(readdirSync(VENDOR_BUILD));
} catch {

}

const artifacts = walk(target, (p) => /\.(js|mjs|css|html|json)$/.test(p) && !vendorCopies.has(basename(p)));
const hits = [];
for (const path of artifacts) {
  const content = readFileSync(path, 'utf8');
  for (const [needle, from] of needles) {
    if (content.includes(needle)) hits.push({ path: relative(ROOT, path), needle, from });
  }
}

if (hits.length > 0) {
  console.error(`[assert-no-mocks] ✖ mock content in ${relative(ROOT, target)}:`);
  for (const hit of hits) console.error(`  ${hit.path} contains ${JSON.stringify(hit.needle)} (src/mock/${hit.from})`);
  console.error(
    '  The resolve-time swap did not happen. Check that wxt.config.ts still passes ' +
      "mockStub(env.mode !== 'development') and that scripts/vite-mock-stub.ts's MOCK_MODULES lists every mock.",
  );
  process.exit(1);
}

console.log(
  `[assert-no-mocks] ✓ ${relative(ROOT, target)} is free of ${needles.size} mock-only literal(s) ` +
    `from ${mockFiles.length} mock module(s)`,
);
