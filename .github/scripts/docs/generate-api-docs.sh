#!/usr/bin/env bash
# Generates HTML API documentation from the OpenAPI spec using Redocly CLI.
#
# Requires:
#   PROJECT_DIR – set by detect-maven-project.sh (via GITHUB_ENV)
#
# Usage:
#   run: bash .github/scripts/docs/generate-api-docs.sh

set -euo pipefail

SPEC="$PROJECT_DIR/docs/api/openapi.yaml"
OUTPUT_DIR="$PROJECT_DIR/target/docs"
TEMPLATES="$PROJECT_DIR/.github/scripts/templates"

if [ ! -f "$SPEC" ]; then
  echo "ERROR: OpenAPI spec not found at $SPEC" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR/templates"

TEMPLATES="$PROJECT_DIR/.github/scripts/templates"
cp "$TEMPLATES/base.css"       "$PROJECT_DIR/target/docs/templates/"
cp "$TEMPLATES/component.css"  "$PROJECT_DIR/target/docs/templates/"
cp "$TEMPLATES/hub.css"        "$PROJECT_DIR/target/docs/templates/"

npm install -g @redocly/cli
redocly build-docs "$SPEC" -o "$OUTPUT_DIR/api-docs.html"

echo "API docs generated at $OUTPUT_DIR/api-docs.html"