#!/usr/bin/env bash
# =============================================================================
# build-docs.sh — Documentation build orchestrator
# Usage: .github/scripts/docs/build-docs.sh <project-dir>
#
# Writes the Lua filter, builds the theme assets, then delegates to sibling
# scripts for each doc type. Output tree mirrors the deployed site under
# <project-dir>/target/docs.
#
# The frontend's TypeDoc reference is NOT generated here: it needs the frontend's
# node_modules, so build-frontend-api.sh produces it in frontend CI and this
# orchestrator only copies the downloaded artifact into place, exactly as it does
# for the two coverage reports.
# Prerequisites: pandoc, redocly CLI, npx
# =============================================================================
set -euo pipefail

PROJECT_DIR="${1:?Usage: build-docs.sh <project-dir>}"
DOCS_DIR="$PROJECT_DIR/docs"
THEME_DIR="$DOCS_DIR/_theme"
OUTPUT_DIR="$PROJECT_DIR/target/docs"
ASSETS_DIR="$OUTPUT_DIR/assets"
LUA_FILTER="$PROJECT_DIR/scripts/md-to-html-links.lua"

# Resolve sibling script directory at runtime — safe regardless of working directory
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------------------------------------------------------------------------
# Lua filter — owned here to avoid duplication across sibling scripts.
# (Filter logic optimization remains deferred.)
# ---------------------------------------------------------------------------
write_lua_filter() {
  mkdir -p "$PROJECT_DIR/scripts"
  cp "$SCRIPTS_DIR/md-to-html-links.lua" "$LUA_FILTER"
  echo "✓ Lua filter written"
}

# ---------------------------------------------------------------------------
# Theme assets — concatenate the CSS partials into one stylesheet and copy the
# runtime JS. Templates reference these at /assets/docs.css and /assets/docs.js.
# Concat order is the cascade order: tokens first (defines the variables every
# later partial consumes), mermaid last.
# ---------------------------------------------------------------------------
build_theme_assets() {
  mkdir -p "$ASSETS_DIR"
  cat \
    "$THEME_DIR/css/tokens.css" \
    "$THEME_DIR/css/base.css" \
    "$THEME_DIR/css/layout.css" \
    "$THEME_DIR/css/components.css" \
    "$THEME_DIR/css/landing.css" \
    "$THEME_DIR/css/content.css" \
    "$THEME_DIR/css/mermaid.css" \
    > "$ASSETS_DIR/docs.css"
  cp "$THEME_DIR/js/docs.js" "$ASSETS_DIR/docs.js"
  echo "✓ Theme assets built (docs.css, docs.js)"
}

# Landing pages are static HTML served at the site root.
copy_landing_pages() {
  cp "$THEME_DIR/index.html"    "$OUTPUT_DIR/index.html"
  cp "$THEME_DIR/index-de.html" "$OUTPUT_DIR/index-de.html"
  echo "✓ Landing pages copied"
}

# Every downloaded report copies in the same shape: present only when the CI run that
# produces it fed this build, and skipped with a notice otherwise — deploy-ghpages
# preserves the published copy whenever a build skips one.
#
# The skip notice reads mid-sentence, so it lowercases the label by default. Backend
# coverage passes its own because the success line names the tool and the notice does not.
copy_artifact() {
  local SRC="$1"
  local DEST="$2"
  local LABEL="$3"
  local SKIP_LABEL="${4:-${LABEL,}}"
  if [ -d "$SRC" ] && [ "$(ls -A "$SRC")" ]; then
    mkdir -p "$DEST"
    cp -R "$SRC/." "$DEST/"
    echo "✓ $LABEL copied"
  else
    echo "ℹ️  No $SKIP_LABEL found — skipping"
  fi
}

echo "==> [build-docs] Starting (PROJECT_DIR=$PROJECT_DIR)"
mkdir -p "$OUTPUT_DIR"

write_lua_filter
build_theme_assets
copy_landing_pages
bash "$SCRIPTS_DIR/build-openapi-docs.sh"      "$PROJECT_DIR"
bash "$SCRIPTS_DIR/build-architecture-docs.sh" "$PROJECT_DIR"
# JaCoCo HTML is downloaded by the workflow to target/site/jacoco; absent on
# docs-only pushes, in which case deploy-ghpages preserves the existing report.
copy_artifact "$PROJECT_DIR/target/site/jacoco" "$OUTPUT_DIR/backend/coverage" \
  "Backend coverage (JaCoCo)" "backend coverage"
copy_artifact "$PROJECT_DIR/target/frontend/coverage" "$OUTPUT_DIR/frontend/coverage" \
  "Frontend coverage"
# The TypeDoc reference the frontend workflow built and the docs pipeline downloaded: present
# only on builds a frontend CI run triggered, and the deploy step preserves the published copy
# on every other build.
copy_artifact "$PROJECT_DIR/target/frontend/api-src" "$OUTPUT_DIR/frontend/api" \
  "Frontend API reference"

echo ""
echo "✓ Docs build complete — $(find "$OUTPUT_DIR" -type f | wc -l) files, $(du -sh "$OUTPUT_DIR" | cut -f1)"
