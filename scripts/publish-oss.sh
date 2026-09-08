#!/usr/bin/env bash
# Prepare one release commit for the public repository. Pushes nothing.
#
# Exports the tagged tree through scripts/oss-manifest.txt, re-runs the
# public-source hygiene check over the whole export, and stages it as a single
# commit plus tag in a clone of the public repository.
#
# Fail-closed by design: a published commit cannot be recalled from forks,
# clones, or GitHub's archives, and per-change review has been skipped by
# construction. So the manifest is an allowlist — every top-level path must be
# named publish or withhold, and an unclassified one stops the script.
#
# Usage:
#   # bump package.json's version, and COMMIT it — the checks below require the
#   # tag to be HEAD, which an uncommitted bump cannot satisfy
#   pnpm release                 # version gate, both builds, self-checks, local tag
#   # smoke-test the pinned artifact pnpm release printed
#   git push origin v<version>
#   pnpm publish:oss             # this script; review the diff, then push
#
# `pnpm release:preflight` runs this and pnpm release together with DRY_RUN=1:
# every gate reports, nothing is tagged, committed or pushed.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

OSS_REMOTE="${OSS_REMOTE:-git@github.com:OpenKaito/KaitoPulseExtension.git}"
OSS_BRANCH="${OSS_BRANCH:-main}"
MANIFEST="scripts/oss-manifest.txt"

# vendor/primus-core is a submodule, so the tree holds a gitlink and `git
# archive` emits nothing for it. Re-created by SHA below; .gitmodules alone
# would leave a cloner with an unpinned vendor and no reproducible build.
SUBMODULE_PATH="vendor/primus-core"

step() { printf '\n▸ %s\n' "$1"; }
fail() { printf '\n✗ %s\n' "$1" >&2; exit 1; }

# DRY_RUN=1 turns this into a preflight: it classifies, exports, scans, clones
# and stages exactly as always, but creates NO commit and NO tag, and a failing
# gate reports instead of stopping so one run shows everything wrong. Reached
# through `pnpm release:preflight`. The gates are not reimplemented there — they
# are these, reported rather than enforced.
DRY_RUN="${DRY_RUN:-}"
BLOCKERS=0
blocked() {
  BLOCKERS=$((BLOCKERS + 1))
  printf '\n✗ %s\n' "$1" >&2
  [ -n "$DRY_RUN" ] || exit 1
}

# ── 1. The export must correspond to a released tag ─────────────────────────
VERSION="$(node -p "require('./package.json').version")"
TAG="v${VERSION}"

step "publishing ${TAG}"

if ! git diff --quiet || ! git diff --cached --quiet; then
  blocked "the working tree has uncommitted changes; the export is built from HEAD.\
${DRY_RUN:+
  So the export below does NOT include them — it is what HEAD would publish,
  not what your tree holds.}"
fi
# Guarded: rev-parse on a missing tag is a hard error, and in a preflight the
# missing-tag gate above has already reported and continued.
HAVE_TAG=1
if ! git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  HAVE_TAG=0
  blocked "no local tag ${TAG}. Run 'pnpm release' first — it is the gate that
  refuses to package a version twice."
fi
if [ "$HAVE_TAG" = 1 ] &&
   [ "$(git rev-parse "${TAG}^{commit}")" != "$(git rev-parse HEAD)" ]; then
  blocked "${TAG} does not point at HEAD; the export would carry a tree that was
  never released under that version."
fi
if [ "$BLOCKERS" -eq 0 ]; then
  echo "  ✓ ${TAG} is at HEAD, working tree clean"
fi

# ── 2. Classify every top-level path ────────────────────────────────────────
step "classifying the tree against ${MANIFEST}"
[ -f "$MANIFEST" ] || fail "missing ${MANIFEST}."

# Grammar is `publish <path>` or `withhold <path>`, one per line, and anything
# else is an error. `publish` is top-level only — that is the granularity at
# which something genuinely new appears, and a per-file list over 350 source
# files would rot into a rubber stamp. `withhold` may name a nested path.
PUBLISH_TOP=""
WITHHOLD_ALL=""
N=0
while IFS= read -r line || [ -n "$line" ]; do
  N=$((N + 1))
  [ -z "$line" ] && continue
  mode="${line%% *}"; path="${line#* }"
  case "$mode" in publish|withhold) ;; *)
    fail "${MANIFEST}:${N}: expected 'publish <path>' or 'withhold <path>', got: ${line}" ;;
  esac
  case "$path" in ''|*' '*) fail "${MANIFEST}:${N}: not a single path: ${line}" ;; esac
  if [ "$mode" = publish ]; then
    case "$path" in */*) fail "${MANIFEST}:${N}: publish takes a top-level path: ${path}" ;; esac
    PUBLISH_TOP="${PUBLISH_TOP}${path}
"
  else
    WITHHOLD_ALL="${WITHHOLD_ALL}${path}
"
  fi
done < "$MANIFEST"

UNCLASSIFIED=""
while read -r path; do
  printf '%s' "$PUBLISH_TOP"  | grep -qxF -- "$path" && continue
  printf '%s' "$WITHHOLD_ALL" | grep -qxF -- "$path" && continue
  UNCLASSIFIED="${UNCLASSIFIED} ${path}"
done < <(git ls-tree --name-only HEAD)

if [ -n "$UNCLASSIFIED" ]; then
  fail "unclassified top-level path(s):${UNCLASSIFIED}

  Add each to ${MANIFEST} as publish or withhold, on purpose."
fi
echo "  ✓ $(printf '%s' "$PUBLISH_TOP" | grep -c .) published, $(printf '%s' "$WITHHOLD_ALL" | grep -c .) withheld, 0 unclassified"

# ── 3. Export ───────────────────────────────────────────────────────────────
step "exporting HEAD"
EXPORT_DIR="$(mktemp -d)"
CHECKOUT_DIR=""
cleanup() {
  rm -rf "$EXPORT_DIR"
  [ -n "$CHECKOUT_DIR" ] && [ "${KEEP_CHECKOUT:-}" != "1" ] && rm -rf "$CHECKOUT_DIR"
  return 0
}
trap cleanup EXIT

# A publish entry whose path has since been deleted is skipped with a warning,
# not an error: `git archive` fails outright on a pathspec that matches nothing,
# and a file removed upstream must not be able to block a release. The warning
# is there so a typo does not silently drop a directory from the export.
ARCHIVE_PATHS=()
while read -r p; do
  [ -z "$p" ] && continue
  [ "$p" = "vendor" ] && continue
  if ! git cat-file -e "HEAD:${p}" 2>/dev/null; then
    echo "  ⚠ ${MANIFEST} publishes ${p}, which is not in the tree — skipped"
    continue
  fi
  ARCHIVE_PATHS+=("$p")
done < <(printf '%s' "$PUBLISH_TOP")
[ "${#ARCHIVE_PATHS[@]}" -gt 0 ] || fail "nothing to export; check ${MANIFEST}."
git archive --format=tar HEAD -- "${ARCHIVE_PATHS[@]}" | tar -x -C "$EXPORT_DIR"

# Pruned after the archive, not left out of it: a withheld path may sit under a
# published parent, and pruning is the only way to express that.
while read -r w; do
  [ -z "$w" ] && continue
  if [ -e "$EXPORT_DIR/$w" ]; then
    rm -rf "${EXPORT_DIR:?}/$w"
    echo "  · withheld $w"
  fi
done < <(printf '%s' "$WITHHOLD_ALL")

SUBMODULE_SHA="$(git ls-tree HEAD "$SUBMODULE_PATH" | awk '{print $3}')"
[ -n "$SUBMODULE_SHA" ] || fail "could not read the pinned SHA of ${SUBMODULE_PATH}."
echo "  ✓ $(find "$EXPORT_DIR" -type f | wc -l | tr -d ' ') files, plus ${SUBMODULE_PATH} @ ${SUBMODULE_SHA:0:12}"

# ── 4. The scrub gate — the last point at which a leak is reversible ────────
step "public-source hygiene over the exported tree"
bash scripts/check-public-source.sh "$EXPORT_DIR"

# ── 5. Stage it ─────────────────────────────────────────────────────────────
step "cloning ${OSS_REMOTE}"
CHECKOUT_DIR="$(mktemp -d)"
git clone --quiet "$OSS_REMOTE" "$CHECKOUT_DIR" 2>/dev/null \
  || fail "could not clone ${OSS_REMOTE}. Check access, or set OSS_REMOTE."

# An empty repository clones with an unborn HEAD that may not even carry the
# branch name we want.
if ! git -C "$CHECKOUT_DIR" rev-parse -q --verify HEAD >/dev/null; then
  git -C "$CHECKOUT_DIR" symbolic-ref HEAD "refs/heads/${OSS_BRANCH}"
  echo "  · empty repository — first commit, on ${OSS_BRANCH}"
else
  git -C "$CHECKOUT_DIR" checkout --quiet "$OSS_BRANCH"
  echo "  · previous: $(git -C "$CHECKOUT_DIR" log -1 --format='%s')"
fi

if git -C "$CHECKOUT_DIR" rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  blocked "${TAG} already exists in the public repository. Bump the version."
fi

# Wholesale replacement, not a merge: a file deleted upstream has to disappear
# here too, and `git add -A` over a wiped tree is what makes the printed diff an
# honest picture of the change.
find "$CHECKOUT_DIR" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
tar -c -C "$EXPORT_DIR" . | tar -x -C "$CHECKOUT_DIR"

git -C "$CHECKOUT_DIR" add -A
# The gitlink last: `add -A` just staged its removal, since the submodule is not
# a file on disk here.
git -C "$CHECKOUT_DIR" update-index --add \
  --cacheinfo "160000,${SUBMODULE_SHA},${SUBMODULE_PATH}"

if git -C "$CHECKOUT_DIR" diff --cached --quiet; then
  if [ -n "$DRY_RUN" ]; then
    echo "  · identical to the previous commit — there would be nothing to publish"
  else
    fail "the export is identical to the previous commit — nothing to publish."
  fi
fi

# ── 6. The paths nobody classified ──────────────────────────────────────────
#
# The manifest classifies TOP-LEVEL paths, so `publish src` carries every file
# added under src/ since the last release without anyone having looked at it as
# a publishing decision. That is the one gap the allowlist cannot close, and a
# per-file manifest would not close it either — a list of 350 entries rots into
# a rubber stamp within two releases.
#
# The delta does close it. These are the paths that have never been public,
# computed against the previous published commit rather than against a tag, so
# it holds on the very first publish too. It is short per release, which is the
# entire point: short enough that a person actually reads it.
step "paths this release makes public for the first time"
ADDED="$(git -C "$CHECKOUT_DIR" diff --cached --name-status --diff-filter=A | cut -f2-)"
ADDED_COUNT="$(printf '%s' "$ADDED" | grep -c . || true)"
if [ "$ADDED_COUNT" -eq 0 ]; then
  echo "  · none — every published path already existed in the previous release"
else
  printf '%s\n' "$ADDED" | sed 's/^/  + /'
  echo
  echo "  ⚠ ${ADDED_COUNT} path(s) above have never been public, and the manifest"
  echo "    classified none of them individually. Read the list before pushing."
fi

step "staged change"
git -C "$CHECKOUT_DIR" diff --cached --stat | tail -30

KEEP_CHECKOUT=1

if [ -n "$DRY_RUN" ]; then
  cat <<DRY

$(if [ "$BLOCKERS" -eq 0 ]; then
    echo "✓ dry run clean — ${TAG} would export as staged above."
  else
    echo "✗ dry run — ${BLOCKERS} blocker(s) above."
  fi)

   staged, uncommitted: ${CHECKOUT_DIR}

   Read the first-time-public list above. The staged tree itself:

     git -C ${CHECKOUT_DIR} diff --cached
     git -C ${CHECKOUT_DIR} diff --cached --stat

   No commit, no tag, nothing pushed. Delete the checkout when done.

DRY
  [ "$BLOCKERS" -eq 0 ]
  exit
fi

git -C "$CHECKOUT_DIR" commit --quiet -F - <<COMMIT_EOF
release ${TAG}

Source of Kaito Pulse ${VERSION}, the tree the release workflow builds the
Chrome Web Store artifact from. Verify with 'pnpm verify:artifacts' against
the published .crx, or 'gh attestation verify' against the release assets.
COMMIT_EOF
git -C "$CHECKOUT_DIR" tag -a "$TAG" -m "release ${TAG}"

cat <<NEXT

✅ prepared ${TAG}
   checkout: ${CHECKOUT_DIR}

   Nothing pushed. Read the first-time-public list above and the diff below —
   this is the last reversible moment:

     git -C ${CHECKOUT_DIR} show --stat
     git -C ${CHECKOUT_DIR} diff HEAD~1

   Then push both refs in ONE transaction. --atomic is not a nicety here: two
   pushes can leave main updated with the tag missing (the release workflow
   never fires, and the public tree is a version ahead of its own history) or
   a tag pointing at a commit nobody can fetch. Either half-published state has
   to be repaired in the open, on a branch that cannot be rewritten.

     git -C ${CHECKOUT_DIR} push --atomic origin ${OSS_BRANCH} ${TAG}

   The tag triggers the release workflow there: it rebuilds from this commit,
   re-runs every release assertion, attests both zips, and drafts the Release.
   Review the draft, publish it, upload the -webstore zip to the dev console.

   Delete the checkout when you are done with it.

NEXT
