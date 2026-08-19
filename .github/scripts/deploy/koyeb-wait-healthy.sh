#!/usr/bin/env bash
# Polls Koyeb service status until HEALTHY, a terminal status, or the budget expires.
#
# Requires:
#   KOYEB_API_KEY    – Bearer token (GitHub Secret)
#   KOYEB_SERVICE_ID – Target service identifier (GitHub Secret)
#
# Optional env overrides:
#   POLL_ATTEMPTS  – attempts before giving up (default: 60)
#   POLL_INTERVAL  – seconds between attempts (default: 10)
#   POLL_BUDGET    – wall-clock seconds before giving up (default: ATTEMPTS * INTERVAL)
#   KOYEB_API_BASE – API root (default: https://app.koyeb.com), so the loop can be
#                    exercised against a local stub without touching the real account
#
# Usage:
#   run: bash .github/scripts/deploy/koyeb-wait-healthy.sh
#
# ---------------------------------------------------------------------------
# Why every request is bounded
#
# Deploy run 32271377304 sat "in progress" for over an hour against 18-19s for every
# prior run. curl carried no wall-clock bound, so a connection that was accepted and
# then black-holed stalled INSIDE one iteration: the attempt cap can only fire between
# attempts, and the loop never reached the next one. An attempt limit is not a time
# limit unless each attempt is itself bounded.
#
# So every request now carries --connect-timeout 10 and --max-time 15. A healthy status
# read answers in well under a second, so 15s leaves roughly two orders of magnitude of
# headroom - loose enough that it can never cut a real response short, tight enough that
# a dead socket costs one attempt rather than the job. 10s to establish the connection
# is generous for DNS plus TLS from a GitHub runner.
#
# A request that times out is a failed ATTEMPT, not a failed deploy. curl exiting
# non-zero is logged and polled through, because the failure this guards against is
# transient by nature and a single dropped packet must not end a release.
#
# The ceiling is wall-clock, not attempts x interval. Counting attempts cannot bound a
# run once an attempt can stall, which is exactly what the old failure message claimed
# when it reported ATTEMPTS * INTERVAL seconds. The budget below is real elapsed time,
# so the number this script prints on failure is the number that actually elapsed.
#
# Terminal statuses
#
# Koyeb documents nine service statuses. Polling one that will never reach HEALTHY on
# its own burns the whole window and then reports a timeout, hiding the actual reason.
# The set is taken from Koyeb's reference page and cross-checked against the enum in
# their own generated API client, because a status string guessed wrong is a check that
# passes for the wrong reason:
#   https://www.koyeb.com/docs/reference/services
#   koyeb/koyeb-api-client-go, api/v1/koyeb/model_service_status.go
#     STARTING HEALTHY DEGRADED UNHEALTHY DELETING DELETED PAUSING PAUSED RESUMING
#
# STARTING and RESUMING are progress and are polled through. The rest cannot become
# HEALTHY without another deploy, so they exit non-zero naming the status. DEGRADED is
# among them because Koyeb documents it as "the latest Deployment failed" - precisely
# the condition this poll exists to catch - accepting that a transient degradation of
# the already-running deployment will also fail the job rather than be waited out.
# ---------------------------------------------------------------------------

set -euo pipefail

ATTEMPTS="${POLL_ATTEMPTS:-60}"
INTERVAL="${POLL_INTERVAL:-10}"
BUDGET="${POLL_BUDGET:-$((ATTEMPTS * INTERVAL))}"
API_BASE="${KOYEB_API_BASE:-https://app.koyeb.com}"

CONNECT_TIMEOUT=10
MAX_TIME=15

# ubuntu-latest already ships jq. Installing it unconditionally put an unbounded
# apt-get in front of a job whose entire problem was unbounded network calls.
if ! command -v jq >/dev/null 2>&1; then
  sudo apt-get update -y -q && sudo apt-get install -y -q jq
fi

SECONDS=0
ATTEMPT=0

while [ "$ATTEMPT" -lt "$ATTEMPTS" ]; do
  ATTEMPT=$((ATTEMPT + 1))

  if RESPONSE=$(curl -sS \
      --connect-timeout "$CONNECT_TIMEOUT" \
      --max-time "$MAX_TIME" \
      -H "Authorization: Bearer $KOYEB_API_KEY" \
      "$API_BASE/v1/services/$KOYEB_SERVICE_ID" 2>/dev/null); then
    # A 5xx answers with a body jq cannot read; that is a lost attempt, not a verdict.
    STATUS=$(printf '%s' "$RESPONSE" | jq -r '.service?.status // "UNKNOWN"' 2>/dev/null \
      || printf 'UNKNOWN')
  else
    STATUS="REQUEST_FAILED"
  fi

  echo "[$ATTEMPT/$ATTEMPTS ${SECONDS}s/${BUDGET}s] Service status: $STATUS"

  case "$STATUS" in
    HEALTHY|READY)
      echo "Service is $STATUS."
      exit 0
      ;;
    DEGRADED|UNHEALTHY|PAUSING|PAUSED|DELETING|DELETED)
      echo "ERROR: Service reached terminal status $STATUS, which no amount of further" >&2
      echo "polling can change. Failing now rather than after the ${BUDGET}s budget." >&2
      exit 1
      ;;
  esac

  if [ "$((SECONDS + INTERVAL))" -ge "$BUDGET" ]; then
    break
  fi
  sleep "$INTERVAL"
done

# Elapsed can exceed the budget by up to one --max-time, because the check that ends
# the loop runs between attempts and a stalled request is still an attempt in flight.
# That overshoot is what the job's timeout-minutes is set above.
echo "ERROR: Service did not reach HEALTHY. Last status: $STATUS" >&2
echo "(attempts: $ATTEMPT, elapsed: ${SECONDS}s, budget: ${BUDGET}s)." >&2
exit 1
