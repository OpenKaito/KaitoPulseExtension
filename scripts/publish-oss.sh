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
#   pnpm release                 # version gate, build, self-check, local tag
#   git push origin v<version>
#   pnpm publish:oss             # this script; review the diff, then push
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

# ── 1. The export must correspond to a released tag ─────────────────────────
VERSION="$(node -p "require('./package.json').version")"
TAG="v${VERSION}"

step "publishing ${TAG}"

if ! git diff --quiet || ! git diff --cached --quiet; then
  fail "the working tree has uncommitted changes; the export is built from HEAD."
fi
if ! git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  fail "no local tag ${TAG}. Run 'pnpm release' first — it is the gate that
  refuses to package a version twice."
fi
if [ "$(git rev-parse "${TAG}^{commit}")" != "$(git rev-parse HEAD)" ]; then
  fail "${TAG} does not point at HEAD; the export would carry a tree that was
  never released under that version."
fi
echo "  ✓ ${TAG} is at HEAD, working tree clean"

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
  fail "${TAG} already exists in the public repository. Bump the version."
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
  fail "the export is identical to the previous commit — nothing to publish."
fi

step "staged change"
git -C "$CHECKOUT_DIR" diff --cached --stat | tail -30

git -C "$CHECKOUT_DIR" commit --quiet -F - <<COMMIT_EOF
release ${TAG}

Source of Kaito Pulse ${VERSION}, the tree the release workflow builds the
Chrome Web Store artifact from. Verify with 'pnpm verify:artifacts' against
the published .crx, or 'gh attestation verify' against the release assets.
COMMIT_EOF
git -C "$CHECKOUT_DIR" tag -a "$TAG" -m "release ${TAG}"

KEEP_CHECKOUT=1
cat <<NEXT

✅ prepared ${TAG}
   checkout: ${CHECKOUT_DIR}

   Nothing pushed. Read the diff — this is the last reversible moment:

     git -C ${CHECKOUT_DIR} show --stat
     git -C ${CHECKOUT_DIR} diff HEAD~1

   Then, commit before tag so the tag never lands on a missing commit:

     git -C ${CHECKOUT_DIR} push origin ${OSS_BRANCH}
     git -C ${CHECKOUT_DIR} push origin ${TAG}

   The tag triggers the release workflow there: it rebuilds from this commit,
   re-runs every release assertion, attests both zips, and drafts the Release.
   Review the draft, publish it, upload the -webstore zip to the dev console.

   Delete the checkout when you are done with it.

NEXT
