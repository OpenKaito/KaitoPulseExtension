#!/usr/bin/env bash
# Regression tests for scripts/publish-oss.sh — the export gates.
#
# Why this exists: this script decides what becomes public, and a public commit
# cannot be recalled. Every gate in it had been verified once, by hand, on the
# real repository — which means each was verified against one tree, on one day,
# and never again. Two of them (withhold pruning, and the first-public-path
# list) cannot be checked at all without a second publish to compare against,
# so on the real repository they were only ever exercised by faking one.
#
# These tests build the whole situation instead: a throwaway private repo with a
# submodule gitlink and a manifest, and a throwaway bare repo standing in for
# the public one. That makes the second publish, the deleted file, and the
# already-published tag ordinary test cases rather than a rehearsal nobody wants
# to run twice.
#
# Two properties are asserted after EVERY successful run, because they are the
# ones whose failure is irreversible:
#   · the bare repo is untouched — the script stages, it never pushes
#   · the export contains what the manifest allows, and nothing else
#
# Usage: bash scripts/publish-oss.test.sh   —   or pnpm test:publish
# Exits non-zero if any case fails.

# No -e: most cases expect a non-zero exit from the script under test.
set -uo pipefail

SRC="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
for f in publish-oss.sh check-public-source.sh; do
  [ -f "${SRC}/scripts/${f}" ] || { echo "✗ no scripts/${f} under ${SRC}" >&2; exit 1; }
done

# A git identity for everything this suite runs, including the scripts under
# test: release.sh creates an ANNOTATED tag and publish-oss.sh commits, and both
# need a committer. A developer machine always has one; a CI runner does not, and
# git then dies with "empty ident name" — which surfaced as five unrelated-looking
# assertion failures on Linux while macOS passed, because macOS lets git derive an
# identity from the OS account and a runner's is empty.
#
# Supplied here the way `pnpm` is: an ambient condition the real script runs in,
# not a behaviour of it. (release.sh is never run by CI — release.yml deliberately
# replicates its steps instead — so this is a property of the test environment
# only.) Exported rather than passed per-call, because the clone publish-oss.sh
# makes in a temp directory inherits no local config.
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t
export GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t

ok=0; bad=0
TMPDIRS=()
cleanup() { [ "${#TMPDIRS[@]}" -gt 0 ] && rm -rf "${TMPDIRS[@]}"; return 0; }
trap cleanup EXIT

say()   { printf '\n=== %s ===\n' "$1"; }
pass()  { printf '  ✓ %s\n' "$1"; ok=$((ok + 1)); }
lose()  { printf '  ✗ %s\n' "$1"; bad=$((bad + 1)); }
check() { if [ "$1" = ok ]; then pass "$2"; else lose "$2"; fi; }
dump()  { printf '%s\n' "$OUT" | sed 's/^/      /'; }

# Not the developer's global git config: commit signing, a global hooksPath, or
# a template dir would each turn an unrelated local setting into a failure.
tgit() {
  git -C "$T" -c user.email=t@t -c user.name=t -c commit.gpgsign=false \
              -c tag.gpgSign=false -c core.hooksPath=/dev/null "$@"
}

# Assembled from pieces so this file does not itself hold a banned shape. It
# needs one to feed the scanner, but it should not need an exemption from the
# gate it is exercising — and an exemption is a permanent blind spot at that
# basename. check-public-source.test.sh does carry the literal patterns, because
# enumerating them IS its job; one such file is enough.
BANNED="// see https://www.$(printf 'n%sion' ot).so/team/some-page"
SUB_SHA=''   # set per fixture, from the nested repo's own HEAD

vgit() {
  git -C "$T/vendor/primus-core" -c user.email=t@t -c user.name=t \
      -c commit.gpgsign=false -c core.hooksPath=/dev/null "$@"
}

manifest() { printf '%s\n' "$@" >"$T/scripts/oss-manifest.txt"; }

# stderr dropped: `git add -A` warns at length about the embedded repository
# below, which is exactly what the fixture wants it to record.
commit_all() { tgit add -A 2>/dev/null; tgit commit -qm "$1"; }

retag() { tgit tag -f -a "v${1}" -m "release v${1}" >/dev/null; }

# Two withheld shapes, because they exercise different mechanisms:
#   .impeccable   top-level and not published — never archived at all
#   src/internal  nested under `publish src` — archived, then PRUNED
# Only the second one tests the pruning step. A fixture with just the first
# passes happily with pruning deleted outright (verified by mutation).
DEFAULT_MANIFEST=(
  'publish package.json'
  'publish README.md'
  'publish scripts'
  'publish src'
  'publish vendor'
  'withhold .impeccable'
  'withhold src/internal'
)

# A private repo holding one release, plus a bare repo standing in for the
# public one. Fresh pair per case.
fixture() {
  T="$(mktemp -d)"; TMPDIRS+=("$T")
  PUB="$(mktemp -d)/public.git"; TMPDIRS+=("$(dirname "$PUB")")
  git init --bare -q -b main "$PUB"

  mkdir -p "$T/scripts" "$T/src/lib" "$T/src/internal" "$T/.impeccable" "$T/vendor/primus-core"
  cp "$SRC/scripts/publish-oss.sh" "$SRC/scripts/check-public-source.sh" "$T/scripts/"
  cat >"$T/package.json" <<'EOF'
{ "name": "t", "version": "1.0.0",
  "repository": { "type": "git", "url": "git+https://example.invalid/nope.git" } }
EOF
  printf 'export const x = 1;\n' >"$T/src/index.ts"
  printf 'export const y = 2;\n' >"$T/src/lib/util.ts"
  printf '# t\n' >"$T/README.md"
  printf 'internal notes\n' >"$T/.impeccable/notes.md"
  printf 'nested internal notes\n' >"$T/src/internal/notes.md"
  manifest "${DEFAULT_MANIFEST[@]}"

  git init -q -b main "$T"

  # A REAL nested repository, not just an index entry. A gitlink with nothing on
  # disk behind it makes `git diff` report the submodule deleted forever, so
  # every gate downstream then fails at "uncommitted changes" — the script looks
  # broken and the fixture is what is broken. This is how the real tree looks.
  git init -q -b main "$T/vendor/primus-core"
  printf 'vendored\n' >"$T/vendor/primus-core/README.md"
  vgit add -A
  vgit commit -qm vendor
  SUB_SHA="$(vgit rev-parse HEAD)"

  commit_all init
  retag 1.0.0
}

# Run the script under test. OUT holds combined output; CO holds the checkout it
# kept, when it got that far.
run() {
  # `env` because a VAR=value coming from an expansion is NOT re-parsed as an
  # assignment — the shell would try to execute it as the command.
  OUT="$(cd "$T" && OSS_REMOTE="$PUB" KEEP_CHECKOUT=1 env "$@" bash scripts/publish-oss.sh 2>&1)"
  local status=$?
  CO="$(printf '%s\n' "$OUT" | sed -n -e 's/^ *checkout: //p' \
                                     -e 's/^ *staged, uncommitted: //p' | head -1)"
  [ -n "$CO" ] && TMPDIRS+=("$CO")
  return $status
}

# The public repo's refs, as one string. Compared before and after to assert the
# script pushed nothing.
pubrefs() { git -C "$PUB" for-each-ref --format='%(refname) %(objectname)' | sort; }

# Simulate the operator doing step 7: push the staged commit and tag.
#
# The guard is not paranoia. `git -C ""` runs in the CURRENT directory, so if CO
# were ever empty this would push the checkout it was called from — the real
# repository — to whatever its origin is. An earlier draft of this file did
# exactly that; the push was rejected, but only by luck.
push_staged() {
  if [ -z "${CO:-}" ] || [ ! -d "${CO}/.git" ]; then
    lose 'FIXTURE ERROR: no staged checkout to push'
    return 1
  fi
  git -C "$CO" -c core.hooksPath=/dev/null push --atomic -q origin HEAD:main --tags
}

# The branch WITHOUT the tag — the half-published state two separate pushes can
# leave behind, and the one `git push --atomic` exists to make impossible.
push_branch_only() {
  if [ -z "${CO:-}" ] || [ ! -d "${CO}/.git" ]; then
    lose 'FIXTURE ERROR: no staged checkout to push'
    return 1
  fi
  git -C "$CO" -c core.hooksPath=/dev/null push -q origin HEAD:main
}

# Bump the version and re-tag at HEAD, as `pnpm release` would.
bump() {
  local v="$1"
  printf '%s\n' "{ \"name\": \"t\", \"version\": \"${v}\", \"repository\": { \"url\": \"git+https://example.invalid/nope.git\" } }" >"$T/package.json"
  commit_all "release ${v}"
  retag "$v"
}

# ── 1. First publish into an empty public repo ───────────────────────────────
say 'first publish (empty public repo)'
fixture
BEFORE="$(pubrefs)"
if run; then pass 'exits 0'; else lose 'exits 0'; dump; fi
grep -q 'empty repository — first commit' <<<"$OUT" \
  && pass 'takes the unborn-HEAD path' || lose 'takes the unborn-HEAD path'
[ "$(pubrefs)" = "$BEFORE" ] && pass 'pushed NOTHING to the public repo' \
  || lose 'pushed NOTHING to the public repo'
[ -n "$CO" ] && [ -d "$CO" ] && pass 'kept a checkout to review' || lose 'kept a checkout to review'
if [ -n "$CO" ]; then
  git -C "$CO" cat-file -e HEAD:src/index.ts 2>/dev/null \
    && pass 'published src/index.ts' || lose 'published src/index.ts'
  git -C "$CO" cat-file -e HEAD:.impeccable/notes.md 2>/dev/null \
    && lose 'withheld .impeccable (never archived)' \
    || pass 'withheld .impeccable (never archived)'
  git -C "$CO" cat-file -e HEAD:src/internal/notes.md 2>/dev/null \
    && lose 'PRUNED src/internal from under published src/' \
    || pass 'PRUNED src/internal from under published src/'
  git -C "$CO" cat-file -e HEAD:src/lib/util.ts 2>/dev/null \
    && pass 'kept the rest of src/' || lose 'kept the rest of src/'
  grep -q '· withheld src/internal' <<<"$OUT" \
    && pass 'reports the prune' || lose 'reports the prune'
  [ "$(git -C "$CO" ls-tree HEAD vendor/primus-core | awk '{print $3}')" = "$SUB_SHA" ] \
    && pass 'submodule gitlink carries the pinned SHA' \
    || lose 'submodule gitlink carries the pinned SHA'
  git -C "$CO" rev-parse -q --verify refs/tags/v1.0.0 >/dev/null \
    && pass 'staged the tag' || lose 'staged the tag'
  grep -q '+ src/index.ts' <<<"$OUT" \
    && pass 'first-public list names src/index.ts' || lose 'first-public list names src/index.ts'
  grep -qE '\+ (\.impeccable|src/internal)/notes\.md' <<<"$OUT" \
    && lose 'first-public list omits withheld paths' || pass 'first-public list omits withheld paths'
fi

# ── 2. Re-running after a half-published state ───────────────────────────────
#
# A version bump always changes package.json, which is published, so a real
# release can never produce an identical export. The one way to reach that
# branch is the half-published state: main pushed, tag not. Re-running the same
# version then passes the "tag already published" gate — because the tag is not
# there — and arrives at a tree that is already public.
say 'republishing the same tree (main pushed, tag was not)'
fixture
run >/dev/null 2>&1 || true
push_branch_only
if run; then lose 'refuses an empty export'; dump; else pass 'refuses an empty export'; fi
grep -q 'identical to the previous commit' <<<"$OUT" && pass 'says why' || lose 'says why'

# ── 3. Second publish with one new nested file ───────────────────────────────
say 'second publish, one new nested file'
fixture
run >/dev/null 2>&1 || true; push_staged
BEFORE="$(pubrefs)"
printf 'export const secret = 1;\n' >"$T/src/lib/internal-endpoints.ts"
bump 1.0.1
if run; then pass 'exits 0'; else lose 'exits 0'; dump; fi
grep -q '1 path(s) above have never been public' <<<"$OUT" \
  && pass 'counts exactly one first-public path' || lose 'counts exactly one first-public path'
grep -q '+ src/lib/internal-endpoints.ts' <<<"$OUT" \
  && pass 'names the new nested file' || lose 'names the new nested file'
grep -q '+ src/index.ts' <<<"$OUT" \
  && lose 'does not re-list already-public files' || pass 'does not re-list already-public files'
[ "$(pubrefs)" = "$BEFORE" ] && pass 'pushed NOTHING' || lose 'pushed NOTHING'

# ── 4. Whole-tree replacement, not a merge ───────────────────────────────────
say 'a file deleted upstream disappears from the export'
fixture
run >/dev/null 2>&1 || true; push_staged
rm "$T/src/lib/util.ts"
bump 1.0.1
if run; then pass 'exits 0'; else lose 'exits 0'; dump; fi
if [ -n "$CO" ]; then
  git -C "$CO" cat-file -e HEAD:src/lib/util.ts 2>/dev/null \
    && lose 'the deleted file is gone from the public tree' \
    || pass 'the deleted file is gone from the public tree'
fi

# ── 5. The already-published tag ─────────────────────────────────────────────
say 'tag already exists in the public repo'
fixture
run >/dev/null 2>&1 || true; push_staged
# Same version again: re-stage without bumping.
if run; then lose 'refuses to republish a version'; dump; else pass 'refuses to republish a version'; fi
grep -q 'already exists in the public repository' <<<"$OUT" && pass 'says why' || lose 'says why'

# ── 6. Manifest classification ───────────────────────────────────────────────
say 'unclassified top-level path'
fixture
printf 'x\n' >"$T/NEWFILE.md"
commit_all add; retag 1.0.0
if run; then lose 'aborts'; dump; else pass 'aborts'; fi
grep -q 'unclassified top-level path' <<<"$OUT" && pass 'says the category' || lose 'says the category'
grep -q 'NEWFILE.md' <<<"$OUT" && pass 'names the path' || lose 'names the path'
grep -q 'cloning' <<<"$OUT" && lose 'aborts before cloning' || pass 'aborts before cloning'

say 'malformed manifest grammar'
fixture
manifest 'publish src' 'exclude README.md'
commit_all m; retag 1.0.0
if run; then lose 'aborts'; dump; else pass 'aborts'; fi
grep -qE 'oss-manifest.txt:2' <<<"$OUT" && pass 'names the line number' || lose 'names the line number'

say 'publish with a nested path'
fixture
manifest 'publish src/lib'
commit_all m; retag 1.0.0
if run; then lose 'aborts'; dump; else pass 'aborts'; fi
grep -q 'publish takes a top-level path' <<<"$OUT" && pass 'says why' || lose 'says why'

say 'publish path that is not in the tree'
fixture
manifest "${DEFAULT_MANIFEST[@]}" 'publish docs'
commit_all m; retag 1.0.0
if run; then pass 'warns but continues'; else lose 'warns but continues'; dump; fi
grep -q 'publishes docs, which is not in the tree' <<<"$OUT" \
  && pass 'names the skipped path' || lose 'names the skipped path'

# ── 7. Hygiene runs over the EXPORT, after pruning ───────────────────────────
say 'banned string in a published file'
fixture
printf '%s\n' "$BANNED" >>"$T/src/index.ts"
commit_all m; retag 1.0.0
BEFORE="$(pubrefs)"
if run; then lose 'aborts'; dump; else pass 'aborts'; fi
grep -q 'inaccessible source citation' <<<"$OUT" && pass 'says why' || lose 'says why'
[ "$(pubrefs)" = "$BEFORE" ] && pass 'pushed NOTHING' || lose 'pushed NOTHING'

say 'banned string in a withheld file NESTED under a published parent'
fixture
printf '%s\n' "$BANNED" >>"$T/src/internal/notes.md"
commit_all m; retag 1.0.0
if run; then pass 'passes — pruning happens before the scan'; else
  lose 'passes — pruning happens before the scan'; dump; fi

# ── 8. The tree the export is built from ─────────────────────────────────────
say 'uncommitted changes'
fixture
printf 'dirty\n' >>"$T/src/index.ts"
if run; then lose 'aborts'; dump; else pass 'aborts'; fi
grep -q 'uncommitted changes' <<<"$OUT" && pass 'says why' || lose 'says why'

say 'no local tag'
fixture
tgit tag -d v1.0.0 >/dev/null
if run; then lose 'aborts'; dump; else pass 'aborts'; fi
grep -q "no local tag v1.0.0" <<<"$OUT" && pass 'says why' || lose 'says why'
grep -q "pnpm release" <<<"$OUT" && pass 'names the fix' || lose 'names the fix'

say 'tag does not point at HEAD'
fixture
printf 'more\n' >>"$T/README.md"
commit_all later
if run; then lose 'aborts'; dump; else pass 'aborts'; fi
grep -q 'does not point at HEAD' <<<"$OUT" && pass 'says why' || lose 'says why'

# ── 9. Dry run: do all the work, decide nothing ──────────────────────────────
#
# A preflight is only worth running if it does the expensive, informative parts —
# classification, export, hygiene, and the first-public list — while provably not
# creating the commit or the tag. Both halves are asserted here.
say 'dry run on a releasable tree'
fixture
BEFORE="$(pubrefs)"
if run DRY_RUN=1; then pass 'exits 0'; else lose 'exits 0'; dump; fi
grep -q 'classifying the tree' <<<"$OUT" && pass 'still classifies' || lose 'still classifies'
grep -q 'hygiene over the exported tree' <<<"$OUT" && pass 'still scans the export' || lose 'still scans the export'
grep -q 'makes public for the first time' <<<"$OUT" \
  && pass 'still lists first-public paths' || lose 'still lists first-public paths'
grep -q 'No commit, no tag, nothing pushed' <<<"$OUT" && pass 'says what it did not do' || lose 'says what it did not do'
[ "$(pubrefs)" = "$BEFORE" ] && pass 'pushed NOTHING' || lose 'pushed NOTHING'
if [ -n "$CO" ]; then
  git -C "$CO" rev-parse -q --verify HEAD >/dev/null \
    && lose 'created NO commit in the checkout' || pass 'created NO commit in the checkout'
  git -C "$CO" rev-parse -q --verify refs/tags/v1.0.0 >/dev/null \
    && lose 'created NO tag in the checkout' || pass 'created NO tag in the checkout'
  [ -n "$(git -C "$CO" diff --cached --name-only)" ] \
    && pass 'left the export staged, so the diff is reviewable' \
    || lose 'left the export staged, so the diff is reviewable'
else
  lose 'named the staged checkout'
fi

say 'dry run reports blockers without stopping at the first'
fixture
tgit tag -d v1.0.0 >/dev/null       # blocker 1: no tag
printf 'dirty\n' >>"$T/README.md"   # blocker 2: uncommitted changes
BEFORE="$(pubrefs)"
if run DRY_RUN=1; then lose 'exits non-zero'; dump; else pass 'exits non-zero'; fi
grep -q 'uncommitted changes' <<<"$OUT" && pass 'reports the dirty tree' || lose 'reports the dirty tree'
grep -q 'no local tag' <<<"$OUT" && pass 'AND the missing tag, same run' || lose 'AND the missing tag, same run'
grep -q 'does NOT include them' <<<"$OUT" \
  && pass 'warns that the export reflects HEAD, not the dirty tree' \
  || lose 'warns that the export reflects HEAD, not the dirty tree'
grep -qE 'dry run — [0-9]+ blocker' <<<"$OUT" && pass 'counts them' || lose 'counts them'
grep -q 'classifying the tree' <<<"$OUT" && pass 'still did the work' || lose 'still did the work'
[ "$(pubrefs)" = "$BEFORE" ] && pass 'pushed NOTHING' || lose 'pushed NOTHING'

printf '\n%s\n' '----------------------------------------'
printf '%d passed, %d failed\n' "$ok" "$bad"
[ "$bad" -eq 0 ]
