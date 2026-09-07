#!/usr/bin/env bash
# Run 10 live trials of PRAHARI against the deployed Sepolia contract.
#
# Boots the engine pointed at the real chain, runs every trial through the
# engine's own HTTP API (no test harness, no shortcut), then verifies each
# anchored root by reading the contract directly.
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
cd "$(dirname "${BASH_SOURCE[0]}")/.."

LOGS=".demo-logs"; mkdir -p "$LOGS"
export RPC_URL="${RPC_URL:-https://ethereum-sepolia-rpc.publicnode.com}"
export CHAIN_ID=11155111
export CONTRACT_ADDR="${CONTRACT_ADDR:-$(cat .secrets/sepolia_contract.addr 2>/dev/null || true)}"
export ANCHORER_KEY="${ANCHORER_KEY:-$(tr -d ' \n' < .secrets/anchorer_sepolia.key 2>/dev/null || true)}"

[ -n "$CONTRACT_ADDR" ] || { echo "no CONTRACT_ADDR — run scripts/deploy_sepolia.sh first"; exit 1; }
[ -n "$ANCHORER_KEY" ]  || { echo "no ANCHORER_KEY — .secrets/anchorer_sepolia.key missing"; exit 1; }

echo "contract : $CONTRACT_ADDR"
echo "rpc      : $RPC_URL"

# Always start our OWN engine on a dedicated port. Reusing whatever happens to
# be on :8000 risks driving an engine booted without CONTRACT_ADDR, which would
# report every seal as "NOT CONFIGURED" and quietly produce a run with no
# transactions in it.
PORT=8010
export ENGINE_URL="http://127.0.0.1:$PORT"
pkill -f "uvicorn engine.main:app --port $PORT" 2>/dev/null || true
sleep 1
echo "starting engine on :$PORT ..."
( cd engine && uv run uvicorn engine.main:app --port $PORT > "../$LOGS/engine-trials.log" 2>&1 & )
cleanup() { pkill -f "uvicorn engine.main:app --port $PORT" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

for _ in $(seq 1 120); do
  curl -sf -o /dev/null --max-time 3 "$ENGINE_URL/health" 2>/dev/null && break
  sleep 1
done
curl -sf -o /dev/null --max-time 3 "$ENGINE_URL/health" \
  || { echo "engine did not come up - see $LOGS/engine-trials.log"; exit 1; }

# Fail fast if the engine did not pick up the chain config.
ANCH=$(curl -sf "$ENGINE_URL/health" | python3 -c \
  'import sys,json;d=json.load(sys.stdin);print(json.dumps(d).find("anchoring")>=0 and "seen" or "unknown")' 2>/dev/null || echo unknown)
echo "engine   : ready ($ANCH)"

python3 scripts/run_trials.py
