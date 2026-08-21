#!/usr/bin/env bash
# Ensure vendor/primus-core/build/ exists before a vite build.
#
# Runs as a pre-step of `pnpm dev` / `pnpm build`. The first run after a fresh
# clone (or after a submodule SHA bump wiped build/) auto-triggers the one-time
# vendor build, so `pnpm dev` "just works" without manual ceremony. Once build/
# is present this is a near-instant file check with zero overhead.
#
# This intentionally does NOT rebuild when the submodule SHA changes but build/
# still exists — for that, run `pnpm build:vendor` explicitly.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# manifest.json is one of build-vendor.sh's required outputs, so its presence
# is a reliable sentinel for a completed vendor build.
if [ ! -f vendor/primus-core/build/manifest.json ]; then
  echo "[ensure-vendor] vendor build missing — running 'pnpm build:vendor' (one-time, ~1-2 min)…"
  pnpm build:vendor
fi
