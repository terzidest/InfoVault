#!/bin/sh
#
# Installs InfoVault's git hooks into .git/hooks.
# Run once from the repo root:  sh scripts/install-hooks.sh
#
set -eu

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "Not inside a git repository. Run this from the InfoVault repo." >&2
  exit 1
}

hook_src="$repo_root/scripts/pre-commit"
hook_dst="$repo_root/.git/hooks/pre-commit"

if [ ! -f "$hook_src" ]; then
  echo "Expected hook at $hook_src but it's missing." >&2
  echo "Make sure scripts/pre-commit exists in the repo." >&2
  exit 1
fi

cp "$hook_src" "$hook_dst"
chmod +x "$hook_dst"

echo "Installed pre-commit hook -> $hook_dst"
echo "It blocks commits that log secrets, use Math.random for security,"
echo "store secrets in AsyncStorage, or persist the key in plaintext."
echo "Bypass a genuine false positive with: git commit --no-verify"
