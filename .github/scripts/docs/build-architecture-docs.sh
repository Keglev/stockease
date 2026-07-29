#!/usr/bin/env bash
# =============================================================================
# build-architecture-docs.sh — Converts architecture markdown guides to HTML
# Usage: .github/scripts/docs/build-architecture-docs.sh <project-dir>
#
# Expects the Lua filter at <project-dir>/scripts/md-to-html-links.lua,
# written by build-docs.sh before this script is called.
# Prerequisites: pandoc
# =============================================================================
set -euo pipefail

PROJECT_DIR="${1:?Usage: build-architecture-docs.sh <project-dir>}"

DOCS_DIR="$PROJECT_DIR/docs"
OUTPUT_DIR="$PROJECT_DIR/target/docs"
TEMPLATE="$DOCS_DIR/_theme/app-docs.html"
LUA_FILTER="$PROJECT_DIR/scripts/md-to-html-links.lua"

# Pandoc resolves the $nav()$ partial from <data-dir>/templates/. Setting this
# explicitly makes partial resolution work the same on old and new pandoc
# (older versions ignore the template's own directory for partials).
DATA_DIR="$DOCS_DIR/_theme"

mkdir -p "$OUTPUT_DIR/backend/architecture" "$OUTPUT_DIR/frontend/architecture"

# Converts all .md files in docs/<context>/architecture/ to HTML, preserving
# subdirectory structure. Output mirrors the deployed URL tree:
#   backend  → target/docs/backend/architecture/
#   frontend → target/docs/frontend/architecture/
convert_arch() {
  local CONTEXT="$1"
  local SRC_DIR="$DOCS_DIR/$CONTEXT/architecture"
  # Backend pages get the backend sidebar; everything else gets the frontend one.
  local NAV_META=()
  [ "$CONTEXT" = "backend" ] && NAV_META=(--metadata=backendnav:true)
  local DST_DIR="$OUTPUT_DIR/$CONTEXT/architecture"

  if [ ! -d "$SRC_DIR" ]; then
    echo "ℹ️  No architecture docs at $SRC_DIR — skipping $CONTEXT"
    return 0
  fi

  local count
  count=$(find "$SRC_DIR" -type f -name "*.md" | wc -l)
  [ "$count" -eq 0 ] && echo "ℹ️  No .md files in $SRC_DIR — skipping $CONTEXT" && return 0

  echo "==> [build-architecture-docs] Converting $count file(s) for $CONTEXT"

  find "$SRC_DIR" -type f -name "*.md" | while read -r md; do
    rel="${md#$SRC_DIR/}"
    out="$DST_DIR/${rel%.md}.html"
    mkdir -p "$(dirname "$out")"

    # German pages (-de suffix) set lang:de so the template renders <html lang="de">.
    local lang="en"
    case "${rel%.md}" in
      *-de) lang="de" ;;
    esac

    pandoc "$md" \
      --from markdown --to html \
      --data-dir="$DATA_DIR" \
      --template "$TEMPLATE" \
      --lua-filter "$LUA_FILTER" \
      --metadata=title:"${CONTEXT^} · ${rel%.md}" \
      --metadata=lang:"$lang" \
      "${NAV_META[@]}" \
      --toc --toc-depth=3 --standalone \
      -o "$out"
    echo "  ✓ $rel ($lang)"
  done
}

# The decision log sits at docs/decisions, one level above the per-tier trees, because it
# records backend, frontend and cross-cutting decisions in one sequence (ADR 017). It therefore
# needs its own pass: convert_arch only walks docs/<context>/architecture. Output goes to
# target/docs/decisions/, so the deployed address is /stockease/decisions/index.html and each
# architecture tree's section 9 pointer reaches it with ../../../decisions/index.html.
#
# The pages carry the backend sidebar for now: it is the only populated nav, and its "Docs"
# group links the log. Revisit when the frontend tree gives nav-frontend real content.
convert_decisions() {
  local SRC_DIR="$DOCS_DIR/decisions"
  local DST_DIR="$OUTPUT_DIR/decisions"

  if [ ! -d "$SRC_DIR" ]; then
    echo "ℹ️  No decision log at $SRC_DIR — skipping"
    return 0
  fi

  local count
  count=$(find "$SRC_DIR" -type f -name "*.md" | wc -l)
  [ "$count" -eq 0 ] && echo "ℹ️  No .md files in $SRC_DIR — skipping decisions" && return 0

  echo "==> [build-architecture-docs] Converting $count file(s) for the decision log"
  mkdir -p "$DST_DIR"

  find "$SRC_DIR" -type f -name "*.md" | while read -r md; do
    rel="${md#$SRC_DIR/}"
    out="$DST_DIR/${rel%.md}.html"
    mkdir -p "$(dirname "$out")"

    pandoc "$md" \
      --from markdown --to html \
      --data-dir="$DATA_DIR" \
      --template "$TEMPLATE" \
      --lua-filter "$LUA_FILTER" \
      --metadata=title:"Decisions · ${rel%.md}" \
      --metadata=lang:"en" \
      --metadata=backendnav:true \
      --toc --toc-depth=3 --standalone \
      -o "$out"
    echo "  ✓ $rel (en)"
  done
}

convert_arch backend
convert_arch frontend
convert_decisions
echo "✓ Architecture docs complete"