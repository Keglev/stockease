#!/usr/bin/env bash
# Triggers a Koyeb service redeploy via the Koyeb REST API.
#
# Requires:
#   KOYEB_API_KEY    – Bearer token (GitHub Secret)
#   KOYEB_SERVICE_ID – Target service identifier (GitHub Secret)
#
# Usage:
#   run: bash .github/scripts/deploy/koyeb-redeploy.sh

set -euo pipefail

echo "Triggering redeploy for service $KOYEB_SERVICE_ID..."

RESPONSE_FILE=$(mktemp)

HTTP_CODE=$(curl -s -o "$RESPONSE_FILE" -w "%{http_code}" \
  -X POST "https://app.koyeb.com/v1/services/$KOYEB_SERVICE_ID/redeploy" \
  -H "Authorization: Bearer $KOYEB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "HTTP status: $HTTP_CODE"
echo "Response:"
cat "$RESPONSE_FILE"

case "$HTTP_CODE" in
  200|201|202) echo "Redeploy triggered successfully." ;;
  *)
    echo "ERROR: Unexpected HTTP status $HTTP_CODE" >&2
    exit 1
    ;;
esac