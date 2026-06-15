#!/usr/bin/env bash
# Converts markdown files under a given source directory to HTML using Pandoc.
#
# Requires:
#   PROJECT_DIR – set by detect-maven-project.sh (via GITHUB_ENV)
#   pandoc      – installed in the workflow before calling this script
#
# Arguments:
#   --source   <dir>   Source directory relative to PROJECT_DIR/docs/ (required)
#   --output   <dir>   Output directory relative to PROJECT_DIR/target/docs/ (required)
#   --exclude  <path>  Path pattern to exclude (optional, repeatable)
#   --toc-depth <n>    Table of contents depth (optional, default: 2)
#   --lua-filter       Enable the md-to-html-links Lua filter (optional flag)
#
# Examples:
#   # Architecture docs (with Lua filter and deeper TOC)
#   bash generate-docs.sh \
#     --source architecture \
#     --output architecture \
#     --toc-depth 3 \
#     --lua-filter
#
#   # Additional docs (skip architecture and templates)
#   bash generate-docs.sh \
#     --source . \
#     --output generated \
#     --exclude "*/architecture/*" \
#     --exclude "*/templates/*"

set -euo pipefail

SOURCE=""
OUTPUT=""
TOC_DEPTH=2
USE_LUA=false
EXCLUDES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)    SOURCE="$2";    shift 2 ;;
    --output)    OUTPUT="$2";    shift 2 ;;
    --toc-depth) TOC_DEPTH="$2"; shift 2 ;;
    --lua-filter) USE_LUA=true;  shift   ;;
    --exclude)   EXCLUDES+=("$2"); shift 2 ;;
    *) echo "ERROR: Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$SOURCE" ] || [ -z "$OUTPUT" ]; then
  echo "ERROR: --source and --output are required." >&2
  exit 1
fi

TEMPLATE="$PROJECT_DIR/.github/scripts/templates/enterprise-docs.html"
LUA_FILTER="$(dirname "$0")/md-to-html-links.lua"
SRC_DIR="$PROJECT_DIR/docs/$SOURCE"
OUT_DIR="$PROJECT_DIR/target/docs/$OUTPUT"

if [ ! -f "$TEMPLATE" ]; then
  echo "ERROR: Template not found at $TEMPLATE" >&2
  exit 1
fi

if [ "$USE_LUA" = true ] && [ ! -f "$LUA_FILTER" ]; then
  echo "ERROR: Lua filter not found at $LUA_FILTER" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

FIND_CMD=(find "$SRC_DIR" -type f -name "*.md")
for pattern in "${EXCLUDES[@]}"; do
  FIND_CMD+=(! -path "$pattern")
done

"${FIND_CMD[@]}" | while read -r md_file; do
  rel_path="${md_file#$SRC_DIR/}"
  out_file="$OUT_DIR/${rel_path%.md}.html"
  mkdir -p "$(dirname "$out_file")"

  # Calculate relative path from this output file back to target/docs/.
  # OUTPUT itself is one directory level; rel_path may add more.
  output_depth=$(( $(echo "$OUTPUT" | tr -cd '/' | wc -c) + 1 ))
  rel_depth=$(echo "${rel_path%.md}" | tr -cd '/' | wc -c)
  total_depth=$(( output_depth + rel_depth ))

  root=""
  for (( i = 0; i < total_depth; i++ )); do
    root="${root}../"
  done
  root="${root%/}"

  PANDOC_ARGS=(
    "$md_file"
    --from markdown
    --to html
    --template "$TEMPLATE"
    --metadata=baseurl:/stockease
    "--metadata=root:$root"
    --toc
    --toc-depth="$TOC_DEPTH"
    --standalone
    -o "$out_file"
  )

  if [ "$USE_LUA" = true ]; then
    PANDOC_ARGS+=(--lua-filter "$LUA_FILTER")
  fi

  pandoc "${PANDOC_ARGS[@]}"
  echo "Generated: $out_file"
done

echo "Done: $SRC_DIR → $OUT_DIR"