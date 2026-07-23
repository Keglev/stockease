#!/usr/bin/env bash
# =============================================================================
# build-openapi-docs.sh — Generates ReDoc HTML from the OpenAPI spec
# Usage: .github/scripts/docs/build-openapi-docs.sh <project-dir>
#
# ReDoc output is fully self-contained (its own CSS/JS), so this script does
# not touch the docs theme. Theme assets, landing pages, and JaCoCo coverage
# are handled by build-docs.sh.
# Prerequisites: redocly CLI
# =============================================================================
set -euo pipefail

PROJECT_DIR="${1:?Usage: build-openapi-docs.sh <project-dir>}"

OPENAPI_YAML="$PROJECT_DIR/docs/api/openapi.yaml"  # spec moves to docs/backend/api with the API-docs review
API_OUT="$PROJECT_DIR/target/docs/backend/api"

echo "==> [build-openapi-docs] PROJECT_DIR=$PROJECT_DIR"

if [ ! -f "$OPENAPI_YAML" ]; then
  echo "::error::OpenAPI YAML not found at $OPENAPI_YAML"
  exit 1
fi

mkdir -p "$API_OUT"
redocly build-docs "$OPENAPI_YAML" -o "$API_OUT/index.html"

# Inject a fixed-position "back to docs" link into the self-contained ReDoc page.
# Same pattern as the JaCoCo coverage injection in 3-deploy-ghpages.yml, applied
# at build time because this file is regenerated on every docs build.
sed -i 's|<body[^>]*>|&<a id="back-to-docs" href="/stockease/" style="position:fixed;top:8px;right:12px;z-index:9999;font:14px sans-serif;padding:6px 12px;background:#2563eb;color:#fff;text-decoration:none;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.2);">\&larr; Back to docs</a>|' "$API_OUT/index.html"
echo "✓ ReDoc HTML generated at backend/api/index.html (back-to-docs link injected)"
