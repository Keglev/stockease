#!/usr/bin/env bash
# Syncs the downloaded docs-site artifact into the gh-pages checkout root,
# preserving the published reports the current build did not regenerate.
#
# Requires:
#   CWD = the gh-pages checkout, with the docs-site artifact unpacked at ./docs-site
#
# Usage:
#   run: bash .github/scripts/deploy/ghpages-sync-site.sh

set -euo pipefail

# Preserve the published reports the current build did not regenerate. Each arrives
# only with its own CI trigger — backend coverage with backend CI, frontend coverage
# and the API reference with frontend CI — so any given deploy is missing most of
# them, and without this backup the wipe below would delete what it did not rebuild.
#
# backend/api is deliberately absent from this list: ReDoc rebuilds it from the
# OpenAPI spec on every docs build, so it is never missing and never needs restoring.
PRESERVED="backend/coverage frontend/coverage frontend/api"

for REPORT in $PRESERVED; do
  if [ ! -d "docs-site/$REPORT" ] && [ -d "$REPORT" ]; then
    echo "$REPORT not in current build — preserving existing report"
    mkdir -p "/tmp/docs-preserve/$(dirname "$REPORT")"
    cp -R "$REPORT" "/tmp/docs-preserve/$(dirname "$REPORT")/"
  fi
done

# Clear gh-pages content, keeping only .git and .github metadata
find . -mindepth 1 -maxdepth 1 \
  ! -name '.git' ! -name '.github' ! -name 'docs-site' \
  -exec rm -rf {} +

if [ -d "docs-site" ] && [ "$(ls -A docs-site)" ]; then
  cp -R docs-site/* .
  rm -rf docs-site
else
  echo "::error::docs-site artifact is empty or missing"
  exit 1
fi

for REPORT in $PRESERVED; do
  if [ -d "/tmp/docs-preserve/$REPORT" ]; then
    mkdir -p "$REPORT"
    cp -R "/tmp/docs-preserve/$REPORT/." "$REPORT/"
    echo "Restored existing $REPORT"
  fi
done
rm -rf /tmp/docs-preserve
