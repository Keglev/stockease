#!/usr/bin/env bash
# =============================================================================
# build-frontend-api.sh — Generates the TypeDoc API reference for the frontend
# Usage: .github/scripts/docs/build-frontend-api.sh <project-dir>
#
# Runs in FRONTEND CI, not in the docs pipeline: TypeDoc needs the frontend's
# installed node_modules, which only that workflow has. The output is uploaded
# as an artifact and the docs pipeline downloads it, mirroring how the Vitest
# coverage report travels. Settings live in frontend/typedoc.json so this
# script stays one command.
# Prerequisites: frontend dependencies installed (npm ci)
# =============================================================================
set -euo pipefail

PROJECT_DIR="${1:?Usage: build-frontend-api.sh <project-dir>}"

FRONTEND_DIR="$PROJECT_DIR/frontend"

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "❌ No frontend directory at $FRONTEND_DIR" >&2
  exit 1
fi

echo "==> [build-frontend-api] Generating TypeDoc reference"
cd "$FRONTEND_DIR"

# No `|| true`: a reference that failed to generate must fail the job rather
# than publish a stale or empty directory over the last good one.
npx typedoc

if [ ! -f "typedoc-dist/index.html" ]; then
  echo "❌ TypeDoc reported success but produced no index.html" >&2
  exit 1
fi

echo "✓ Frontend API reference complete ($(find typedoc-dist -type f | wc -l) files)"
