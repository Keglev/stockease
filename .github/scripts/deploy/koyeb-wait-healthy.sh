#!/usr/bin/env bash
# Polls Koyeb service status until HEALTHY/READY or timeout.
#
# Requires:
#   KOYEB_API_KEY    – Bearer token (GitHub Secret)
#   KOYEB_SERVICE_ID – Target service identifier (GitHub Secret)
#
# Optional env overrides:
#   POLL_ATTEMPTS – number of attempts before timeout (default: 60)
#   POLL_INTERVAL – seconds between attempts (default: 10)
#
# Usage:
#   run: bash .github/scripts/deploy/koyeb-wait-healthy.sh

set -euo pipefail

ATTEMPTS="${POLL_ATTEMPTS:-60}"
INTERVAL="${POLL_INTERVAL:-10}"

sudo apt-get update -y -q && sudo apt-get install -y -q jq

for i in $(seq 1 "$ATTEMPTS"); do
  STATUS=$(curl -s \
    -H "Authorization: Bearer $KOYEB_API_KEY" \
    "https://app.koyeb.com/v1/services/$KOYEB_SERVICE_ID" \
    | jq -r '.service?.status // "UNKNOWN"')

  echo "[$i/$ATTEMPTS] Service status: $STATUS"

  case "$STATUS" in
    HEALTHY|READY)
      echo "Service is $STATUS."
      exit 0
      ;;
  esac

  sleep "$INTERVAL"
done

echo "ERROR: Service did not reach HEALTHY/READY after $((ATTEMPTS * INTERVAL)) seconds." >&2
exit 1