#!/usr/bin/env bash
# Public-source hygiene: reject citations a reader outside Kaito cannot follow.
#
# Run by CI on every pull request, and again over the exported tree before a
# release is published. One copy, in a file, because two would drift and the
# second caller's failure is the one that cannot be undone.
#
# Usage: bash scripts/check-public-source.sh [directory]   (default: repo root)
set -euo pipefail

TARGET="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

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

# Three exemptions, each because the file must name a banned shape to do its
# job: this script states the patterns, .gitignore names the agent instruction
# file it excludes, and CODEOWNERS names internal review groups. The workflows
# are scanned — the patterns no longer live in one.
if grep -rnIE \
     --exclude='check-public-source.sh' --exclude='.gitignore' \
     --exclude='CODEOWNERS' \
     --exclude-dir=.git --exclude-dir=vendor --exclude-dir=node_modules \
     --exclude-dir=dist --exclude-dir=.output --exclude-dir=.wxt \
     "$PATTERN" "$TARGET" ; then
  echo
  echo "::error::inaccessible source citation found"
  exit 1
fi
echo "clean"
