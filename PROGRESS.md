# PROGRESS

The single source of truth for project status. Updated at the end of every phase.

---

## Last phase — 8: IMMUTABLE AUDIT — 31 August 2026 — automated layer PASS

Court-grade chain of custody.

**Shipped**

- **`audit/ledger.py`** — canonical JSON, keccak-256 (Solidity-compatible), hash chain
  `hash_n = keccak(prev ‖ leaf)`, Ed25519 signing and verification, closed action set.
- **`audit/merkle.py`** — per-case tree with **odd-node promotion**, root, single-record inclusion
  proofs.
- **`anchor/PrahariAnchor.sol`** — Foundry project, solc 0.8.36, `onlyAnchorer`, double-anchor
  revert, `Anchored` event. **`forge test` 12/12.**
- **`audit/anchor.py`** — `EvmAnchorProvider` with Sepolia default and **visible** Anvil fallback.
- **Endpoints** — ledger, record, seal, proof, verify, and `.json` / `.csv` / `.pdf` export.

**Verified end to end against a live Anvil chain**

| Step | Result |
|---|---|
| Seal | ok, chain 31337, block 3, **gas 95,232** |
| `explorer_url` on local chain | **None** — no fabricated Sepolia link |
| Export → verify | **GREEN**, root matches |
| Tamper one byte → verify | **RED at index 2**, "content was altered" |
| Restore → verify | **GREEN** |
| Single-record inclusion proof | verifies with 3 siblings; altered proof rejected |

**D3.3 threat model — attacker with full database write access, without the analyst key**

| Attack | Outcome |
|---|---|
| Modify a record in place | detected at the index |
| Delete a middle record | detected — `seq` gap is evidence |
| Delete, relink `prev_hash` **and** renumber `seq` | **still detected** |
| Re-sign with a different key | detected — key not registered to that analyst |
| Reorder records | detected |
| Replay another case's seal | reverts on chain (`AlreadyAnchored`) |
| Show a Sepolia link for an Anvil tx | **impossible** — derived from the connected chain id |

**Tests:** 233 engine (was 201), 12 Solidity, 57 web.

---

## Current phase — 9: WORKBENCH UI — not started

PC-first, phone-safe, instrument-grade, no emojis.

**Objectives**

1. MapLibre GL replacing Leaflet: 60° pitch, extruded city-heat columns, animated geofence rings,
   same `lastPulse.seq` siren contract, actor operating footprint.
2. `panels/ActorGraph.tsx` — react-force-graph-3d over `/graph/actor/{id}`, Sigma 2D fallback below
   768 px, timeline scrubber.
3. `panels/EvidenceTrail.tsx` — d3 Sankey signals → roots → score, LR table, negatives as red flags,
   reliability diagram, **conformal threshold slider** (must not imply finer resolution than
   DEC-029 supports).
4. `panels/AuditLedger.tsx` — live hash chain, Merkle tree, Seal button → tx card with **LOCAL CHAIN
   badge**, Verify drop-zone → green/red with failing index.
5. `panels/WalletFlow.tsx`, `IntelDetailModal` "find linked personas".
6. `RecordsModal` CSV + PDF via the engine; **replace both `document.write` sites** (FINDING-02).
7. Motion behind `prefers-reduced-motion`; focus trap, Escape, `aria-live`.
8. Responsive: ≥1280 three columns, 768–1279 two, <768 stacked; touch targets ≥44 px; zero
   horizontal overflow.
9. Playwright journey: login → DATASET → actor → trail shows 0.84 → seal → verify green → tamper → red.

**Carried debt now due:** FINDING-02 (two `document.write` sites), FINDING-05 (no
`prefers-reduced-motion` anywhere).

---

## Next phase — 10: LANDING, DEMO HARDENING, DOCS, METRICS

**Prerequisites from Phase 9:** the list of copy strings on landing/about/docs that still describe
v1-only behaviour.

---

## Blockers

| # | Blocker | Blocks | Status |
|---|---|---|---|
| B-01 | Docker not installed | Phase 2 obj 2, 4 | **RESOLVED** 30 Aug — Docker 29.7.2, both images arm64-native, cold start 24 s |
| B-02 | Foundry not installed | Phase 8 | **RESOLVED** 31 Aug — Foundry 1.8.1, `forge test` 12/12, contract deployed and sealed on Anvil (DEC-033). |
| B-03 | Shodan free tier credits | Phase 6 | **RESOLVED** 31 Aug — no key needed at all. `internetdb.shodan.io` is free and unauthenticated (DEC-026). |
| B-04 | Gwern DNM Archives manual download | Phase 3 | **Kaggle Agora RESOLVED** 31 Aug — 109,689 rows loaded, 1,000-row real fixture committed. Gwern deferred per DEC-019; it is the only source with timestamps, so it stays a Phase 10 nice-to-have, not a demo dependency. |

| B-05 | crt.sh returned HTTP 502 on 5/5 attempts | Phase 6 | **MITIGATED** 31 Aug — certspotter (also free, also keyless) is now primary, crt.sh is failover (DEC-027). Not resolved upstream; the service is simply unreliable. |

No blocker has been resolved by substituting a paid service.

---

## Metrics

Filled from Phase 7 (`python -m engine.fusion.eval`). See `docs/METRICS.md` for definitions and the
full tables.

| Metric | Value |
|---|---|
| **Precision / Recall / F1 @ τ** | **1.0000 / 0.8833 / 0.9381** |
| **False-merge rate @ τ(α=0.05)** | **0.0313 ≤ 0.05** ✔ |
| **Brier / ECE** | **0.005333 / 0.005083** |
| **Extraction P/R** | **EN 1.000 / HI 1.000 recall** (regression guard; 7/10 on unseen forms, 0 false positives) |
| **Splink P/R** | **P=1.000 R=0.818** (130/130 reachable, 0 false positives) |
| **Fusion worked example** | **0.8395 → 0.84** (verified Phase 1) |
| **Naive noisy-OR baseline** | **0.9991 → 0.999** (verified Phase 1) |

---

## Demo status

Which of the seven `docs/DEMO.md` steps run end-to-end today.

| Step | State |
|---|---|
| 1. Geofence on the map (DEMO mode) | **works** — v1, breaches at ~6 s and ~15 s |
| 2. DATASET mode, real listings | **works** — 1,000 real Agora listings with extracted entities |
| 2. DATASET mode, real listings | not built — Phase 2 wiring, Phase 3 data |
| 3. Actor graph, decoy separation | not built — Phase 4 |
| 4. Evidence trail, 0.84 vs 0.999 | not built — Phase 7 (maths verified Phase 1) |
| 5. Seal on Sepolia | not built — Phase 8 |
| 6. Verify / tamper / restore | not built — Phase 8 |
| 7. Operating footprint + district routing | not built — Phase 9 |

**1 of 7.**

---

## Handoff to Phase 2

Phase 1 changed no v1 behaviour: the geofence, the streamer, the threat state machine and both API routes
are byte-for-byte intact, and the two invariants most likely to be broken by a restructure are now frozen
by tests (`ZONE_CITIES` exact set equality, and `isInJabalpurZone` consulting only the MP gazetteer).

For Phase 2, the engine skeleton must expose, before any intelligence exists behind it: `GET /health`
and `GET /version` returning JSON with no `.env` present; `GET /feed` returning `{items: []}` in the v1
`Intercept` shape so `store/intel.ts`'s third `tick()` branch can consume it without a type change; and
`GET /sources` returning a list with `last_scan`, `freshness_s`, `items_24h`. All three must be reachable
only through `web/app/api/engine/[...path]/route.ts` — a browser-visible engine URL is a Critical finding.

The mode toggle is the risk in Phase 2. v1's `setDemoMode(on: boolean)` clears the feed, the map and the
threat state while deliberately preserving cumulative counters and the alert log — because the dedup
`Set`s live outside zustand (INV-5). The three-way version must keep exactly that semantic on every one
of the six transitions, not just DEMO↔LIVE. Install Docker (B-01) before starting.
