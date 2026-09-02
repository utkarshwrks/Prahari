#!/usr/bin/env bash
# Pre-demo warm-up (DEC-064).
#
# "The highest-value 20 lines in the phase", and the playbook is right: the
# failure this prevents is a judge watching a spinner for sixty seconds while
# three free services cold-start one after another.
#
# It pings all three services, POLLS until each answers, prints the measured
# cold-start time, and then warms the engine's own caches -- `actors_index.pkl`
# and `signals_cache.pkl` -- so the first workbench load in front of an audience
# is fast rather than merely successful.
#
#   bash scripts/warmup.sh          # the deployed services
#   npm run warmup                  # same
#   BASE_ENGINE=http://localhost:8000 BASE_WEB=http://localhost:3000 \
#     bash scripts/warmup.sh        # a local run
set -uo pipefail

ENGINE="${BASE_ENGINE:-https://prahari-v2-engine.onrender.com}"
WEB="${BASE_WEB:-https://prahari-v2-web.onrender.com}"
V1="${BASE_V1:-https://prahari-6njh.onrender.com}"

# A cold start is about a minute; 150 s leaves room for three at once.
DEADLINE="${WARMUP_DEADLINE:-150}"

fail=0

wake () {
  local name="$1" url="$2"
  local start elapsed code
  start=$(date +%s)
  printf '  %-8s ' "$name"

  while :; do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$url" || echo 000)
    elapsed=$(( $(date +%s) - start ))
    case "$code" in
      2*|3*)
        printf 'awake in %3ss  (HTTP %s)\n' "$elapsed" "$code"
        return 0
        ;;
    esac
    if [ "$elapsed" -ge "$DEADLINE" ]; then
      # Report it, do not pretend. A warm-up that claims success it did not
      # have is worse than one that fails, because nobody re-checks.
      printf 'NOT AWAKE after %ss (last HTTP %s)\n' "$elapsed" "$code"
      fail=1
      return 1
    fi
    sleep 3
  done
}

echo "PRAHARI warm-up — three free services, cold-start ~60s each"
echo

wake engine "$ENGINE/health/ping"
wake web    "$WEB/api/health"
wake v1     "$V1/"

echo
echo "Warming engine caches (the first workbench load is the slow one):"

# Milliseconds, portably.
#
# `date +%s%3N` is GNU-only. BSD date (macOS) SUCCEEDS and returns the seconds
# followed by a literal "3N", so a `|| fallback` never fires and the arithmetic
# then fails with "value too great for base". Found by running this on macOS.
# The output is validated instead of the exit status.
now_ms () {
  local t
  t=$(date +%s%3N 2>/dev/null)
  case "$t" in
    ''|*[!0-9]*) python3 -c 'import time;print(int(time.time()*1000))' ;;
    *) printf '%s' "$t" ;;
  esac
}

warm () {
  local label="$1" path="$2"
  local start ms code
  start=$(now_ms)
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 90 "$ENGINE$path" || echo 000)
  ms=$(( $(now_ms) - start ))
  printf '  %-22s %5sms  (HTTP %s)\n' "$label" "$ms" "$code"
}

# These are the calls that build the expensive caches. /fusion/metrics triggers
# Splink training on a cold engine -- about twenty seconds, and DEC-054 exists
# because a judge once hit that first.
warm "actors index"   "/actors?limit=1"
warm "signals cache"  "/fusion/metrics"
warm "audit ledger"   "/audit/case/CASE-001/ledger"
warm "graph stats"    "/graph/stats"

echo
if [ "$fail" -eq 0 ]; then
  echo "All three services are awake and the caches are warm."
  echo "They stay awake for 15 minutes without traffic. Re-run if the demo slips."
else
  echo "At least one service did not wake. Check the Render dashboard before"
  echo "presenting — do not assume it will come up on its own."
fi
exit "$fail"
