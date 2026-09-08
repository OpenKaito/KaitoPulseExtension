#!/usr/bin/env bash
# One command that answers "what would this release do?" — and never does it.
#
# Runs both halves of the release with DRY_RUN=1:
#
#   scripts/release.sh       version gate, clean-tree gate, both production
#                            builds, both self-checks — but NO TAG
#   scripts/publish-oss.sh   manifest classification, export, hygiene over the
#                            export, the paths this release would make public
#                            for the first time, and the staged public diff —
#                            but NO COMMIT, NO TAG, and nothing pushed
#
# It is deliberately NOT a third implementation of any of that. Every gate
# reported below is the same code the real release runs; DRY_RUN only changes
# whether a failing gate stops the script, and whether a tag gets written. A
# preflight that reimplemented the checks would drift from the ones that matter,
# and would be worse than nothing: it would answer for a pipeline that no longer
# exists.
#
# Both stages run even if the first one reports blockers. Seeing every problem in
# one pass is the entire point — the export stage does not depend on the build,
# and an operator who has to run this four times to collect four blockers will
# stop running it.
#
# Cost: two full production builds, same as `pnpm release`. That is the price of
# the artifacts being real.
#
# Usage: pnpm release:preflight
# Exits non-zero if either stage reported a blocker.
set -uo pipefail

cd "$(dirname "$0")/.."

RELEASE_LOG="$(mktemp)"
PUBLISH_LOG="$(mktemp)"
trap 'rm -f "$RELEASE_LOG" "$PUBLISH_LOG"' EXIT

rule() { printf '%s\n' '────────────────────────────────────────────────────────────'; }
banner() { printf '\n'; rule; printf '  %s\n' "$1"; rule; }

VERSION="$(node -p "require('./package.json').version")"

printf '\n▸ preflight for v%s — nothing will be tagged, committed or pushed\n' "$VERSION"

banner 'STAGE 1 of 2 — packaging   (pnpm release, dry run)'
DRY_RUN=1 bash scripts/release.sh 2>&1 | tee "$RELEASE_LOG"
release_status="${PIPESTATUS[0]}"

banner 'STAGE 2 of 2 — export      (pnpm publish:oss, dry run)'
DRY_RUN=1 bash scripts/publish-oss.sh 2>&1 | tee "$PUBLISH_LOG"
publish_status="${PIPESTATUS[0]}"

# ── Summary ─────────────────────────────────────────────────────────────────
#
# Re-printed rather than left to scrollback. Both stages are verbose, and the
# first-time-public list is the one thing in either of them that a person has to
# read with their own eyes — the manifest allowlist is top-level only, so a new
# nested file is classified by nobody.
banner "SUMMARY — v${VERSION}"

printf '\nartifacts\n'
if grep -qE 'would be (smoke-tested|uploaded):' "$RELEASE_LOG"; then
  grep -E 'would be (smoke-tested|uploaded):' "$RELEASE_LOG" | sed 's/^ */  /'
else
  printf '  none — the packaging stage did not get that far\n'
fi

printf '\nfirst made public by this release\n'
FIRST_PUBLIC="$(awk '
  /paths this release makes public for the first time/ { on = 1; next }
  on && /^▸ / { on = 0 }
  on' "$PUBLISH_LOG")"
if [ -n "$(printf '%s' "$FIRST_PUBLIC" | tr -d '[:space:]')" ]; then
  printf '%s\n' "$FIRST_PUBLIC" | sed '/^[[:space:]]*$/d'
else
  printf '  (the export stage did not reach that step)\n'
fi

printf '\nverdict\n'
if [ "$release_status" -eq 0 ] && [ "$publish_status" -eq 0 ]; then
  cat <<'READY'
  ✅ READY — both stages clean.

  Nothing was tagged, committed or pushed. To release for real:
    pnpm release            # same gates, enforced; creates the tag
    # smoke-test the pinned artifact it names
    git push origin v<version>
    pnpm publish:oss
READY
  exit 0
fi

printf '  ⛔ BLOCKED\n'
[ "$release_status" -ne 0 ] && printf '     packaging stage reported blockers (see STAGE 1)\n'
[ "$publish_status" -ne 0 ] && printf '     export stage reported blockers (see STAGE 2)\n'
printf '\n  Nothing was tagged, committed or pushed.\n'
exit 1
