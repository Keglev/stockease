#!/usr/bin/env bash
# Injects a fixed "back to docs" link into the published coverage reports, which
# JaCoCo and the frontend coverage reporter generate without any route home.
#
# Requires:
#   CWD = the gh-pages checkout, after the docs-site sync
#
# Usage:
#   run: bash .github/scripts/deploy/ghpages-inject-backlink.sh

set -euo pipefail
for COV in backend/coverage/index.html frontend/coverage/index.html; do
  if [ -f "$COV" ]; then
    if grep -q 'id="back-to-docs"' "$COV"; then
      echo "$COV: back-to-docs link already present — skipping"
    else
      sed -i 's|<body[^>]*>|&<a id="back-to-docs" href="/stockease/" style="position:fixed;top:8px;right:12px;z-index:9999;font:14px sans-serif;padding:6px 12px;background:#2563eb;color:#fff;text-decoration:none;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.2);">\&larr; Back to docs</a>|' "$COV"
      echo "$COV: back-to-docs link injected"
    fi
  fi
done
