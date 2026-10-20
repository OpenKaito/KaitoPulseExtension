#!/usr/bin/env bash
# Regression tests for scripts/check-public-source.sh.
#
# Why this exists: every pattern in that scanner had been verified once, by hand,
# by injecting a specimen and watching the run fail. That proves the pattern
# worked on the day it was written and nothing after. And these patterns fail
# silently in exactly the way that matters — a scan that matches nothing prints
# `clean`, which is also what a passing scan prints. Pass 1 once shipped with a
# quoting bug that left its first and most important pattern matching NOTHING,
# and it lived that way for as long as it lived inline in the workflow.
#
# So: one case per pattern, asserting it still blocks, plus negative cases for
# the strings this tree legitimately contains and which a future "let's also
# catch high-entropy values" change would break. The negative cases are not
# padding — they are the reason the scanner has no entropy heuristic, and they
# will fail loudly if someone adds one.
#
# Every specimen below is synthetic. AKIAIOSFODNN7EXAMPLE-style values are
# vendor-documented examples or obvious filler; none is a real credential.
#
# This file is exempt from the scanner it tests (by basename, alongside the
# scanner itself) because it must contain the banned shapes to feed them in.
#
# Usage: bash scripts/check-public-source.test.sh   —   or pnpm test:hygiene
# Exits non-zero if any case fails.

# No -e: a scanner run that exits non-zero is the expected outcome of most cases.
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCANNER="${ROOT_DIR}/scripts/check-public-source.sh"

[ -f "$SCANNER" ] || { echo "✗ scanner not found at ${SCANNER}" >&2; exit 1; }

PASSED=0
FAILED=0
OUT=''

# Run the scanner over a throwaway tree holding exactly one file. A fresh
# directory per case, so a case can neither see nor be seen by another.
scan() {
  local name="$1" content="$2" dir status
  dir="$(mktemp -d)"
  printf '%s\n' "$content" >"${dir}/${name}"
  OUT="$(bash "$SCANNER" "$dir" 2>&1)"; status=$?
  rm -rf "$dir"
  return $status
}

blocked() { # label, filename, content
  if scan "$2" "$3"; then
    printf '  ✗ NOT blocked: %s\n' "$1"
    printf '%s\n' "$OUT" | sed 's/^/      /'
    FAILED=$((FAILED + 1))
  else
    printf '  ✓ blocked: %s\n' "$1"
    PASSED=$((PASSED + 1))
  fi
}

allowed() { # label, filename, content
  if scan "$2" "$3"; then
    printf '  ✓ allowed: %s\n' "$1"
    PASSED=$((PASSED + 1))
  else
    printf '  ✗ FALSE POSITIVE: %s\n' "$1"
    printf '%s\n' "$OUT" | sed 's/^/      /'
    FAILED=$((FAILED + 1))
  fi
}

# Lengths are generated rather than typed: several patterns are anchored on an
# exact count ({36}, {35}, {16}), and a specimen one character short would pass
# the scan and be recorded here as a working pattern.
rep() { printf "%.0s$1" $(seq "$2"); }

GH_TOKEN_SPECIMEN="ghp_$(rep a 36)"
GOOGLE_KEY_SPECIMEN="AIza$(rep b 35)"
AWS_ID_SPECIMEN="AKIA$(rep C 16)"
STRIPE_KEY_SPECIMEN="sk_live_$(rep d 24)"
SLACK_TOKEN_SPECIMEN="xoxb-$(rep 1 12)"
JWT_SPECIMEN="eyJ$(rep e 14).eyJ$(rep f 14).$(rep g 10)"

echo '▸ pass 1 — inaccessible citations'
blocked 'notion link'          a.ts '// see https://www.notion.so/kaitoai/some-page'
blocked 'figma link'           a.ts '// design: https://www.figma.com/file/abc123/Pulse'
blocked 'design node coords'   a.ts '// node 1234:5678'
blocked 'design node, I-form'  a.ts '// node I1234:5678'
blocked 'PR reference'         a.ts '// fixed in PR #12'
blocked 'ticket reference'     a.ts '// see ticket 4471'
blocked 'decision reference'   a.ts '// per decision #8'
blocked 'cross-repo issue'     a.ts '// tracked in SomeRepo#4567'
blocked 'design frame address' a.ts '// matches Frame 12/34'
blocked 'design group address' a.ts '// matches Group 9:12'
blocked 'internal process name' a.ts '// found during bug bash'
blocked 'agent instruction file' a.ts '// the convention is documented in CLAUDE.md'
blocked 'internal branch name'  a.ts '// landed on feat/wallet-visibility'
blocked 'preview app host'      a.ts "const ORIGIN = 'https://abc123def456.amplifyapp.com';"
blocked 'preview branch host'   .env.example '#   VITE_KAITO_CONNECT_URL=https://pr-12.wxyz9876abcd.amplifyapp.com'

echo
echo '▸ pass 2 — credentials'
blocked 'AWS access key id'   a.ts "const id = '${AWS_ID_SPECIMEN}';"
blocked 'AWS secret var name' a.ts 'AWS_SECRET_ACCESS_KEY=whatever'
blocked 'GitHub token'        a.ts "const t = '${GH_TOKEN_SPECIMEN}';"
blocked 'Slack token'         a.ts "const t = '${SLACK_TOKEN_SPECIMEN}';"
blocked 'Google API key'      a.ts "const k = '${GOOGLE_KEY_SPECIMEN}';"
blocked 'Stripe live key'     a.ts "const k = '${STRIPE_KEY_SPECIMEN}';"
blocked 'PEM private key'     a.ts '-----BEGIN RSA PRIVATE KEY-----'
blocked 'signed JWT'          a.ts "const jwt = '${JWT_SPECIMEN}';"
blocked 'internal email'      a.ts '// owner: someone@kaito.ai'

echo
echo '▸ pass 2 — what must NOT match (the reason there is no entropy rule)'
# PROD_EXTENSION_KEY in wxt.config.ts is a 392-character base64 RSA *public* key
# and it has to stay in the published tree: it is what pins the extension id.
allowed 'base64 RSA public key' wxt.config.ts \
  "const PROD_EXTENSION_KEY = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAx3Qalrcva06OgksixIQX8Li4jj2hHFz6tZnMFvFzfR3De$(rep A 40)';"
# The CSP assertions require the font to be inlined, so this shape is mandatory.
allowed 'inlined woff2 font'   f.css \
  "@font-face{src:url(data:font/woff2;base64,d09GMgABAAAAA$(rep B 60))}"
allowed 'product domain'       a.ts "const API = 'https://hub.kaito.ai';"
allowed 'sign-in URL'          a.ts "const LOGIN = 'https://kaito.ai/login';"
allowed 'placeholder preview'  a.ts "const ORIGIN = 'https://preview.example.com';"
allowed 'version strings'      a.ts "const v = '1.0.2'; const min = '120';"
allowed 'ordinary source'      a.ts "import { signalGate } from '../shared/session-gate';"

echo
echo '▸ pass 3 — .env.example (published, and the production build config)'
blocked 'secret-named VITE_ var with a value' .env.example 'VITE_SENTRY_TOKEN=abc123'
blocked 'credential in .env.example'          .env.example "VITE_X=${GH_TOKEN_SPECIMEN}"
allowed 'secret-named VITE_ var left empty'   .env.example 'VITE_SENTRY_TOKEN='
allowed 'ordinary VITE_ var'                  .env.example 'VITE_KAITO_ENV=production'

echo
echo '▸ documented holes — these SHOULD pass, and that is the point'
# The scanner reads the filesystem, not git. Every developer has a real,
# gitignored .env on disk and it is not what gets published, so it is skipped.
# If .env ever becomes publishable, this case is the one that has to flip.
allowed 'credential in a gitignored .env' .env "GITHUB_TOKEN=${GH_TOKEN_SPECIMEN}"
# The exemption that lets the scanner and this test state banned shapes is by
# BASENAME, so any file with these names is skipped wherever it sits. Asserted
# here so the hole is visible rather than discovered.
allowed 'banned shape inside a file named check-public-source.sh' \
  check-public-source.sh '// see https://www.notion.so/kaitoai/some-page'

echo
if [ "$FAILED" -ne 0 ]; then
  echo "✗ ${FAILED} failed, ${PASSED} passed"
  echo "::error::public-source hygiene regression test failed"
  exit 1
fi
echo "✓ ${PASSED} passed"
