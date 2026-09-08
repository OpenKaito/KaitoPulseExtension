#!/usr/bin/env bash
# Points this clone's git hooks at the committed .githooks/ directory. Runs from
# postinstall, so `git clone && pnpm install` leaves the pre-commit lint armed
# without anyone having to be told about it.
#
# core.hooksPath rather than writing into .git/hooks: the hook is then a
# reviewed, version-controlled file like any other, and updating it is a normal
# commit instead of a message asking everyone to re-run an installer.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# The published OSS tarball and CI's own checkout both run postinstall. Neither
# needs hooks, and the tarball is not a repository at all.
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "[setup-hooks] not a git repo — skipping" >&2
  exit 0
fi

# Left relative on purpose. Git resolves a relative core.hooksPath against the
# top of whichever working tree the hook fires in, so one setting covers this
# clone and every linked worktree made from it — an absolute path would aim all
# of them at this directory.
DESIRED=".githooks"
CURRENT="$(git config --local --get core.hooksPath || true)"

if [ "$CURRENT" = "$DESIRED" ]; then
  echo "[setup-hooks] ok — core.hooksPath already $DESIRED"
  exit 0
fi

# Don't silently stomp a deliberate local choice (husky, lefthook, a personal
# hooks dir). Say what was found and leave it alone.
if [ -n "$CURRENT" ]; then
  echo "[setup-hooks] core.hooksPath is set to '$CURRENT', not '$DESIRED' — leaving it" >&2
  echo "[setup-hooks] to use this repo's hooks: git config core.hooksPath $DESIRED" >&2
  exit 0
fi

git config --local core.hooksPath "$DESIRED"
echo "[setup-hooks] ok — core.hooksPath set to $DESIRED (pre-commit runs biome)"
