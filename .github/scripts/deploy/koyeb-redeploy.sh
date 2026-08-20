#!/usr/bin/env bash
# Triggers a Koyeb service redeploy and publishes the id of the deployment it created.
#
# Requires:
#   KOYEB_API_KEY    – Bearer token (GitHub Secret)
#   KOYEB_SERVICE_ID – Target service identifier (GitHub Secret)
#
# Optional env overrides:
#   KOYEB_API_BASE – API root (default: https://app.koyeb.com), so the call can be
#                    exercised against a local stub without touching the real account
#
# Outputs (via $GITHUB_OUTPUT):
#   deployment_id – consumed by koyeb-wait-healthy.sh as KOYEB_DEPLOYMENT_ID
#
# Usage:
#   run: bash .github/scripts/deploy/koyeb-redeploy.sh
#
# ---------------------------------------------------------------------------
# Why the reply body is now read
#
# It used to be printed and thrown away, and the wait step went on to poll the SERVICE
# - which keeps answering HEALTHY from the old instance while the new deployment
# builds, so the gate passed before the build had begun. The reply already carries the
# only identifier that distinguishes this run's deployment from the one already
# running, so the fix starts here: parse it, and hand it to the poll.
#
# The shape is verified, not assumed. koyeb-api-client-go declares RedeployReply with
# a single field, `deployment`, and Deployment carries `id` - the same source that
# settled the status enums in #286:
#   koyeb/koyeb-api-client-go, api/v1/koyeb/model_redeploy_reply.go, model_deployment.go
#
# A missing id fails loudly rather than passing an empty string down the pipeline. An
# empty id would make the next step's URL a deployment listing instead of a deployment,
# and the whole point of this change is to stop measuring the wrong object.
#
# Why the request is bounded (unchanged from #286)
#
# This POST has no loop around it, so an accepted-then-black-holed connection would
# hang the step with no cap of any kind - the shortest path to the hour-long run
# 32271377304. --connect-timeout 10 is generous for DNS plus TLS from a runner.
# --max-time 30 is twice the poll's, because this call asks Koyeb to accept and
# enqueue a deployment rather than read a field.
#
# A timeout here fails the step, and should: there is no second chance to fall back on,
# and retrying a POST that may already have been accepted would risk queuing a second
# deployment - which the poll would then report as having superseded this one.
# ---------------------------------------------------------------------------

set -euo pipefail

API_BASE="${KOYEB_API_BASE:-https://app.koyeb.com}"

CONNECT_TIMEOUT=10
MAX_TIME=30

if ! command -v jq >/dev/null 2>&1; then
  sudo apt-get update -y -q && sudo apt-get install -y -q jq
fi

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
echo

case "$HTTP_CODE" in
  200|201|202) echo "Redeploy triggered successfully." ;;
  *)
    echo "ERROR: Unexpected HTTP status $HTTP_CODE" >&2
    exit 1
    ;;
esac

DEPLOYMENT_ID=$(jq -r '.deployment?.id // empty' "$RESPONSE_FILE" 2>/dev/null || printf '')

if [ -z "$DEPLOYMENT_ID" ]; then
  echo "ERROR: the redeploy reply carried no .deployment.id, so there is no" >&2
  echo "deployment to watch. Koyeb accepted the request (HTTP $HTTP_CODE), but" >&2
  echo "polling cannot proceed without the id - watching the service instead is" >&2
  echo "the false green this deploy gate exists to end. Reply body above." >&2
  exit 1
fi

echo "Deployment id: $DEPLOYMENT_ID"

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "deployment_id=$DEPLOYMENT_ID" >> "$GITHUB_OUTPUT"
else
  # Only reachable outside Actions - the local stub probes run this way.
  echo "NOTE: GITHUB_OUTPUT is unset; deployment_id not published." >&2
fi
