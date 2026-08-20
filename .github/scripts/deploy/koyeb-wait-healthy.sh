#!/usr/bin/env bash
# Polls the deployment this run triggered until it ships, fails, or the budget expires.
#
# Requires:
#   KOYEB_API_KEY       – Bearer token (GitHub Secret)
#   KOYEB_DEPLOYMENT_ID – the deployment koyeb-redeploy.sh created (step output)
#
# Optional env overrides:
#   POLL_ATTEMPTS  – attempts before giving up (default: 140)
#   POLL_INTERVAL  – seconds between attempts (default: 15)
#   POLL_BUDGET    – wall-clock seconds before giving up (default: ATTEMPTS * INTERVAL)
#   KOYEB_API_BASE – API root (default: https://app.koyeb.com), so the loop can be
#                    exercised against a local stub without touching the real account
#
# Usage:
#   run: bash .github/scripts/deploy/koyeb-wait-healthy.sh
#
# ---------------------------------------------------------------------------
# Why this watches a deployment and not the service
#
# #286 bounded this poll so that it could not hang. It was still asking the wrong
# object. It read GET /v1/services/{id} -> .service.status, and Koyeb builds the new
# deployment alongside the running one: "Any currently running Deployments for the
# Service will continue to run until the new Deployment is marked as healthy." The
# service therefore answers HEALTHY the whole way through - on behalf of the OLD
# instance. Observed live on 2026-08-19/20:
#
#   [1/60 0s/600s] Service status: HEALTHY
#
# printed while the build was still running. The gate passed on the first request and
# every historic 18-19s "deploy" - the entire sibling history of run 32271377304 -
# was that same false green: a job reporting success for a condition that was already
# true before it started. Bounding a measurement of the wrong object only makes it
# fail faster.
#
# A deployment id names the thing THIS run created, so its status is this run's answer
# and nobody else's. Koyeb's own CLI takes the same route: `services redeploy --wait`.
#
# Per-request bounds, and what a failed request means
#
# Both carried over from #286 unchanged. --connect-timeout 10 and --max-time 15: a
# status read answers in well under a second, so 15s can never cut a real response
# while a black-holed socket costs one attempt instead of the job. A request that
# fails is a lost ATTEMPT, not a verdict - the loop logs it and polls again, because
# under `set -euo pipefail` an unguarded curl failure would otherwise end a release
# over one dropped packet. The ceiling is wall-clock, not attempts x interval, so the
# elapsed figure printed on failure is the time that actually passed.
#
# The budget
#
# 600s was sized against the 18-19s figure, which was the false green - it was never a
# measurement of a build. Koyeb caps builds at 30 minutes, and the one observed true
# end-to-end (trigger to healthy) ran to several minutes. The default is now 2100s:
# Koyeb's own 30-minute build ceiling plus 5 minutes for the phases after it, since a
# build that exceeds the cap turns into ERROR and this script should report that real
# reason rather than give up first and call it a timeout. A gate must not lose its
# nerve before the platform it is watching does.
#
# Statuses: all sixteen, and no default that keeps polling
#
# Taken from Koyeb's reference page and cross-checked against the enum in their own
# generated client, as in #286:
#   https://www.koyeb.com/docs/reference/deployments
#   koyeb/koyeb-api-client-go, api/v1/koyeb/model_deployment_status.go
#
# The two disagree, and that is itself the reason for the last branch below: the docs
# document 12, the client declares 16, adding CANCELING CANCELED ERRORING STASHED. The
# docs lag the client and the enum has grown once already, so an unrecognised status
# exits naming itself rather than falling through to "keep polling" - which would burn
# the whole budget and then report a timeout, the exact defect #286 removed.
#
# SLEEPING is success. The old deployment is stopped only once the new one is MARKED
# HEALTHY, so a deployment can only be the sleeping one by having become the active
# one first; a failure ends in ERROR or STOPPED, never in SLEEPING. It gets its own
# message rather than sharing HEALTHY's: the first live deploy is the empirical check
# on this reasoning, and a distinct line is what would make a contradiction visible.
#
# CANCELING, CANCELED and STASHED mean another deployment overtook this one. That is
# exit 1 on purpose - this gate answers for THIS commit, and the superseding deploy's
# own gate answers for itself.
# ---------------------------------------------------------------------------

set -euo pipefail

ATTEMPTS="${POLL_ATTEMPTS:-140}"
INTERVAL="${POLL_INTERVAL:-15}"
BUDGET="${POLL_BUDGET:-$((ATTEMPTS * INTERVAL))}"
API_BASE="${KOYEB_API_BASE:-https://app.koyeb.com}"

CONNECT_TIMEOUT=10
MAX_TIME=15

# ubuntu-latest already ships jq. Installing it unconditionally put an unbounded
# apt-get in front of a job whose entire problem was unbounded network calls.
if ! command -v jq >/dev/null 2>&1; then
  sudo apt-get update -y -q && sudo apt-get install -y -q jq
fi

if [ -z "${KOYEB_DEPLOYMENT_ID:-}" ]; then
  echo "ERROR: KOYEB_DEPLOYMENT_ID is empty. It comes from the redeploy step's" >&2
  echo "deployment_id output; without it this would fall back to watching the" >&2
  echo "service, which is the false green this script exists to end." >&2
  exit 1
fi

echo "Watching deployment $KOYEB_DEPLOYMENT_ID (budget ${BUDGET}s)."

SECONDS=0
ATTEMPT=0

while [ "$ATTEMPT" -lt "$ATTEMPTS" ]; do
  ATTEMPT=$((ATTEMPT + 1))

  if RESPONSE=$(curl -sS \
      --connect-timeout "$CONNECT_TIMEOUT" \
      --max-time "$MAX_TIME" \
      -H "Authorization: Bearer $KOYEB_API_KEY" \
      "$API_BASE/v1/deployments/$KOYEB_DEPLOYMENT_ID" 2>/dev/null); then
    # A 5xx answers with a body jq cannot read; that is a lost attempt, not a verdict.
    STATUS=$(printf '%s' "$RESPONSE" | jq -r '.deployment?.status // "UNKNOWN"' 2>/dev/null \
      || printf 'UNKNOWN')
  else
    STATUS="REQUEST_FAILED"
  fi

  echo "[$ATTEMPT/$ATTEMPTS ${SECONDS}s/${BUDGET}s] Deployment status: $STATUS"

  case "$STATUS" in
    HEALTHY)
      echo "Deployment $KOYEB_DEPLOYMENT_ID is HEALTHY."
      exit 0
      ;;
    SLEEPING)
      echo "Deployment went to sleep after shipping - scale-to-zero service;"
      echo "treated as deployed. It wakes on the first request."
      exit 0
      ;;
    ERROR|ERRORING|STOPPING|STOPPED|DEGRADED|UNHEALTHY)
      echo "ERROR: deployment $KOYEB_DEPLOYMENT_ID failed (status: $STATUS). It" >&2
      echo "cannot reach HEALTHY; failing now rather than after ${BUDGET}s." >&2
      exit 1
      ;;
    CANCELING|CANCELED|STASHED)
      echo "ERROR: deployment $KOYEB_DEPLOYMENT_ID was superseded by another" >&2
      echo "deployment (status: $STATUS); this run's deployment did not ship." >&2
      exit 1
      ;;
    PENDING|PROVISIONING|SCHEDULED|ALLOCATING|STARTING)
      : # In flight. Keep polling.
      ;;
    REQUEST_FAILED|UNKNOWN)
      : # A lost attempt, not a status. Keep polling.
      ;;
    *)
      echo "ERROR: deployment $KOYEB_DEPLOYMENT_ID reported $STATUS, which this" >&2
      echo "build cannot classify. Koyeb's status enum has grown before and their" >&2
      echo "docs lag their client; refusing to guess whether that is progress." >&2
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
echo "ERROR: deployment $KOYEB_DEPLOYMENT_ID did not ship. Last status: $STATUS" >&2
echo "(attempts: $ATTEMPT, elapsed: ${SECONDS}s, budget: ${BUDGET}s)." >&2
exit 1
