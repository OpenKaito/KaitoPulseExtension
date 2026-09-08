#!/usr/bin/env bash
# Regression tests for scripts/release-preflight.sh.
#
# The preflight itself holds no release logic — it runs the two real scripts with
# DRY_RUN=1 and summarises them. So what needs testing is exactly the part that
# is its own: that it runs BOTH stages even when the first one fails, that the
# verdict follows both exit statuses, and that the summary lifts the right lines
# out of a lot of output.
#
# That last one is the fragile piece. The first-public-path list is the one thing
# in a preflight a person has to read with their own eyes, and it is extracted by
# matching a section header and stopping at the next one. If either script's
# output is reworded, the extraction silently yields nothing — a preflight that
# prints an empty "first made public" section reads exactly like a release that
# makes nothing new public. Hence the cases below.
#
# Both stages are stubbed here. Their real dry-run behaviour is covered by
# scripts/release.test.sh and scripts/publish-oss.test.sh.
#
# Usage: bash scripts/release-preflight.test.sh   —   or pnpm test:preflight
set -uo pipefail

SRC="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
[ -f "${SRC}/scripts/release-preflight.sh" ] \
  || { echo "✗ no scripts/release-preflight.sh under ${SRC}" >&2; exit 1; }

ok=0; bad=0
TMPDIRS=()
cleanup() { [ "${#TMPDIRS[@]}" -gt 0 ] && rm -rf "${TMPDIRS[@]}"; return 0; }
trap cleanup EXIT

say()  { printf '\n=== %s ===\n' "$1"; }
pass() { printf '  ✓ %s\n' "$1"; ok=$((ok + 1)); }
lose() { printf '  ✗ %s\n' "$1"; bad=$((bad + 1)); }
dump() { printf '%s\n' "$OUT" | sed 's/^/      /'; }

# release_status, publish_status: what each stub exits with.
fixture() {
  local rel="$1" pub="$2"
  T="$(mktemp -d)"; TMPDIRS+=("$T")
  mkdir -p "$T/scripts"
  cp "$SRC/scripts/release-preflight.sh" "$T/scripts/"
  cat >"$T/package.json" <<'EOF'
{ "name": "t", "version": "9.9.9" }
EOF

  # Stubs that echo the shapes the real scripts emit in dry run. Deliberately
  # verbose, and deliberately followed by another ▸ section, so the extraction
  # has something to stop at.
  cat >"$T/scripts/release.sh" <<EOF
#!/usr/bin/env bash
echo "▸ current version: 9.9.9"
echo "✓ working tree clean"
echo "   would be smoke-tested: dist/t-9.9.9-chrome-prod-storeid-1.zip"
echo "   would be uploaded:     dist/t-9.9.9-chrome-prod-nokey-1.zip"
exit ${rel}
EOF

  cat >"$T/scripts/publish-oss.sh" <<EOF
#!/usr/bin/env bash
echo "▸ classifying the tree against scripts/oss-manifest.txt"
echo "  ✓ 6 published, 2 withheld, 0 unclassified"
echo ""
echo "▸ paths this release makes public for the first time"
echo "  + src/lib/internal-endpoints.ts"
echo "  + scripts/new-helper.sh"
echo ""
echo "  ⚠ 2 path(s) above have never been public, and the manifest"
echo "    classified none of them individually. Read the list before pushing."
echo ""
echo "▸ staged change"
echo " SENTINEL-FROM-A-LATER-SECTION | 12 +++++"
exit ${pub}
EOF
  chmod +x "$T/scripts/release.sh" "$T/scripts/publish-oss.sh"
}

run() { OUT="$(cd "$T" && bash scripts/release-preflight.sh 2>&1)"; return $?; }

# ── 1. Both stages clean ─────────────────────────────────────────────────────
say 'both stages clean'
fixture 0 0
if run; then pass 'exits 0'; else lose 'exits 0'; dump; fi
grep -q 'READY' <<<"$OUT" && pass 'verdict is READY' || lose 'verdict is READY'
grep -q 'STAGE 1 of 2' <<<"$OUT" && pass 'ran the packaging stage' || lose 'ran the packaging stage'
grep -q 'STAGE 2 of 2' <<<"$OUT" && pass 'ran the export stage' || lose 'ran the export stage'
grep -q 'Nothing was tagged, committed or pushed' <<<"$OUT" \
  && pass 'says what it did not do' || lose 'says what it did not do'
grep -q 'would be smoke-tested: .*-prod-storeid-' <<<"$OUT" \
  && pass 'summary repeats the smoke-test artifact' || lose 'summary repeats the smoke-test artifact'

# ── 2. The summary extraction ────────────────────────────────────────────────
say 'summary lifts the first-public list, and only that'
# Anchored on the banner, not the bare word: an earlier line merely containing
# it would open the range and drag the whole stage-2 stream in.
SUMMARY="$(awk '/SUMMARY — v/{on=1} on' <<<"$OUT")"
grep -q 'src/lib/internal-endpoints.ts' <<<"$SUMMARY" \
  && pass 'names the first new file' || lose 'names the first new file'
grep -q 'scripts/new-helper.sh' <<<"$SUMMARY" \
  && pass 'names the second new file' || lose 'names the second new file'
grep -q 'SENTINEL-FROM-A-LATER-SECTION' <<<"$SUMMARY" \
  && lose 'stops at the next section header' || pass 'stops at the next section header'
grep -q 'the export stage did not reach that step' <<<"$SUMMARY" \
  && lose 'does not claim the step was missing' || pass 'does not claim the step was missing'

# ── 3. A reworded header must not read as "nothing new is public" ────────────
say 'header reworded: says so instead of showing an empty list'
fixture 0 0
sed -i.bak 's/paths this release makes public for the first time/paths newly exposed/' \
  "$T/scripts/publish-oss.sh"
run || true
grep -q 'the export stage did not reach that step' <<<"$OUT" \
  && pass 'admits it found nothing to show' || lose 'admits it found nothing to show'
grep -q 'READY' <<<"$OUT" && pass 'still reports the stage verdicts' || lose 'still reports the stage verdicts'

# ── 4. Verdicts ──────────────────────────────────────────────────────────────
say 'packaging stage blocked'
fixture 1 0
if run; then lose 'exits non-zero'; dump; else pass 'exits non-zero'; fi
grep -q 'BLOCKED' <<<"$OUT" && pass 'verdict is BLOCKED' || lose 'verdict is BLOCKED'
grep -q 'packaging stage reported blockers' <<<"$OUT" && pass 'names the stage' || lose 'names the stage'
grep -q 'STAGE 2 of 2' <<<"$OUT" \
  && pass 'STILL ran the export stage — one pass, every problem' \
  || lose 'STILL ran the export stage — one pass, every problem'
grep -q 'src/lib/internal-endpoints.ts' <<<"$OUT" \
  && pass 'and still shows what it would make public' \
  || lose 'and still shows what it would make public'

say 'export stage blocked'
fixture 0 1
if run; then lose 'exits non-zero'; dump; else pass 'exits non-zero'; fi
grep -q 'export stage reported blockers' <<<"$OUT" && pass 'names the stage' || lose 'names the stage'
grep -q 'packaging stage reported blockers' <<<"$OUT" \
  && lose 'does not blame the clean stage' || pass 'does not blame the clean stage'

say 'both stages blocked'
fixture 1 1
if run; then lose 'exits non-zero'; dump; else pass 'exits non-zero'; fi
grep -q 'packaging stage reported blockers' <<<"$OUT" \
  && grep -q 'export stage reported blockers' <<<"$OUT" \
  && pass 'names both' || lose 'names both'

# ── 5. No artifacts built ────────────────────────────────────────────────────
say 'packaging stage produced no artifacts'
fixture 1 0
cat >"$T/scripts/release.sh" <<'EOF'
#!/usr/bin/env bash
echo "✗ the working tree has uncommitted changes"
exit 1
EOF
run || true
grep -q 'the packaging stage did not get that far' <<<"$OUT" \
  && pass 'says so rather than printing an empty artifacts section' \
  || lose 'says so rather than printing an empty artifacts section'

printf '\n%s\n' '----------------------------------------'
printf '%d passed, %d failed\n' "$ok" "$bad"
[ "$bad" -eq 0 ]
