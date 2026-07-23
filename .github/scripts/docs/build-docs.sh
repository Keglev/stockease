#!/usr/bin/env bash
# =============================================================================
# build-docs.sh — Documentation build orchestrator
# Usage: .github/scripts/docs/build-docs.sh <project-dir>
#
# Writes the Lua filter, builds the theme assets, then delegates to sibling
# scripts for each doc type. Output tree mirrors the deployed site under
# <project-dir>/target/docs.
#
# TypeDoc generation returns when the Angular frontend exists; until then this
# orchestrator builds the OpenAPI and architecture docs only.
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
# Converts .md links to .html and wraps mermaid blocks in a div for the browser.
# (Filter logic optimization remains deferred.)
# ---------------------------------------------------------------------------
write_lua_filter() {
  mkdir -p "$PROJECT_DIR/scripts"
  cat > "$LUA_FILTER" << 'LUA'
function Link(el)
  el.target = el.target:gsub("%.md#", ".html#")
  el.target = el.target:gsub("%.md$", ".html")
  return el
end

function CodeBlock(el)
  if el.classes:includes('mermaid') then
    local html = '<div class="mermaid">\n' .. el.text .. '\n</div>'
    return pandoc.RawBlock('html', html)
  end
  return el
end
LUA
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

# JaCoCo HTML is downloaded by the workflow to target/site/jacoco; absent on
# docs-only pushes, in which case deploy-ghpages preserves the existing report.
copy_backend_coverage() {
  local SRC="$PROJECT_DIR/target/site/jacoco"
  local DEST="$OUTPUT_DIR/backend/coverage"
  if [ -d "$SRC" ] && [ "$(ls -A "$SRC")" ]; then
    mkdir -p "$DEST"
    cp -R "$SRC/." "$DEST/"
    echo "✓ Backend coverage (JaCoCo) copied"
  else
    echo "ℹ️  No backend coverage found — skipping"
  fi
}

copy_frontend_coverage() {
  local SRC="$PROJECT_DIR/target/frontend/coverage"
  local DEST="$OUTPUT_DIR/frontend/coverage"
  if [ -d "$SRC" ] && [ "$(ls -A "$SRC")" ]; then
    mkdir -p "$DEST"
    cp -R "$SRC/." "$DEST/"
    echo "✓ Frontend coverage copied"
  else
    echo "ℹ️  No frontend coverage found — skipping"
  fi
}

echo "==> [build-docs] Starting (PROJECT_DIR=$PROJECT_DIR)"
mkdir -p "$OUTPUT_DIR"

write_lua_filter
build_theme_assets
copy_landing_pages
bash "$SCRIPTS_DIR/build-openapi-docs.sh"      "$PROJECT_DIR"
bash "$SCRIPTS_DIR/build-architecture-docs.sh" "$PROJECT_DIR"
copy_backend_coverage
copy_frontend_coverage

echo ""
echo "✓ Docs build complete — $(find "$OUTPUT_DIR" -type f | wc -l) files, $(du -sh "$OUTPUT_DIR" | cut -f1)"
