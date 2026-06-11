#!/usr/bin/env bash
# Rewrites directory-style href values to explicit index.html links.
# Pandoc generates links like href="path/to/dir/" which browsers may not
# resolve correctly on GitHub Pages without a trailing index.html.
#
# Requires:
#   PROJECT_DIR – set by detect-maven-project.sh (via GITHUB_ENV)
#
# Usage:
#   run: bash .github/scripts/docs/fix-directory-links.sh

set -euo pipefail

OUTPUT_DIR="$PROJECT_DIR/target/docs"

find "$OUTPUT_DIR" -type f -name "*.html" | while read -r html_file; do
  sed -i 's|href="\([^"]*\)/"|href="\1/index.html"|g' "$html_file"
  sed -i "s|href='\([^']*\)/'|href='\1/index.html'|g" "$html_file"
done

echo "Directory links fixed in $OUTPUT_DIR."