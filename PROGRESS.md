# PROGRESS

The single source of truth for project status. Updated at the end of every phase.

---

## Last phase — 11: MASTER TESTING — 31 August 2026 — CONDITIONAL PASS

Nothing was built. The system was attacked and had to hold.

**The gate earned its place: the first fresh clone FAILED.**

| Objective | Result |
|---|---|
| 1. Fresh-machine run | **failed first** (`ModuleNotFoundError`, 26 tests) → fixed → **236/236** |
| 2. Full suite on that clone | 98 web · 236 engine · 12 Solidity · 25 e2e, build clean |
| 4. Metrics reproduction | two runs **byte-identical**; every figure verbatim in METRICS, landing, DECK |
| 6. Offline drill | entire critical path runs with no external network |
| 7. Failure drill | 4 kills, all honest; Postgres and Neo4j **healed without restart** |
| 9. Security sweep | **11/11** |
| 10. Global-rule sweep | **10/10** |
| `npm run demo` on a fresh clone | **12 s** (budget 180 s) |

**Two Major defects, both invisible on the development machine**

- **DEC-050** — the dependency manifest declared only Phase 2's packages. Sixteen added ad-hoc across
  Phases 3–8 worked locally and existed nowhere else. A fresh clone could not run the engine.
- **DEC-051** — Phase 10's production guard fired during `next build`, failing the build on any machine
  without a secret. A build authenticates nobody. Build phase exempted; runtime guard unchanged.

**Not certified by the author (DEC-052)**

- Manual checklists by two independent teammates — every manual layer here is author-run
- D3.1 Claude review with N = ALL, which requires a reviewer who is not the author
- A Sepolia anchor — the flow is real and exercised, but only on local Anvil

`v2.0-sih` is **not tagged**.

---

## Current phase — SIH FINALE

**Three things stand between here and a full PASS. None is code.**

1. **D3.1 review in a fresh session** (N = ALL), plus D3.2–D3.5. Must return PASS with zero Critical.
2. **Two teammates run the Part D2 manual checklists** for Phases 8, 9 and 10 — people who did not
   write them.
3. **Either anchor a case on Sepolia** and record the address and tx hash in `docs/QA.md`, **or** say
   "Sepolia-ready, demonstrated on a local chain" on stage and show the LOCAL CHAIN badge doing its job.

**Then tag `v2.0-sih`.**

**Run sheet for the presenter**

```
npm run demo          # ~12s, everything in order
open http://localhost:3000
login officer@mp.gov.in / prahari123
follow docs/DEMO.md   # seven steps, two minutes
```

The one slide that matters: **0.84 against a naive 0.999.** Everything else supports it.

---

## Next phase — POST-HACKATHON ROADMAP

Gwern DNM archives (real timestamps, closing the temporal gap), MapLibre tilted map, 3D actor graph,
d3 Sankey, timeline scrubber, Siamese authorship model, MuRIL Hinglish NER, shared-store rate limiting
for multi-instance deployment.

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
