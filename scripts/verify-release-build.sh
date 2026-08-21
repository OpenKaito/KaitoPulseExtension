#!/usr/bin/env bash
# Verify one packaged build directory before it is released.
#
# A release produces two builds from the same code, differing only in the
# manifest `key`, and each is verified with this script:
#
#   IDENTITY=pinned    what people download and load unpacked — must carry the
#                      key that derives to the allowlisted extension id, or it
#                      cannot sign in
#   IDENTITY=unpinned  the Chrome Web Store upload artifact — must carry no key
#
# Shared by scripts/release.sh and .github/workflows/release.yml so the local
# pre-flight and the released artifact are held to the same bar.
#
# Usage: VERSION=1.0.2 DIST=dist/chrome-mv3 IDENTITY=pinned bash scripts/verify-release-build.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERSION="${VERSION:?VERSION is required}"
DIST="${DIST:-dist/chrome-mv3}"
IDENTITY="${IDENTITY:?IDENTITY must be 'pinned' or 'unpinned'}"

# 1. Identity and permission surface. See scripts/verify-release-manifest.mjs.
VERSION="$VERSION" MANIFEST="${DIST}/manifest.json" IDENTITY="$IDENTITY" \
  node scripts/verify-release-manifest.mjs

# 2. The backend that is actually compiled in. The zip filename's `prod` half
# only reflects VITE_KAITO_ENV and the manifest check only reads the permission
# arrays — neither sees the API base URL. Without .env, src/lib/env.ts falls back
# to http://localhost:8080 and the build would still look like a production one.
if ! grep -rq 'https://hub\.kaito\.ai' "$DIST"; then
  echo "  ✗ the production backend URL is not in the build" >&2
  exit 1
fi
if grep -rlq 'localhost:8080' "$DIST" 2>/dev/null; then
  echo "  ✗ the localhost API fallback is in the build — .env did not reach it" >&2
  exit 1
fi
echo "  ✓ production backend compiled in, no localhost fallback"

# 3. Two x.com Content Security Policy constraints on the signal content script.
# Both fail silently in the browser, so they are asserted here.
TWITTER_JS="${DIST}/content-scripts/twitter.js"
if ! grep -q 'data:font/woff2;base64,' "$TWITTER_JS"; then
  echo "  ✗ fonts are not inlined into ${TWITTER_JS}" >&2
  exit 1
fi
if grep -q 'fonts.gstatic.com' "$TWITTER_JS"; then
  echo "  ✗ ${TWITTER_JS} references a font CDN; it must be blocked by font-src" >&2
  exit 1
fi
echo "  ✓ signal content script satisfies the x.com CSP constraints"
