#!/usr/bin/env bash
set -euo pipefail

# ─── Release script ──────────────────────────────────────
# Usage:
#   pnpm release:patch   →  0.5.0 → 0.5.1
#   pnpm release:minor   →  0.5.0 → 0.6.0
#   pnpm release:major   →  0.5.0 → 1.0.0
# ──────────────────────────────────────────────────────────

BUMP="${1:-patch}"

if [[ "$BUMP" != "patch" && "$BUMP" != "minor" && "$BUMP" != "major" ]]; then
  echo "Usage: $0 <patch|minor|major>"
  exit 1
fi

# Ensure clean working tree
if [[ -n "$(git status --porcelain)" ]]; then
  echo "✗ Working tree is dirty. Commit or stash changes first."
  exit 1
fi

# Run checks
echo "▸ Type checking…"
pnpm typecheck

echo "▸ Building…"
pnpm build

echo "▸ Running tests…"
pnpm test

# Bump version (updates package.json, creates git tag)
echo "▸ Bumping version ($BUMP)…"
npm version "$BUMP" -m "release: v%s"

VERSION=$(node -p "require('./package.json').version")
echo "▸ Version: v$VERSION"

# Push commit + tag
echo "▸ Pushing…"
git push
git push origin "v$VERSION"

echo ""
echo "✓ Released v$VERSION"
echo "  Tag v$VERSION pushed — GitHub workflow will publish to npm."
