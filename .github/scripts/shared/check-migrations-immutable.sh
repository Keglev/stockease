#!/usr/bin/env bash
# Refuses a pull request that modifies, deletes or renames a Flyway migration
# that already exists on the base branch.
#
# Flyway checksums the whole migration file, comments included, and validates
# those checksums at startup against what it recorded when the migration ran.
# An applied migration is therefore immutable in its bytes, not merely in its
# statements: changing a comment in one is enough to stop the application
# booting. Adding new migrations is always allowed.
#
# Requires:
#   BASE_REF – the pull request's base branch, from github.base_ref
#
# Usage:
#   run: bash .github/scripts/shared/check-migrations-immutable.sh

set -euo pipefail

if [ -z "${BASE_REF:-}" ]; then
  echo "ERROR: BASE_REF is not set; cannot tell which migrations are already applied" >&2
  exit 1
fi

# The checkout is shallow, so the base branch has to be fetched before the diff
# can be taken against it.
git fetch --depth=1 origin "$BASE_REF"

CHANGES=$(git diff --name-status FETCH_HEAD...HEAD -- \
  backend/src/main/resources/db/migration \
  backend/src/main/java/db/migration)

# Status A is a new migration, which is the normal way to change the schema.
# Everything else - M, D, and the R/C forms a rename or copy produces - touches
# a file the base branch already carries.
VIOLATIONS=$(echo "$CHANGES" | grep -v '^A' || true)

if [ -n "$VIOLATIONS" ]; then
  echo "ERROR: this pull request changes migrations that already exist on $BASE_REF" >&2
  echo "$VIOLATIONS" >&2
  echo "Applied migrations are checksummed by Flyway over the whole file, comments included; changing one fails validation at startup. Add a new migration instead." >&2
  exit 1
fi

echo "Migration immutability check passed"
