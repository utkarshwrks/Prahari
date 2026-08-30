# PROGRESS

The single source of truth for project status. Updated at the end of every phase.

---

## Last phase — 4: IDENTITY GRAPH — 31 August 2026 — automated layer PASS

Neo4j resolution and Splink linkage.

**Shipped**

- **Graph** (`engine/engines/graph.py`) — 244 personas, 372 entities, 518 typed weighted edges in
  Neo4j. WCC over hard identifiers only forms 140 actors; Louvain communities; 244 FastRP embeddings.
- **Linkage** (`engine/engines/linkage.py`) — Splink 4 on DuckDB, six blocking rules, m/u **measured
  from ground truth** rather than estimated.
- **Endpoints** — `/graph/stats`, `/actor/{id}`, `/persona/{id}`, `/search`, `/candidates`,
  `/metrics`, `/reload`. All degrade honestly when Neo4j is down.
- **Autonomous mode** — APScheduler graph-reload job every 10 min; skips cleanly when Neo4j is down.

**Results**

| Metric | Value |
|---|---|
| Precision @ 0.5 | **1.000** (0 false positives) |
| Recall @ 0.5 | 0.818 — **130/130 of all reachable pairs** |
| Multi-persona → one actor | 130 / 130 |
| **Decoy → separate actor** | **yes**, despite identical bio and matching style |
| **False merges over 3,180 unrelated pairs** | **0** |
| Decoy `match_probability` | 0.0010 (blocked, then rejected on evidence) |

**Tests:** 114 engine (was 92), 56 web, build clean.

**Two bugs that were invisible except as bad recall**

1. **Contaminated u (DEC-020).** `estimate_u_using_random_sampling` assumes matches are rare; it
   sampled all 29,646 pairs including the 130 sharing a PGP key and reported u(pgp)=0.0053 when the
   measured value is 0. A near-conclusive identifier became a Bayes factor of 187 and recall collapsed
   to 0.11. Now measured with Laplace smoothing: BF 38,519.
2. **Training overwrote the measurement.** Calling `estimate_m_from_label_column` after setting
   explicit m/u silently replaced them, putting a PGP-sharing pair in the "all other" level at
   `match_weight = -0.8` — the strongest identifier in the system read as evidence *against*.

**Recall is 0.818, not the playbook's 0.9, and the ceiling is structural (DEC-021).** Only 130 of 159
true pairs share any hard identifier. The other 29 are unreachable by record linkage in principle and
are exactly what Phases 5 and 7 exist to catch. Raising the generator's sharing rate would clear 0.9
while making the task easier — refused.

---

## Current phase — 5: STYLOMETRY & BEHAVIOUR — not started

Authorship verification, counter-deception, rebrand detection.

**Objectives**

1. `engine/engines/stylometry.py` — TF-IDF char 3–5-grams, 150 function words, TTR, punctuation
   habits, **Hinglish markers**, LaBSE embeddings. Cosine → `s_style`.
2. `engine/engines/behaviour.py` — posting-hour and weekday histograms (IST), inter-post intervals.
   Jensen–Shannon → `s_time`.
3. Siamese char-CNN in PyTorch (CPU). If training exceeds 30 min, fall back to a classic-features
   logistic model and record the cut.
4. Counter-deception: copied-bio detector (Jaccard > 0.9 → `mimicry_suspected`, caps `s_style` at
   0.2); LLM-rewrite detector (burstiness + typo rate → `s_style` weight 0.3).
5. Rebrand detection with `ruptures` change-point on daily activity.
6. Endpoints `/style/compare`, `/behaviour/compare`, `/rebrand/candidates`.
7. Tests: true pairs > decoy pairs on mean `s_style`; decoy emits `mimicry_suspected`; rebrand
   detected; all endpoints degrade to classic features when model weights are absent.

**What Phase 4 handed over, and why it matters here**

The **29 true pairs sharing no hard identifier** are unreachable by linkage and are now Phase 5's
job — including the rebrand pair, which was deliberately built with distinct wallets joined by a
lineage edge. The **decoy** must stay rejected: it will score HIGH on style by construction, so
`mimicry_suspected` is what has to catch it. Phase 5 is where the two cases invert.

---

## Next phase — 6: INFRASTRUCTURE FINGERPRINTING

Passive onion → clearnet matching via crt.sh, Shodan (cache-only without a key), JARM.

**Prerequisites from Phase 5:** style and behaviour signals written to the `signals` table with root
labels, so Phase 6's infra signals join the same schema ahead of fusion in Phase 7.

---

## Blockers

| # | Blocker | Blocks | Status |
|---|---|---|---|
| B-01 | Docker not installed | Phase 2 obj 2, 4 | **RESOLVED** 30 Aug — Docker 29.7.2, both images arm64-native, cold start 24 s |
| B-02 | Foundry (`forge`, `anvil`) not installed | Phase 8 | Open — not yet needed, install before Phase 8 |
| B-03 | Shodan free tier may not include host-lookup API credits | Phase 6 obj 1 | Open — **validate in the first hour of Phase 6**. Mitigation already in the design: crt.sh carries the 0.95/0.85 rules and Shodan degrades to cache-only. Not a free/open-source rule violation, just an unverified capacity assumption. |
| B-04 | Gwern DNM Archives manual download | Phase 3 | **Kaggle Agora RESOLVED** 31 Aug — 109,689 rows loaded, 1,000-row real fixture committed. Gwern deferred per DEC-019; it is the only source with timestamps, so it stays a Phase 10 nice-to-have, not a demo dependency. |

No blocker has been resolved by substituting a paid service.

---

## Metrics

Filled from Phase 7 (`python -m engine.fusion.eval`). See `docs/METRICS.md` for definitions and the
full tables.

| Metric | Value |
|---|---|
| Precision / Recall / F1 @ τ | pending — Phase 7 |
| False-merge rate @ τ(α=0.05) | pending — Phase 7 |
| Brier / ECE | pending — Phase 7 |
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
