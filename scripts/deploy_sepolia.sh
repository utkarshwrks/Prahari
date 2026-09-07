#!/usr/bin/env bash
# Deploy PrahariAnchor to Ethereum Sepolia from the funded anchorer wallet.
#
# The key lives in .secrets/anchorer_sepolia.key (gitignored, chmod 600) and is
# never echoed. Everything this script prints is public: addresses, tx hashes,
# explorer links.
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
cd "$(dirname "${BASH_SOURCE[0]}")/.."

RPC="${RPC_URL:-https://ethereum-sepolia-rpc.publicnode.com}"
EXPLORER="https://sepolia.etherscan.io"
KEYFILE=".secrets/anchorer_sepolia.key"

[ -f "$KEYFILE" ] || { echo "missing $KEYFILE"; exit 1; }
KEY=$(tr -d ' \n' < "$KEYFILE")
ADDR=$(cast wallet address --private-key "$KEY")
echo "anchorer : $ADDR"

BAL=$(cast balance "$ADDR" --rpc-url "$RPC")
echo "balance  : $(cast from-wei "$BAL") ETH"
[ "$BAL" = "0" ] && { echo "NOT FUNDED"; exit 1; }

CHAIN=$(cast chain-id --rpc-url "$RPC")
[ "$CHAIN" = "11155111" ] || { echo "wrong chain: $CHAIN (want 11155111)"; exit 1; }
echo "chain    : $CHAIN (Sepolia)"

echo ""
echo "== deploying PrahariAnchor =="
OUT=$(cd anchor && forge create src/PrahariAnchor.sol:PrahariAnchor \
  --rpc-url "$RPC" --private-key "$KEY" --broadcast 2>&1)
echo "$OUT" | grep -E "Deployer|Deployed to|Transaction hash" || { echo "$OUT"; exit 1; }

CONTRACT=$(echo "$OUT" | grep "Deployed to:" | awk '{print $3}')
DEPLOY_TX=$(echo "$OUT" | grep "Transaction hash:" | awk '{print $3}')
mkdir -p .secrets
echo "$CONTRACT"  > .secrets/sepolia_contract.addr
echo "$DEPLOY_TX" > .secrets/sepolia_deploy.tx

echo ""
echo "=================================================================="
echo " CONTRACT  : $EXPLORER/address/$CONTRACT"
echo " DEPLOY TX : $EXPLORER/tx/$DEPLOY_TX"
echo "=================================================================="
echo ""
echo "owner      : $(cast call "$CONTRACT" "owner()(address)" --rpc-url "$RPC")"
echo "isAnchorer : $(cast call "$CONTRACT" "anchorers(address)(bool)" "$ADDR" --rpc-url "$RPC")"
