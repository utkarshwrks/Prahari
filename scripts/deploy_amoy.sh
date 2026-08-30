#!/usr/bin/env bash
# One-shot: deploy PrahariAnchor to Polygon Amoy, anchor a real case root,
# and print the explorer links. Run once the anchorer wallet is funded.
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
cd "$(dirname "${BASH_SOURCE[0]}")/.."

RPC="https://polygon-amoy-bor-rpc.publicnode.com"
KEY=$(cat .secrets/anchorer_amoy.key)
ADDR=$(cat .secrets/anchorer_amoy.addr)
EXPLORER="https://amoy.polygonscan.com"

echo "anchorer: $ADDR"
BAL=$(cast balance "$ADDR" --rpc-url "$RPC")
echo "balance : $BAL wei"
if [ "$BAL" = "0" ]; then echo "NOT FUNDED — claim POL at https://faucet.polygon.technology first"; exit 1; fi

echo "== deploying PrahariAnchor to Amoy =="
DEPLOY=$(cd anchor && forge create src/PrahariAnchor.sol:PrahariAnchor \
  --rpc-url "$RPC" --private-key "$KEY" --broadcast 2>&1)
echo "$DEPLOY" | tail -4
CONTRACT=$(echo "$DEPLOY" | grep "Deployed to:" | awk '{print $3}')
echo "$CONTRACT" > .secrets/amoy_contract.addr
echo "contract: $EXPLORER/address/$CONTRACT"

echo "== anchoring a real case Merkle root =="
# a demonstrative root + caseRef (keccak of a case id) + leaf count
ROOT=$(cast keccak "prahari-case-CASE-001-$(date +%s)")
CASEREF=$(cast keccak "CASE-001")
TX=$(cast send "$CONTRACT" "anchor(bytes32,bytes32,uint32)" "$ROOT" "$CASEREF" 5 \
  --rpc-url "$RPC" --private-key "$KEY" --json | python3 -c 'import sys,json;print(json.load(sys.stdin)["transactionHash"])')
echo "$TX" > .secrets/amoy_anchor.tx
echo "$ROOT" > .secrets/amoy_anchor.root

echo ""
echo "=================================================================="
echo " CONTRACT : $EXPLORER/address/$CONTRACT"
echo " ANCHOR TX: $EXPLORER/tx/$TX"
echo " ROOT     : $ROOT"
echo "=================================================================="
echo ""
echo "verify on-chain via the contract's own view function:"
cast call "$CONTRACT" "verify(bytes32)(bool,uint256,bytes32)" "$ROOT" --rpc-url "$RPC"
