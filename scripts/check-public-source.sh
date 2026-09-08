#!/usr/bin/env bash
# Public-source hygiene, in three passes over the same tree:
#
#   1. Citations a reader outside Kaito cannot follow.
#   2. Credentials, which are the leak that cannot be walked back at all.
#   3. .env.example, which is published AND is the production build config.
#
# Run by CI on every pull request, and again over the exported tree before a
# release is published. One copy, in a file, because two would drift and the
# second caller's failure is the one that cannot be undone.
#
# What this cannot do, and no pattern list can: it finds known string SHAPES.
# It does not recognise a sensitive internal endpoint it has never seen, a
# business rule that should not be public, or anything that leaks at the
# semantic rather than the lexical level. It is a floor under human review, not
# a substitute for it — which is why publish-oss.sh also prints, for a person to
# read, every path a release makes public for the first time.
#
# Every pattern here is covered by scripts/check-public-source.test.sh. Add a
# case there with any pattern added below; a gate nothing tests is a gate that
# quietly stops matching (pass 1 shipped with exactly that bug once — see the
# quoting note below).
#
# Usage: bash scripts/check-public-source.sh [directory]   (default: repo root)
set -euo pipefail

TARGET="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

SHARED_EXCLUDES=(
  --exclude-dir=.git --exclude-dir=vendor --exclude-dir=node_modules
  --exclude-dir=dist --exclude-dir=.output --exclude-dir=.wxt
)

# ── Pass 1: inaccessible citations ──────────────────────────────────────────
#
# Single-quoted, so a backslash reaches grep as one backslash. Do not switch to
# double quotes: "\\." collapses to `\\`, which ERE reads as a literal backslash
# followed by any character. An earlier inline version had exactly that bug, and
# the first pattern — the most common leak of all — matched nothing for as long
# as it lived in the workflow.
PATTERNS=(
  # Links into non-public design or document tools.
  'https?://[^ ]*(notion|figma)\.(com|so)'
  # Design-node coordinates, e.g. 1234:5678 or I1234:5678.
  '\bI?[0-9]{3,5}:[0-9]{1,6}\b'
  # Bare tracker references — "PR #12", "ticket 4471", "decision #8".
  '\b(PR|task|ticket|issue|decision) ?#?[0-9]+\b'
  # Cross-repository issue shorthand — "SomeRepo#4567".
  '\b[A-Za-z][A-Za-z0-9_-]{2,}#[0-9]{3,}\b'
  # Design-tool object addresses — "Frame 12/34", "Group 9:12".
  '\b([Nn]ode|[Gg]roup|[Ll]ine|[Ff]rame)[[:space:]]+[0-9]{1,6}([:/][0-9]{1,6})+\b'
  # Internal review-process names, and references to agent instruction files.
  '\b[Bb]ug[ -]?[Bb]ash\b|\bCLAUDE\.md\b'
  # Internal branch names, which carry ticket slugs.
  '\bfeat/[A-Za-z0-9._/-]+\b'
)

PATTERN="$(IFS='|'; echo "${PATTERNS[*]}")"

# Four exemptions, each because the file must name a banned shape to do its
# job: this script states the patterns, its test feeds them in to prove they
# still match, .gitignore names the agent instruction file it excludes, and
# CODEOWNERS names internal review groups. The workflows are scanned — the
# patterns no longer live in one.
if grep -rnIE \
     --exclude='check-public-source.sh' --exclude='check-public-source.test.sh' \
     --exclude='.gitignore' --exclude='CODEOWNERS' \
     "${SHARED_EXCLUDES[@]}" \
     "$PATTERN" "$TARGET" ; then
  echo
  echo "::error::inaccessible source citation found"
  exit 1
fi

# ── Pass 2: credentials ─────────────────────────────────────────────────────
#
# Every pattern here is anchored on a vendor's own key prefix, or on a shape
# that has exactly one meaning. That is deliberate: a credential scan is only
# worth having if it never cries wolf. The obvious generic heuristic — a
# secret-sounding variable assigned a long opaque value — was tried and left
# out, because this tree legitimately holds PROD_EXTENSION_KEY (a 392-character
# base64 RSA *public* key that pins the extension id) and base64 woff2 font
# blobs that the CSP assertions require to be present. A rule that fires on
# those gets weakened or bypassed within a release or two, and a bypassed gate
# is worse than none.
#
# So: no entropy heuristics here. If a new credential type needs covering, add
# its literal prefix.
SECRET_PATTERNS=(
  # AWS.
  '\bAKIA[0-9A-Z]{16}\b'
  'AWS_SECRET_ACCESS_KEY|aws_secret_access_key'
  # GitHub — personal, OAuth, user-to-server, server-to-server, refresh.
  '\bgh[pousr]_[A-Za-z0-9]{36}\b'
  # Slack.
  '\bxox[abposr]-[A-Za-z0-9-]{10,}\b'
  # Google.
  '\bAIza[0-9A-Za-z_-]{35}\b'
  # Stripe.
  '\b[sr]k_(live|test)_[0-9A-Za-z]{20,}\b'
  # Any PEM private key.
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  # A signed JWT: three base64url segments, the first two decoding to JSON.
  '\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+'
  # Named humans. kaito.ai is the product domain and appears throughout; an
  # address at it is a person, and belongs in the private repository.
  '[A-Za-z0-9._%+-]+@kaito\.ai\b'
)

SECRET_PATTERN="$(IFS='|'; echo "${SECRET_PATTERNS[*]}")"

# `.env*` is excluded because this scans the filesystem, not git: every
# developer has a real, gitignored .env on disk, and it is not what is being
# published. .env.example IS published, so it gets its own scan below rather
# than an exemption.
if grep -rnIE \
     --exclude='check-public-source.sh' --exclude='check-public-source.test.sh' \
     --exclude='.env' --exclude='.env.*' \
     "${SHARED_EXCLUDES[@]}" \
     "$SECRET_PATTERN" "$TARGET" ; then
  echo
  echo "::error::credential-shaped string found"
  exit 1
fi

# ── Pass 3: .env.example ────────────────────────────────────────────────────
#
# It is published, and the release workflow copies it verbatim to .env to build
# from — so it is both the public example and the production configuration.
# Its own header says never to put a secret in a VITE_ variable; this is what
# makes that a rule rather than a request. Every VITE_ value is compiled into
# the shipped bundle, where it is readable by anyone who unzips it.
ENV_EXAMPLE="${TARGET%/}/.env.example"
if [ -f "$ENV_EXAMPLE" ]; then
  if grep -nE '^[[:space:]]*VITE_[A-Z0-9_]*(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*=.+' "$ENV_EXAMPLE"; then
    echo
    echo "::error::.env.example assigns a secret-named VITE_ variable; VITE_ values are compiled into the shipped bundle"
    exit 1
  fi
  if grep -nE "$SECRET_PATTERN" "$ENV_EXAMPLE"; then
    echo
    echo "::error::credential-shaped string in .env.example"
    exit 1
  fi
fi

echo "clean"
