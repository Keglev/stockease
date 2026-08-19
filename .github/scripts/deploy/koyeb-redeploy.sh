#!/usr/bin/env bash
# Triggers a Koyeb service redeploy via the Koyeb REST API.
#
# Requires:
#   KOYEB_API_KEY    – Bearer token (GitHub Secret)
#   KOYEB_SERVICE_ID – Target service identifier (GitHub Secret)
#
# Optional env overrides:
#   KOYEB_API_BASE – API root (default: https://app.koyeb.com), so the call can be
#                    exercised against a local stub without touching the real account
#
# Usage:
#   run: bash .github/scripts/deploy/koyeb-redeploy.sh
#
# ---------------------------------------------------------------------------
# Why the request is bounded
#
# This POST had no wall-clock bound either, and unlike the health poll it has no loop
# around it: a connection accepted and then black-holed hangs this step with no cap of
# any kind, which is the shortest path to the hour-long "in progress" run this change
# exists to prevent (run 32271377304).
#
# --connect-timeout 10 is generous for DNS plus TLS from a GitHub runner.
# --max-time 30 is deliberately twice the health poll's, because this call does more
# than read a field: it asks Koyeb to accept and enqueue a deployment. The observed
# healthy deploy completes end to end in 18-19s, so 30s for the enqueue alone is
# headroom rather than a limit anything real is expected to approach.
#
# A timeout here fails the step, and should: unlike a poll attempt there is no second
# chance to fall back on, and retrying a redeploy that may already have been accepted
# would risk queuing a second deployment. It is reported as its own case so the log
# says the request never returned, rather than leaving `set -e` to abort with nothing.
# ---------------------------------------------------------------------------

set -euo pipefail

API_BASE="${KOYEB_API_BASE:-https://app.koyeb.com}"

CONNECT_TIMEOUT=10
MAX_TIME=30

echo "Triggering redeploy for service $KOYEB_SERVICE_ID..."

RESPONSE_FILE=$(mktemp)
trap 'rm -f "$RESPONSE_FILE"' EXIT

set +e
HTTP_CODE=$(curl -sS -o "$RESPONSE_FILE" -w "%{http_code}" \
  --connect-timeout "$CONNECT_TIMEOUT" \
  --max-time "$MAX_TIME" \
  -X POST "$API_BASE/v1/services/$KOYEB_SERVICE_ID/redeploy" \
  -H "Authorization: Bearer $KOYEB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}')
CURL_EXIT=$?
set -e

if [ "$CURL_EXIT" -ne 0 ]; then
  echo "ERROR: Redeploy request returned no response (curl exit $CURL_EXIT," >&2
  echo "--connect-timeout ${CONNECT_TIMEOUT}s, --max-time ${MAX_TIME}s)." >&2
  exit 1
fi

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
