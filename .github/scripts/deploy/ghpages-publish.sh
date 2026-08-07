#!/usr/bin/env bash
# Commits the synced docs site to the gh-pages branch and pushes it.
#
# Requires:
#   RUN_ID – Docs Pipeline run id the published site was built from
#   CWD    = the gh-pages checkout, after the docs-site sync
#
# Usage:
#   run: bash .github/scripts/deploy/ghpages-publish.sh

set -euo pipefail

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

if git status --porcelain | grep .; then
  git add .
  git commit -m "docs: publish from workflow_run $RUN_ID"
  git push origin gh-pages
  echo "Documentation published"
else
  echo "No changes to publish"
fi
