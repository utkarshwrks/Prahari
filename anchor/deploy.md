# Deploying PrahariAnchor (zero-gas for users)

The contract is anchored by ONE backend wallet, funded once from a free faucet.
Analysts and judges never touch gas — from their side every seal is zero-gas.

## Polygon Amoy (primary — survives past 2026)

```bash
# 1. one free faucet claim funds the anchorer for thousands of anchors
#    https://faucet.polygon.technology  (Amoy, POL)

# 2. deploy
export ANCHORER_KEY=0x<funded-amoy-key>
forge create src/PrahariAnchor.sol:PrahariAnchor \
  --rpc-url https://rpc-amoy.polygon.technology \
  --private-key $ANCHORER_KEY --broadcast

# 3. verify the source on the explorer (green check)
forge verify-contract <addr> src/PrahariAnchor.sol:PrahariAnchor \
  --chain 80002 --verifier etherscan \
  --etherscan-api-key <free-polygonscan-key>

# 4. point the engine at it
#    CONTRACT_ADDR=<addr> RPC_URL=https://rpc-amoy.polygon.technology CHAIN_ID=80002
```

## Ethereum Sepolia (secondary, while it lives)
Same commands with `--rpc-url https://ethereum-sepolia-rpc.publicnode.com` and `--chain 11155111`.

## Offline (Wi-Fi off demo)
`anvil` + `forge create ... --rpc-url http://127.0.0.1:8545`. The UI shows a
LOCAL CHAIN badge and renders no explorer link — a local seal is never passed
off as public.
