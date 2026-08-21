#!/usr/bin/env bash
# Kaito Extension release packaging — a gate, and nothing else.
#
# The gate: package.json's "version" must not have been released, i.e. no git tag
# v<version> exists. If one does, packaging is refused. That is what forces
# "a real release starts by bumping the version": the Chrome Web Store rejects a
# repeat upload of the same version, so a version may only be packaged once.
#
# Past the gate:
#   1. pnpm zip:upload — the ONLY build that leaves out the manifest `key`
#      (UNPINNED_EXTENSION_ID), because the Web Store assigns the id on publish.
#      Every other build is pinned to the allowlisted extension id. It runs in
#      production mode; the version is baked into the manifest and zip filename.
#   2. A pre-release self-check (scripts/verify-release-build.sh): the manifest
#      version matches package.json, it carries no `key`, host_permissions and
#      externally_connectable carry no dev or localhost origin, the production
#      backend is compiled in, and the signal content script still satisfies the
#      x.com CSP constraints.
#   3. A local annotated tag v<version>. Pushing it here publishes nothing —
#      the release is built in the public repository, from what
#      `pnpm publish:oss` exports. Push it anyway; this gate reads it next time.
#
# Usage: edit package.json's "version" by hand, then
#
#   pnpm release
#   git push origin v<version>
#   pnpm publish:oss             # then follow what it prints
#
# Gate note: the authoritative record of what shipped is the tag in the public
# repository, since that is where releases are built. The local tag is checked
# first because it is free; an unreachable remote warns rather than blocks. Run
# `git fetch --tags` first, or a version a colleague already cut looks free.
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="$(node -p "require('./package.json').version")"
TAG="v${VERSION}"

echo "▸ current version: ${VERSION}"

if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  cat >&2 <<EOF
✗ ${TAG} has already been released (the git tag exists).
  A real release starts by bumping the version:
    1. Edit "version" in package.json (patch/minor/major is your call)
    2. Run pnpm release again
EOF
  exit 1
fi
echo "✓ ${TAG} has not been released locally (no such tag)"

# URL from package.json rather than a second copy of the string.
# GIT_TERMINAL_PROMPT=0 so an unauthenticated checkout fails fast instead of
# blocking the release on a credential prompt nobody is watching for.
OSS_URL="$(node -p "require('./package.json').repository.url" | sed 's/^git+//')"
if OSS_TAGS="$(GIT_TERMINAL_PROMPT=0 git ls-remote --tags "${OSS_URL}" "refs/tags/${TAG}" 2>/dev/null)"; then
  if [ -n "${OSS_TAGS}" ]; then
    cat >&2 <<EOF
✗ ${TAG} has already been published (the tag exists in ${OSS_URL}).
  A published version is published — the Chrome Web Store will reject a repeat
  upload of it. Bump "version" in package.json and run pnpm release again.
EOF
    exit 1
  fi
  echo "✓ ${TAG} has not been published (no such tag in the public repository)"
else
  echo "  ⚠ could not reach ${OSS_URL} — the published-version check was skipped."
  echo "    The local tag above is the only gate that ran."
fi

echo "▸ wxt zip (production, unpinned extension id)…"
pnpm zip:upload

# ── Pre-release self-check ────────────────────────────────────────────────
# The assertions live in scripts/verify-release-build.sh, shared with the
# tag-triggered GitHub Release workflow so the two cannot drift. IDENTITY=unpinned
# because this is the Web Store upload artifact: it must carry NO manifest key.
# (The workflow additionally builds the pinned download artifact and checks that
# one with IDENTITY=pinned.)
echo "▸ pre-release self-check…"
if ! VERSION="${VERSION}" DIST="dist/chrome-mv3" IDENTITY=unpinned \
     bash scripts/verify-release-build.sh; then
  echo "✗ self-check failed — do not upload the zip that was produced (most likely this was not a production build)." >&2
  exit 1
fi

if ! git diff --quiet -- package.json || ! git diff --cached --quiet -- package.json; then
  echo "  ⚠ package.json has uncommitted changes; the tag will point at HEAD, without them. Commit first."
fi
git tag -a "${TAG}" -m "release ${TAG}"
echo "✓ created local tag ${TAG}"

# Only a zip tagged with BOTH halves counts: `prod` (production backend, from
# VITE_KAITO_ENV) and `nokey` (no manifest key, from UNPINNED_EXTENSION_ID) —
# see zipTag() in wxt.config.ts. Matching the pair, not the `prod` substring, is
# what makes it impossible for this script to print a dev, local, unknown or
# key-carrying build as the artifact and have someone upload it by hand. A
# substring match on `prod` alone would also catch `-prod-storeid-`, which is
# pinned to the live store id and must never be uploaded.
ZIP="$(ls -t dist/*-prod-nokey-*.zip 2>/dev/null | head -1 || true)"
echo
echo "✅ release complete: ${VERSION}"
if [ -n "${ZIP}" ]; then
  echo "   artifact: ${ZIP}"
else
  echo "   ⚠ no *-prod-nokey-*.zip in dist/ — most likely not a production build (VITE_KAITO_ENV), or the key-less opt-out did not apply. Do not upload anything." >&2
fi
echo
echo "   next:"
echo "     git push origin ${TAG}"
echo "     pnpm publish:oss"
echo
echo "   publish:oss exports this tree through scripts/oss-manifest.txt, re-runs the"
echo "   public-source hygiene check over the export, and stages ${TAG} in the public"
echo "   repository. It pushes nothing; it prints the diff."
echo
echo "   Pushing that tag publishes the release. The workflow there rebuilds from"
echo "   that commit, re-runs these checks, attests both zips, and drafts a Release:"
echo "     kaito-extension-${VERSION}.zip           download and load unpacked"
echo "     kaito-extension-webstore-${VERSION}.zip  Chrome Web Store upload artifact"
echo "   Review the draft, publish it, upload the -webstore one to the dev console."
