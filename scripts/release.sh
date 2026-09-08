#!/usr/bin/env bash
# Kaito Extension release packaging — a gate, and nothing else.
#
# The gate: package.json's "version" must not have been released, i.e. no git tag
# v<version> exists. If one does, packaging is refused. That is what forces
# "a real release starts by bumping the version": the Chrome Web Store rejects a
# repeat upload of the same version, so a version may only be packaged once.
#
# Past the gate:
#   1. A clean-tree gate. The tag this script creates points at HEAD, and
#      `pnpm publish:oss` refuses to export unless the tag IS HEAD — so an
#      uncommitted version bump has no path forward: tag it now and the tag
#      lands on the pre-bump commit, commit it after and the tag no longer
#      points at HEAD. Either way publish:oss stops. Fail here instead, before
#      the build, where the fix is one commit.
#   2. dist/*.zip is deleted. Every zip carries its version and a timestamp in
#      its filename, but a stale zip from an earlier version is still a zip that
#      matches the globs below, and the smoke test is run against a path this
#      script prints. Removing them makes "the newest match" and "what this run
#      built" the same file by construction.
#   3. Both release artifacts are built and verified, the same two the public
#      repository's release workflow builds, and for the same reason: they
#      differ in one manifest field and the two audiences need opposite values
#      of it.
#
#        pnpm zip:upload  no `key` (UNPINNED_EXTENSION_ID) — the Chrome Web
#                         Store assigns the id on publish. The ONLY uploadable
#                         build, and the only build that leaves the key out.
#        pnpm zip         `key` present — pinned to the allowlisted extension
#                         id, so someone who unzips it and loads it unpacked
#                         can actually sign in. THIS is the smoke-test build:
#                         the key-less one cannot sign in outside the store.
#
#      Each is verified by scripts/verify-release-build.sh — manifest version
#      matches package.json, the `key` matches the identity, host_permissions
#      and externally_connectable carry no dev or localhost origin, the
#      production backend is compiled in, and the signal content script still
#      satisfies the x.com CSP constraints. The script is shared with the
#      release workflow so the two cannot drift.
#   4. A local annotated tag v<version>, created only after everything above
#      passed — a failed release must not leave a tag behind. Pushing it here
#      publishes nothing; the release is built in the public repository, from
#      what `pnpm publish:oss` exports. Push it anyway; this gate reads it next
#      time.
#
# Usage: bump package.json's "version" by hand, COMMIT IT, then
#
#   pnpm release
#   # smoke-test the pinned artifact this prints
#   git push origin v<version>
#   pnpm publish:oss             # then follow what it prints
#
# Gate note: the authoritative record of what shipped is the tag in the public
# repository, since that is where releases are built. The local tag is checked
# first because it is free; an unreachable remote warns rather than blocks. Run
# `git fetch --tags` first, or a version a colleague already cut looks free.
set -euo pipefail

cd "$(dirname "$0")/.."

# DRY_RUN=1 turns this into a preflight: every gate still runs and still
# reports, but a failing one no longer stops the script and NO TAG IS CREATED.
# The point of a preflight is to see everything wrong at once — a real release
# stops at the first gate instead, because past it every later step is working
# on a tree the operator has already been told not to release.
#
# Reached through `pnpm release:preflight`, which runs this and publish:oss
# together. Not a second implementation of the gates: the same ones, reported
# rather than enforced.
DRY_RUN="${DRY_RUN:-}"
BLOCKERS=0
blocked() {
  BLOCKERS=$((BLOCKERS + 1))
  printf '✗ %s\n' "$1" >&2
  [ -n "$DRY_RUN" ] || exit 1
}

VERSION="$(node -p "require('./package.json').version")"
TAG="v${VERSION}"

echo "▸ current version: ${VERSION}"

if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  blocked "${TAG} has already been released (the git tag exists).
  A real release starts by bumping the version:
    1. Edit \"version\" in package.json (patch/minor/major is your call)
    2. Commit it
    3. Run pnpm release again"
else
  echo "✓ ${TAG} has not been released locally (no such tag)"
fi

# URL from package.json rather than a second copy of the string.
# GIT_TERMINAL_PROMPT=0 so an unauthenticated checkout fails fast instead of
# blocking the release on a credential prompt nobody is watching for.
OSS_URL="$(node -p "require('./package.json').repository.url" | sed 's/^git+//')"
if OSS_TAGS="$(GIT_TERMINAL_PROMPT=0 git ls-remote --tags "${OSS_URL}" "refs/tags/${TAG}" 2>/dev/null)"; then
  if [ -n "${OSS_TAGS}" ]; then
    blocked "${TAG} has already been published (the tag exists in ${OSS_URL}).
  A published version is published — the Chrome Web Store will reject a repeat
  upload of it. Bump \"version\" in package.json and run pnpm release again."
  else
    echo "✓ ${TAG} has not been published (no such tag in the public repository)"
  fi
else
  echo "  ⚠ could not reach ${OSS_URL} — the published-version check was skipped."
  echo "    The local tag above is the only gate that ran."
fi

# ── Clean tree ────────────────────────────────────────────────────────────
# Tracked changes only, the same test publish:oss applies — `git archive` reads
# HEAD, so an untracked file is not part of what gets exported either way.
if ! git diff --quiet || ! git diff --cached --quiet; then
  blocked "the working tree has uncommitted changes. The tag would point at HEAD
  without them, and pnpm publish:oss refuses to export unless the tag IS HEAD.

  Commit first — the version bump belongs in its own commit:
    git commit -am \"chore(release): ${VERSION}\"

$(git status --short | sed 's/^/    /')"
else
  echo "✓ working tree clean"
fi

# ── Build both artifacts ──────────────────────────────────────────────────
# Deleted, not moved aside: dist/ is gitignored scratch space, and keeping the
# previous version's zips has no upside that outweighs a smoke test run against
# the wrong one.
if compgen -G "dist/*.zip" >/dev/null; then
  echo "▸ removing $(ls dist/*.zip | wc -l | tr -d ' ') stale zip(s) from dist/"
  rm -f dist/*.zip
fi

# Both builds write to dist/chrome-mv3, so each is verified immediately after it
# is built, before the next overwrites it. Store artifact first, so the tree is
# left holding the pinned build — that is the one to smoke-test, and from
# dist/chrome-mv3 it can be loaded unpacked without unzipping anything.
echo "▸ wxt zip (production, no manifest key — Web Store upload artifact)…"
pnpm zip:upload
echo "▸ pre-release self-check (unpinned)…"
if ! VERSION="${VERSION}" DIST="dist/chrome-mv3" IDENTITY=unpinned \
     bash scripts/verify-release-build.sh; then
  blocked "self-check failed — do not upload the zip that was produced (most likely this was not a production build)."
fi

echo "▸ wxt zip (production, pinned extension id — smoke-test artifact)…"
pnpm zip
echo "▸ pre-release self-check (pinned)…"
if ! VERSION="${VERSION}" DIST="dist/chrome-mv3" IDENTITY=pinned \
     bash scripts/verify-release-build.sh; then
  blocked "self-check failed — the pinned build is not releasable, so there is nothing to smoke-test."
fi

# Only a zip tagged with BOTH halves counts: `prod` (production backend, from
# VITE_KAITO_ENV) and the identity half (`nokey` / `storeid`, from
# UNPINNED_EXTENSION_ID) — see zipTag() in wxt.config.ts. Matching the pair, not
# the `prod` substring, is what makes it impossible for this script to print a
# dev, local, unknown or mis-identified build as the artifact and have someone
# upload it by hand. Hard failures, and before the tag: a run that cannot name
# its own artifacts has not released anything.
shopt -s nullglob
STORE=(dist/*-prod-nokey-*.zip)
PINNED=(dist/*-prod-storeid-*.zip)
shopt -u nullglob
for pair in "nokey:${#STORE[@]}" "storeid:${#PINNED[@]}"; do
  if [ "${pair#*:}" -ne 1 ]; then
    blocked "expected exactly 1 dist/*-prod-${pair%%:*}-*.zip, found ${pair#*:}.
  Most likely VITE_KAITO_ENV is not 'production' in your .env, so the build was
  tagged dev/local/unknown rather than prod. Do not upload anything."
  fi
done

if [ -n "$DRY_RUN" ]; then
  cat <<DRY

$(if [ "$BLOCKERS" -eq 0 ]; then
    echo "✓ dry run clean — ${VERSION} would package."
  else
    echo "✗ dry run — ${BLOCKERS} blocker(s) above."
  fi)

   would be smoke-tested: ${PINNED[0]:-(none built)}
   would be uploaded:     ${STORE[0]:-(none built)}

   No tag was created. Nothing was pushed.
DRY
  [ "$BLOCKERS" -eq 0 ]
  exit
fi

git tag -a "${TAG}" -m "release ${TAG}"
echo "✓ created local tag ${TAG}"

cat <<DONE

✅ release complete: ${VERSION}

   smoke-test THIS build — the pinned one, the only one that can sign in:
     ${PINNED[0]}
     (or load dist/chrome-mv3 unpacked; it holds the same build)

   Web Store upload artifact, built and verified but NOT for smoke-testing
   (no manifest key, so sign-in will not work loaded unpacked):
     ${STORE[0]}

   Neither of these is what ships. The release workflow rebuilds both from the
   published commit and attaches its own; these exist to be tested and to prove
   the tree is releasable before it goes public.

   next, once the smoke test passes:
     git push origin ${TAG}
     pnpm publish:oss

   publish:oss exports this tree through scripts/oss-manifest.txt, re-runs the
   public-source hygiene check over the export, lists every path the release
   makes public for the first time, and stages ${TAG} in the public repository.
   It pushes nothing; it prints the diff.

   Pushing that tag publishes the release. The workflow there rebuilds from
   that commit, re-runs these checks, attests both zips, and drafts a Release:
     kaito-extension-${VERSION}.zip           download and load unpacked
     kaito-extension-webstore-${VERSION}.zip  Chrome Web Store upload artifact
   Review the draft, publish it, upload the -webstore one to the dev console.

DONE
