#!/usr/bin/env bash
# Validates that a Dockerfile exists at the detected project root.
#
# Requires:
#   PROJECT_DIR – set by detect-maven-project.sh (via GITHUB_ENV)
#
# Usage:
#   run: bash .github/scripts/deploy/validate-dockerfile.sh

set -euo pipefail

if [ -f "$PROJECT_DIR/Dockerfile" ]; then
  echo "Dockerfile found at $PROJECT_DIR/Dockerfile"
else
  echo "ERROR: Dockerfile not found at $PROJECT_DIR/Dockerfile" >&2
  exit 1
fi