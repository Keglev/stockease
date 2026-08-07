#!/usr/bin/env bash
# Restores the seeded demo baseline by calling the backend's token-protected
# reset endpoint, and reports the HTTP status and response envelope.
#
# Requires:
#   RESET_URL        – demo reset endpoint (job-level env in demo-reset.yml)
#   DEMO_RESET_TOKEN – shared secret, must match the backend's app.demo.reset-token
#
# `set -e` is deliberately absent: the `&& curl_exit=0 || curl_exit=$?` capture
# below depends on the script surviving curl's nonzero exit, and -e would abort
# before the status and body are reported — losing the whole diagnostic.
#
# Usage:
#   run: bash .github/scripts/deploy/demo-reset.sh

set -uo pipefail

# No --verbose anywhere: it would echo the request headers, and the
# token is one of them. --silent --show-error keeps errors visible
# without the header dump.
#
# Retries cover the free-tier instance's cold start: the first request
# after an idle period can time out while the container wakes.
status=$(curl \
  --silent --show-error \
  --request POST \
  --header "X-Demo-Reset-Token: ${DEMO_RESET_TOKEN}" \
  --fail-with-body \
  --max-time 120 \
  --retry 3 \
  --retry-delay 30 \
  --retry-all-errors \
  --output response.txt \
  --write-out '%{http_code}' \
  "${RESET_URL}") && curl_exit=0 || curl_exit=$?

echo "HTTP status: ${status:-<no response>}"
echo "Response body:"
# The body is the standard API envelope; its message is the whole
# diagnostic, so it is printed on success and on failure alike.
cat response.txt 2>/dev/null || echo "<no body received>"
echo

exit "${curl_exit}"
