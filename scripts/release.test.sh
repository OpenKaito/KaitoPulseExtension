#!/usr/bin/env bash
# Regression tests for scripts/release.sh — its gates and, above all, which
# artifact it names for the smoke test.
#
# Why this exists: release.sh used to build only the key-less Web Store zip
# while the smoke-test procedure called for the pinned one, and it never cleaned
# dist/. The two together meant the newest matching file could be a PINNED ZIP
# FROM AN EARLIER VERSION, still sitting in dist/ from some previous run — so a
# smoke test would pass against a build that was not the release. Nothing about
# that failure is visible in a log; it needs a test, and it is case 1 below.
#
# `pnpm` and scripts/verify-release-build.sh are stubbed, so the whole control
# flow is exercised without a real two-minute production build. What is NOT
# covered here is the build itself: that the pinned build really is tagged
# `prod-storeid` comes from wxt.config.ts's zipTag(), and the assertions in
# verify-release-build.sh are what check the bytes.
#
# Usage: bash scripts/release.test.sh   —   or pnpm test:release
# Exits non-zero if any case fails.

# No -e: most cases here expect a non-zero exit from the script under test.
set -uo pipefail

SRC="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
[ -f "${SRC}/scripts/release.sh" ] || { echo "✗ no scripts/release.sh under ${SRC}" >&2; exit 1; }
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

# The temp repositories must not inherit the developer's global git config: commit
# signing, a global hooksPath, or a template dir would each turn an unrelated
# local setting into a test failure.
tgit() {
  git -C "$T" -c user.email=t@t -c user.name=t -c commit.gpgsign=false \
              -c tag.gpgSign=false -c core.hooksPath=/dev/null "$@"
}

say() { printf '\n=== %s ===\n' "$1"; }
check() { if [ "$1" = ok ]; then printf '  ✓ %s\n' "$2"; ok=$((ok+1)); else printf '  ✗ %s\n' "$2"; bad=$((bad+1)); fi; }

# mode: both | nokey-only | none
setup() {
  local mode="$1"
  T="$(mktemp -d)"; TMPDIRS+=("$T")
  mkdir -p "$T/scripts" "$T/bin"
  cp "$SRC/scripts/release.sh" "$T/scripts/release.sh"
  cat >"$T/scripts/verify-release-build.sh" <<'EOF'
#!/usr/bin/env bash
echo "  ✓ (stub) verified ${IDENTITY} at ${DIST}"
EOF
  cat >"$T/package.json" <<'EOF'
{ "name": "t", "version": "9.9.9",
  "repository": { "type": "git", "url": "git+https://example.invalid/nope.git" } }
EOF
  # pnpm shim: emits the zip whose identity the invoked script asks for.
  cat >"$T/bin/pnpm" <<EOF
#!/usr/bin/env bash
mkdir -p dist/chrome-mv3
echo '{}' > dist/chrome-mv3/manifest.json
case "\$1:${mode}" in
  zip:upload:both|zip:upload:nokey-only) touch "dist/t-9.9.9-chrome-prod-nokey-\$RANDOM.zip" ;;
  zip:both)                              touch "dist/t-9.9.9-chrome-prod-storeid-\$RANDOM.zip" ;;
  zip:upload:none)                       touch "dist/t-9.9.9-chrome-unknown-nokey-\$RANDOM.zip" ;;
  zip:none)                              touch "dist/t-9.9.9-chrome-unknown-storeid-\$RANDOM.zip" ;;
esac
echo "(stub) pnpm \$*"
EOF
  chmod +x "$T/bin/pnpm" "$T/scripts/verify-release-build.sh"
  git -C "$T" init -q
  tgit add -A
  tgit commit -qm init
  export PATH="$T/bin:$PATH"
}

run() { ( cd "$T" && GIT_TERMINAL_PROMPT=0 bash scripts/release.sh 2>&1 ); }
run_dry() { ( cd "$T" && DRY_RUN=1 GIT_TERMINAL_PROMPT=0 bash scripts/release.sh 2>&1 ); }

# ── 1. Happy path, with a stale zip from an older version already in dist/ ──
say "happy path (stale 1.0.1 storeid zip present)"
setup both
mkdir -p "$T/dist"; touch "$T/dist/t-1.0.1-chrome-prod-storeid-STALE.zip"
OUT="$(run)"; status=$?
[ $status -eq 0 ] && check ok "exits 0" || { check no "exits 0 (got $status)"; printf '%s\n' "$OUT" | sed 's/^/    /'; }
grep -q 'removing 1 stale zip' <<<"$OUT" && check ok "removed the stale zip" || check no "removed the stale zip"
[ -e "$T/dist/t-1.0.1-chrome-prod-storeid-STALE.zip" ] && check no "stale zip is gone" || check ok "stale zip is gone"
grep -q 'STALE' <<<"$OUT" && check no "never names the stale zip" || check ok "never names the stale zip"
grep -q 'smoke-test THIS build' <<<"$OUT" && check ok "prints a smoke-test target" || check no "prints a smoke-test target"
smoke="$(grep -A1 'smoke-test THIS build' <<<"$OUT" | tail -1 | tr -d ' ')"
[[ "$smoke" == *-prod-storeid-*.zip ]] && check ok "smoke-test target is the PINNED zip ($smoke)" || check no "smoke-test target is pinned (got $smoke)"
grep -q 'prod-nokey' <<<"$OUT" && check ok "also names the webstore zip" || check no "also names the webstore zip"
git -C "$T" rev-parse -q --verify refs/tags/v9.9.9 >/dev/null && check ok "tag created" || check no "tag created"
grep -c 'stub) verified' <<<"$OUT" | grep -qx 2 && check ok "verified both identities" || check no "verified both identities"
grep -q 'unpinned' <<<"$OUT" && grep -q 'pinned at' <<<"$OUT" && check ok "one unpinned + one pinned check" || check no "one unpinned + one pinned check"

# ── 2. Dirty tree must hard-fail, before any build ──────────────────────────
say "uncommitted version bump"
setup both
echo '{ "name":"t","version":"9.9.9","repository":{"url":"git+https://example.invalid/n.git"},"x":1 }' >"$T/package.json"
OUT="$(run)"; status=$?
[ $status -ne 0 ] && check ok "exits non-zero" || check no "exits non-zero"
grep -q 'uncommitted changes' <<<"$OUT" && check ok "says why" || check no "says why"
grep -q 'git commit' <<<"$OUT" && check ok "names the fix" || check no "names the fix"
grep -q 'stub) pnpm' <<<"$OUT" && check no "fails BEFORE building" || check ok "fails BEFORE building"
git -C "$T" rev-parse -q --verify refs/tags/v9.9.9 >/dev/null && check no "no tag left behind" || check ok "no tag left behind"

# ── 3. Non-production build (no VITE_KAITO_ENV) must fail, and not tag ──────
say "build tagged 'unknown' instead of 'prod'"
setup none
OUT="$(run)"; status=$?
[ $status -ne 0 ] && check ok "exits non-zero" || check no "exits non-zero"
grep -q 'VITE_KAITO_ENV' <<<"$OUT" && check ok "points at VITE_KAITO_ENV" || check no "points at VITE_KAITO_ENV"
git -C "$T" rev-parse -q --verify refs/tags/v9.9.9 >/dev/null && check no "no tag left behind" || check ok "no tag left behind"

# ── 4. Only one of the two artifacts produced ───────────────────────────────
say "pinned build silently missing"
setup nokey-only
OUT="$(run)"; status=$?
[ $status -ne 0 ] && check ok "exits non-zero" || check no "exits non-zero"
grep -q 'expected exactly 1 dist/\*-prod-storeid' <<<"$OUT" && check ok "names the missing identity" || check no "names the missing identity"
git -C "$T" rev-parse -q --verify refs/tags/v9.9.9 >/dev/null && check no "no tag left behind" || check ok "no tag left behind"

# ── 5. Version gate still refuses an already-released version ──────────────
say "tag already exists"
setup both
tgit tag -a v9.9.9 -m x
OUT="$(run)"; status=$?
[ $status -ne 0 ] && check ok "exits non-zero" || check no "exits non-zero"
grep -q 'already been released' <<<"$OUT" && check ok "says why" || check no "says why"
grep -q 'Commit it' <<<"$OUT" && check ok "recovery path mentions committing" || check no "recovery path mentions committing"

# ── 6. Dry run: report everything, enforce nothing, tag nothing ─────────────
#
# The preflight's whole value is seeing every blocker in one pass, so this
# asserts accumulation, not just the exit status: a dirty tree AND a build that
# came out tagged 'unknown' both have to be named by a single run.
say "dry run accumulates blockers and still creates no tag"
setup none
# Dirty but still VALID JSON: the script reads the version with `node -p` before
# any gate runs, so a malformed package.json kills it there and every assertion
# below would be about the wrong failure.
echo '{ "name":"t","version":"9.9.9","repository":{"url":"git+https://example.invalid/n.git"},"x":1 }' >"$T/package.json"
OUT="$(run_dry)"; status=$?
[ $status -ne 0 ] && check ok "exits non-zero" || check no "exits non-zero"
grep -q 'uncommitted changes' <<<"$OUT" && check ok "reports the dirty tree" || check no "reports the dirty tree"
grep -q 'expected exactly 1' <<<"$OUT" && check ok "AND reports the bad build in the same run" || check no "AND reports the bad build in the same run"
grep -qE 'dry run — [0-9]+ blocker' <<<"$OUT" && check ok "counts them" || check no "counts them"
grep -q 'No tag was created' <<<"$OUT" && check ok "says no tag was created" || check no "says no tag was created"
git -C "$T" rev-parse -q --verify refs/tags/v9.9.9 >/dev/null && check no "created no tag" || check ok "created no tag"
grep -q 'stub) pnpm' <<<"$OUT" && check ok "still built, to have something to report on" || check no "still built, to have something to report on"

say "dry run on a releasable tree"
setup both
OUT="$(run_dry)"; status=$?
[ $status -eq 0 ] && check ok "exits 0" || { check no "exits 0"; printf '%s\n' "$OUT" | sed 's/^/    /'; }
grep -q 'dry run clean' <<<"$OUT" && check ok "says it is clean" || check no "says it is clean"
git -C "$T" rev-parse -q --verify refs/tags/v9.9.9 >/dev/null && check no "STILL created no tag" || check ok "STILL created no tag"
smoke="$(grep 'would be smoke-tested' <<<"$OUT" | sed 's/.*: *//')"
[[ "$smoke" == *-prod-storeid-*.zip ]] && check ok "names the pinned zip as the one to test ($smoke)" || check no "names the pinned zip (got $smoke)"
grep -q 'would be uploaded:.*-prod-nokey-' <<<"$OUT" && check ok "names the webstore zip separately" || check no "names the webstore zip separately"

printf '\n%s\n' "----------------------------------------"
printf '%d passed, %d failed\n' "$ok" "$bad"
[ "$bad" -eq 0 ]
