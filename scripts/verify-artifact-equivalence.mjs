#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [storeInput, localInput] = process.argv.slice(2).filter((arg) => arg !== '--');

if (!storeInput || !localInput) {
  console.error('usage: node scripts/verify-artifact-equivalence.mjs <web-store.zip|crx> <local.zip>');
  process.exit(2);
}

const temporaryDirectories = [];

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function zipPathFor(input) {
  const path = resolve(input);
  const bytes = readFileSync(path);
  if (bytes.subarray(0, 4).toString('ascii') !== 'Cr24') {
    return { path, isCrx: false };
  }

  const version = bytes.readUInt32LE(4);
  let zipOffset;
  if (version === 2) {
    zipOffset = 16 + bytes.readUInt32LE(8) + bytes.readUInt32LE(12);
  } else if (version === 3) {
    zipOffset = 12 + bytes.readUInt32LE(8);
  } else {
    throw new Error(`unsupported CRX version ${version}: ${path}`);
  }
  if (bytes.subarray(zipOffset, zipOffset + 2).toString('ascii') !== 'PK') {
    throw new Error(`invalid CRX ZIP offset: ${path}`);
  }

  const directory = mkdtempSync(join(tmpdir(), 'kaito-crx-'));
  temporaryDirectories.push(directory);
  const extractedZip = join(directory, `${basename(path)}.zip`);
  writeFileSync(extractedZip, bytes.subarray(zipOffset));
  return { path: extractedZip, isCrx: true };
}

function unzip(zipPath, ...args) {
  const result = spawnSync('unzip', args, {
    encoding: args.includes('-Z1') ? 'utf8' : null,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`unzip failed for ${zipPath}: ${String(result.stderr || '').trim()}`);
  }
  return result.stdout;
}

function entries(zipPath) {
  return String(unzip(zipPath, '-Z1', zipPath))
    .split(/\r?\n/)
    .filter((entry) => entry && !entry.endsWith('/'))
    .sort();
}

function entryBytes(zipPath, entry) {
  return unzip(zipPath, '-p', zipPath, entry);
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

const WEB_STORE_UPDATE_URL = 'https://clients2.google.com/service/update2/crx';

function normalizedManifest(bytes) {
  const manifest = JSON.parse(bytes.toString('utf8'));
  const key = manifest.key;
  const updateUrl = manifest.update_url;
  delete manifest.key;
  delete manifest.update_url;
  return { key, updateUrl, bytes: Buffer.from(`${JSON.stringify(stable(manifest))}\n`) };
}

try {
  const store = zipPathFor(storeInput);
  const local = zipPathFor(localInput);
  const ignoredStoreEntries = store.isCrx
    ? (entry) => entry.startsWith('_metadata/') || entry.startsWith('META-INF/')
    : () => false;
  const storeEntries = entries(store.path).filter((entry) => !ignoredStoreEntries(entry));
  const localEntries = entries(local.path);

  const storeNames = new Set(storeEntries);
  const localNames = new Set(localEntries);
  for (const entry of storeEntries) {
    if (!localNames.has(entry)) fail(`missing from local artifact: ${entry}`);
  }
  for (const entry of localEntries) {
    if (!storeNames.has(entry)) fail(`missing from Web Store artifact: ${entry}`);
  }

  let compared = 0;
  for (const entry of storeEntries) {
    if (!localNames.has(entry)) continue;
    const storeBytes = entryBytes(store.path, entry);
    const localBytes = entryBytes(local.path, entry);
    if (entry === 'manifest.json') {
      const storeManifest = normalizedManifest(storeBytes);
      const localManifest = normalizedManifest(localBytes);
      if (!localManifest.key) fail('local artifact manifest has no key');
      if (storeManifest.key && storeManifest.key !== localManifest.key) {
        fail('Web Store and local manifest keys differ');
      }
      if (storeManifest.updateUrl && storeManifest.updateUrl !== WEB_STORE_UPDATE_URL) {
        fail(`Web Store manifest update_url is not the Chrome Web Store's: ${storeManifest.updateUrl}`);
      }

      if (localManifest.updateUrl) {
        fail(`local artifact manifest declares an update_url: ${localManifest.updateUrl}`);
      }
      if (digest(storeManifest.bytes) !== digest(localManifest.bytes)) {
        fail('manifest.json differs beyond the expected key and update_url fields');
      }
    } else if (digest(storeBytes) !== digest(localBytes)) {
      fail(`payload differs: ${entry}`);
    }
    compared += 1;
  }

  if (!process.exitCode) {
    console.log(`✓ ${compared} extension files match; only manifest.key, the Web Store update_url and CRX/store metadata are normalized`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { recursive: true, force: true });
  }
}
