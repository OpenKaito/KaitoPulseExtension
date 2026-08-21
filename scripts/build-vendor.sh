#!/usr/bin/env bash
# Build vendor/primus-core into vendor/primus-core/build/.
#
# Idempotent: re-running is fast (pnpm install --frozen-lockfile + webpack
# incremental). Use after `git submodule update` when the pinned fork SHA
# changes, or any time the build output looks stale.
#
# Uses the production webpack build. The fork carries a few TS-only issues
# in unused Achievements UI, so webpack.config.js runs ts-loader in
# transpile-only mode to keep a production-shaped bundle without the dev
# React Refresh runtime.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Ensure config is in place (idempotent; harmless if already done).
bash scripts/setup-vendor-config.sh

# Without this, a missing submodule turns into `cd` + `pnpm install` in an empty
# directory — pnpm then walks up and resolves against the root manifest, which
# looks like a baffling half-success instead of a clear failure.
if [ ! -f vendor/primus-core/package.json ]; then
  echo "[build-vendor] FAIL: vendor/primus-core is not checked out." >&2
  echo "[build-vendor]       Run: git submodule update --init --depth 1 vendor/primus-core" >&2
  exit 1
fi

cd vendor/primus-core

# Reproducibility gate.
#
# Use the fork's tracked pnpm lockfile so the pinned submodule SHA resolves to a
# reproducible dependency tree. The fallback remains for an older fork revision,
# but public builds are expected to take the frozen branch.
if git -C . ls-files --error-unmatch pnpm-lock.yaml >/dev/null 2>&1; then
  echo "[build-vendor] pnpm install --frozen-lockfile (vendor deps)..."
  pnpm install --frozen-lockfile --silent
else
  echo "[build-vendor] WARNING: the fork does not track a pnpm-lock.yaml, so this" >&2
  echo "[build-vendor]          install is not reproducible — the resolved tree" >&2
  echo "[build-vendor]          depends on the date it runs. Byte-level audit of" >&2
  echo "[build-vendor]          the vendor bundles is not meaningful until the" >&2
  echo "[build-vendor]          fork commits its lockfile." >&2
  pnpm install --silent
fi

echo "[build-vendor] pnpm run build..."
pnpm run build

# Sanity check.
for f in build/background.bundle.js \
         build/padoZKAttestationJSSDK.bundle.js \
         build/pageDecode.bundle.js \
         build/primus.js \
         build/manifest.json; do
  if [ ! -f "$f" ]; then
    echo "[build-vendor] FAIL: missing $f" >&2
    exit 1
  fi
done

echo "[build-vendor] ok — vendor/primus-core/build/ ready"
