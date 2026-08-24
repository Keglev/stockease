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

MIGRATION_DIRS="backend/src/main/resources/db/migration backend/src/main/java/db/migration"

if [ -z "${BASE_REF:-}" ]; then
  echo "ERROR: BASE_REF is not set; cannot tell which migrations are already applied" >&2
  exit 1
fi

# The runner's checkout is shallow, so the base branch has to be fetched before
# anything can be compared against it. Depth 1 is enough: only its tip is read.
git fetch --depth=1 origin "$BASE_REF"

# Compared tree against tree, not through `git diff A...B`. A three-dot diff needs
# a merge base, and two depth-1 fetches share no history for git to find one - it
# fails with "no merge base" rather than answering. Reading each blob out of the
# two tips needs no shared history at all, and it states the rule directly: a
# migration the base branch carries must still be there, byte for byte.
VIOLATIONS=""

for path in $(git ls-tree -r --name-only "FETCH_HEAD" -- $MIGRATION_DIRS); do
  BASE_BLOB=$(git rev-parse "FETCH_HEAD:$path")
  if HEAD_BLOB=$(git rev-parse "HEAD:$path" 2>/dev/null); then
    if [ "$BASE_BLOB" != "$HEAD_BLOB" ]; then
      VIOLATIONS="${VIOLATIONS}M	$path
"
    fi
  else
    # Gone from this branch: deleted outright, or renamed, which leaves the applied
    # file just as absent. The new name arrives as an addition and is allowed.
    VIOLATIONS="${VIOLATIONS}D	$path
"
  fi
done

if [ -n "$VIOLATIONS" ]; then
  echo "ERROR: this pull request changes migrations that already exist on $BASE_REF" >&2
  printf '%s' "$VIOLATIONS" >&2
  echo "Applied migrations are checksummed by Flyway over the whole file, comments included; changing one fails validation at startup. Add a new migration instead." >&2
  exit 1
fi

echo "Migration immutability check passed"
