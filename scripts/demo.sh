#!/usr/bin/env bash
# PRAHARI demo launcher. Starts everything in dependency order and does not
# return until each piece actually answers -- "started" is not "ready", and a
# demo that opens on a half-booted engine is worse than one that waits.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PATH="$HOME/.foundry/bin:$PATH"
LOGS="$ROOT/.demo-logs"; mkdir -p "$LOGS"
T0=$(date +%s)

say() { printf "  %-34s %s\n" "$1" "$2"; }
wait_for() { # url, label, tries
  for _ in $(seq 1 "${3:-40}"); do
    if curl -sf -o /dev/null --max-time 3 "$1" 2>/dev/null; then return 0; fi
    sleep 1
  done
  return 1
}

cleanup() {
  pkill -f "uvicorn engine.main" 2>/dev/null || true
  pkill -f "next dev" 2>/dev/null || true
  pkill -f "anvil --" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo ""
echo "PRAHARI - demo launcher"
echo "-----------------------"

# 1. Datastores.
if docker compose ps --format '{{.Name}}' 2>/dev/null | grep -q prahari-postgres; then
  say "postgres/neo4j" "already up"
else
  docker compose up -d >/dev/null 2>&1
  say "postgres/neo4j" "starting"
fi
for _ in $(seq 1 60); do
  pg=$(docker inspect --format '{{.State.Health.Status}}' prahari-postgres 2>/dev/null || echo none)
  n4=$(docker inspect --format '{{.State.Health.Status}}' prahari-neo4j 2>/dev/null || echo none)
  [ "$pg" = healthy ] && [ "$n4" = healthy ] && break
  sleep 2
done
say "datastores healthy" "$(docker inspect --format '{{.State.Health.Status}}' prahari-postgres 2>/dev/null)"

# 2. Local chain. Sepolia is the public chain; Anvil keeps the demo alive
#    with the network down, and the UI labels it LOCAL CHAIN either way.
if command -v anvil >/dev/null 2>&1; then
  if ! curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8545 2>/dev/null; then
    anvil --silent --port 8545 > "$LOGS/anvil.log" 2>&1 &
    sleep 4
  fi
  KEY=${ANCHORER_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}
  ADDR=$(cd anchor && forge create src/PrahariAnchor.sol:PrahariAnchor \
        --rpc-url http://127.0.0.1:8545 --private-key "$KEY" --broadcast 2>/dev/null \
        | grep "Deployed to:" | awk '{print $3}')
  export CONTRACT_ADDR="$ADDR" ANCHORER_KEY="$KEY" RPC_URL="http://127.0.0.1:8545"
  say "anvil + contract" "${ADDR:-deploy failed}"
else
  say "anvil" "not installed - sealing disabled, everything else runs"
fi

# 3. Engine.
( cd engine && uv run uvicorn engine.main:app --port 8000 > "$LOGS/engine.log" 2>&1 & )
wait_for http://localhost:8000/health "engine" 60 && say "engine :8000" "ready" \
  || { say "engine" "FAILED - see $LOGS/engine.log"; exit 1; }

# 4. Web.
npm run dev > "$LOGS/web.log" 2>&1 &
wait_for http://localhost:3000/login "web" 60 && say "web :3000" "ready" \
  || { say "web" "FAILED - see $LOGS/web.log"; exit 1; }

echo ""
echo "  ready in $(( $(date +%s) - T0 ))s"
echo ""
echo "  open  http://localhost:3000"
echo "  login officer@mp.gov.in / prahari123"
echo "  script docs/DEMO.md"
echo ""
echo "  Ctrl-C to stop everything."
wait
