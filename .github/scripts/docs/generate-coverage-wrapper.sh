#!/usr/bin/env bash
# Generates a coverage wrapper index.html and merges JaCoCo output into
# the documentation tree under target/docs/coverage.
#
# Requires:
#   PROJECT_DIR – set by detect-maven-project.sh (via GITHUB_ENV)
#
# Usage:
#   run: bash .github/scripts/docs/generate-coverage-wrapper.sh

set -euo pipefail

OUTPUT_DIR="$PROJECT_DIR/target/docs"
COVERAGE_SRC="$PROJECT_DIR/docs/coverage"
COVERAGE_OUT="$OUTPUT_DIR/coverage"

mkdir -p "$COVERAGE_OUT"

cat > "$COVERAGE_OUT/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>StockEase - Code Coverage Report</title>
    <link rel="stylesheet" href="/stockease/templates/enterprise-docs.css">
    <style>
        .coverage-iframe { width: 100%; height: 80vh; border: 1px solid #ddd; border-radius: 4px; }
        .coverage-container { padding: 1.5rem; background: #fff; border-radius: 6px; }
    </style>
</head>
<body>
  <div class="container">
    <main>
      <div class="content">
        <h1>Code Coverage Report</h1>
        <p>JaCoCo coverage for the StockEase backend.</p>
        <p><a href="raw/index.html">Open raw JaCoCo report</a></p>
        <iframe src="raw/index.html" class="coverage-iframe" title="JaCoCo Coverage Report"></iframe>
      </div>
    </main>
  </div>
</body>
</html>
EOF

if [ -d "$COVERAGE_SRC" ]; then
  cp -r "$COVERAGE_SRC"/* "$COVERAGE_OUT/" || true
  mkdir -p "$COVERAGE_OUT/raw"
  for f in "$COVERAGE_SRC"/*; do
    [ "$(basename "$f")" != "index.html" ] && cp -r "$f" "$COVERAGE_OUT/raw/" 2>/dev/null || true
  done
else
  echo "WARNING: No JaCoCo coverage directory found at $COVERAGE_SRC"
fi

echo "Coverage wrapper generated at $COVERAGE_OUT."