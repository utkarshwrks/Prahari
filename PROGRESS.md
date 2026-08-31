# PRAHARI v2 — Progress

**Status: v2 complete and demoable.** Actor-centric attribution workbench; the
v1 geofence/Jabalpur console has been fully removed.

## Done
- Actor-centric workbench: actor list, 3D relationship graph, actor profile,
  tabbed proof panels (evidence, Tor timing, chain flow, ledger).
- Evidence fusion: likelihood ratios, root-cause collapse, reliability
  dampening, split-conformal false-merge bound, ECE.
- Five signal families: identity key, financial, infrastructure, linguistic,
  temporal.
- Live Tor timing correlation on an own ephemeral hidden service + client
  (`stem`); delay-invariant interval correlation; simulated fallback badged.
- Blockchain flow: union-find wallet clustering, off-ramp/mixer tagging, real
  mempool.space data.
- Tamper-evident ledger: keccak Merkle chain + Ed25519; on-chain anchor on
  Polygon Amoy (Sepolia secondary), zero-gas for users.
- Generative UI: six pre-paint skins, live reshuffle/lock; accent-aware 3D.
- One-page vector PDF attribution report (preview + download).
- Fullscreen "holo space" graph maximise.
- Deploy configs: Dockerfile, render.yaml, vercel.json, DEPLOYMENT.md.
- Document pack generator (`scripts/gen_docs.cjs`).

## Tests
256 engine tests · 12 Solidity tests · web tests · strict typechecks.

## Pending (user-gated)
- Fund the anchorer wallet (`0x31EdD0021A09f0B32f7dfeb08B58622c75591991`) from a
  free Amoy faucet, then `./scripts/deploy_amoy.sh` for public explorer links.
- Vercel + Render account connections (see DEPLOYMENT.md).
