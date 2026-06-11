#!/usr/bin/env bash
# Detects the Maven project root (repo root or /backend) and writes the result
# to both GITHUB_ENV and GITHUB_OUTPUT so it works in all calling workflows.
#
# Outputs:
#   PROJECT_DIR  – absolute path (GITHUB_ENV)
#   dir          – relative path: "." or "backend" (GITHUB_OUTPUT)
#
# Usage in a workflow step:
#   run: bash .github/scripts/shared/detect-maven-project.sh

set -euo pipefail

ROOT="${GITHUB_WORKSPACE:-.}"

if [ -f "$ROOT/pom.xml" ]; then
  ABS="$ROOT"
  REL="."
elif [ -f "$ROOT/backend/pom.xml" ]; then
  ABS="$ROOT/backend"
  REL="backend"
else
  echo "ERROR: pom.xml not found at repo root or /backend" >&2
  exit 1
fi

echo "PROJECT_DIR=$ABS" >> "$GITHUB_ENV"
echo "dir=$REL"         >> "$GITHUB_OUTPUT"
echo "Detected project root: $ABS"