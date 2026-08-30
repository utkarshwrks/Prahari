# PROGRESS

The single source of truth for project status. Updated at the end of every phase.

---

## Last phase — 7: EVIDENCE FUSION — 31 August 2026 — automated layer PASS

**The USP.** All six roots fused into one calibrated, guaranteed, reproducible number.

**Shipped**

- **`fusion/score.py`** — LR per signal, **root-cause collapse** (max per root), reliability
  dampening, must-not-link caps, full reproducible trail.
- **`fusion/calibrate.py`** — isotonic calibration, Brier, ECE with bin table, **split-conformal**
  threshold with finite-sample correction.
- **`fusion/eval.py`** — real signals from every prior engine; idempotent, fixed-seed.
- **Endpoints** — `/fusion/model`, `/example`, `/pair/{id}`, `/threshold`, `/thresholds`, `/metrics`,
  `POST /feedback`.

**Acceptance**

| Criterion | Required | Measured |
|---|---|---|
| Deck example | 0.84 ± 0.01 | **0.839543** |
| Naive baseline | 0.999 ± 0.001 | **0.999126** |
| Decoy | ≤ 0.30, negative listed | **0.000803**, `mimicry_suspected` |
| False-merge rate | ≤ α | **0.0313 ≤ 0.05** |
| Trail reproduces `p_raw` | exactly | **yes** |
| Precision / F1 | — | **1.0000 / 0.9381** |
| Brier / ECE | — | **0.0053 / 0.0051** |

**Four bugs, each of which would have survived a demo and failed under scrutiny**

1. **DEC-029 — the guarantee did not hold.** Isotonic outputs are piecewise constant; the conformal
   quantile landed inside a tie block and admitted all of it. **Measured false-merge rate 25.2% while
   the API reported a 5% guarantee.** A guarantee that does not hold is worse than none.
2. **DEC-031 — the rebrand pair was unfindable by construction.** Deriving "candidate" from Splink
   alone gave it the 1:10,000 prior and crushed it to **0.0003** — in the one case built to be findable
   without a hard identifier. Now **0.2335** on lineage + style + timing.
3. **DEC-030 — the trail did not reproduce.** Published at 6 dp, recomputation gave 0.925596 against a
   `p_raw` of 0.925597. One digit, but the whole claim is reproducibility.
4. **DEC-032 — two endpoints, two scales.** `/fusion/threshold` reported τ on raw scores while
   `/fusion/pair` reported calibrated ones.

**Tests:** 201 engine (was 165), 57 web.

---

## Current phase — 8: IMMUTABLE AUDIT — not started

Hash chain, Ed25519 signatures, Merkle roots, Sepolia anchoring with Anvil fallback.

**Objectives**

1. `audit/ledger.py` — canonical JSON, keccak-256, `hash_n = keccak(prev_hash ‖ leaf_n)`, Ed25519
   signatures verified on read.
2. `audit/merkle.py` — per-case tree, root, single-record inclusion proofs.
3. `anchor/` — Foundry: `PrahariAnchor.sol`, `anchor(root, caseRef, leafCount)`, `onlyAnchorer`,
   double-anchor revert.
4. `audit/anchor.py` — `EvmAnchorProvider`, Sepolia default, **Anvil fallback with a visible LOCAL
   CHAIN badge, never silent**.
5. Endpoints `/audit/case/{id}/ledger`, `/seal`, `/audit/verify`.
6. Export `.json` / `.csv` / `.pdf` embedding root, tx hash, chain id and per-record proofs.
7. Tests: tamper detection at the failing index, signature verification, Merkle round-trip,
   `forge test` (double anchor reverts, non-anchorer reverts), end-to-end seal→verify on Anvil.

**Blocker:** B-02 — Foundry is not installed. `curl -L https://foundry.paradigm.xyz | bash && foundryup`

**Handed over from Phase 7:** `PairScore` canonical serialisation, and the analyst actions that must be
hashed (confirm, reject, assign, note, seal, export).

---

## Next phase — 9: WORKBENCH UI

3D graph, tilted MapLibre map, evidence-trail Sankey, audit panel, exports, responsive.

**Prerequisites from Phase 8:** all endpoint contracts the panels consume, with example payloads.

---

## Blockers

| # | Blocker | Blocks | Status |
|---|---|---|---|
| B-01 | Docker not installed | Phase 2 obj 2, 4 | **RESOLVED** 30 Aug — Docker 29.7.2, both images arm64-native, cold start 24 s |
| B-02 | Foundry (`forge`, `anvil`) not installed | Phase 8 | Open — not yet needed, install before Phase 8 |
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
