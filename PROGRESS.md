# PROGRESS

The single source of truth for project status. Updated at the end of every phase.

---

## Last phase — 3: DATA — 31 August 2026 — automated layer PASS

Real datasets, labelled testbed, deep extraction.

**Shipped**

- **Testbed** (`engine/testbed/generate.py`) — fixed-seed synthetic ground truth: 244 personas,
  2,928 posts, 3,340 labelled pairs (**159 positive**, 20:1 capped negatives), all four cases
  injected. The only labelled dataset in the project, so every metric comes from here.
- **Extraction** (`engine/extract/`) — Python port of `extractor.ts`, extended with PGP fingerprints
  via `pgpy`, onion v3, Monero, email, Telegram, and spaCy. INV-3 preserved: never raises, always
  names the engine that ran.
- **Normalisation** (`engine/extract/normalise.py`) — **FINDING-07 fixed.** 43 aliases across the MP
  gazetteer; `jbp`, `jblp`, `जबलपुर`, `murwara` all resolve. Region terms (`MP`, `India`) explicitly
  refuse to resolve to a city.
- **Agora loader** (`engine/ingest/kaggle_agora.py`) — full 109,689-row load, 0 skipped, 3,192
  personas, **1,832 bodies (1.67%) dropped** by the content blocklist, count reported not hidden.
  1,000-row real fixture committed.
- **DATASET feed** — `/feed` serves real Agora listings with extracted entities, explicitly flagged
  `geofenced: false`.
- **`/extract`** — mirrors v1's `/api/analyze` with the fuller engine.
- **OSINT + chain adapters** — v1's three sources ported to Python; mempool.space (no key) and
  Etherscan (degrades honestly without a key).

**Tests passing**

| Command | Result |
|---|---|
| `npm test` | 56 passed |
| `npm run build` | clean |
| `uv run pytest` | **92 passed** (was 26) |
| extraction P/R | English 1.000 / Hinglish 1.000 recall, thresholds 0.85 / 0.70 |
| testbed determinism | same seed → identical digest |
| end-to-end via proxy | `/feed` 1,000 items, `/extract` resolves `jbp` → Jabalpur |
| engine killed | workbench fully alive, DATASET degrades honestly |

**Honest note on the 1.000 extraction scores.** The labelled sentences and the alias table were
authored together, so those figures are a regression guard, not a generalisation estimate. An
independent probe of surface forms absent from the alias table scores **7/10**, with all three
misses being unseen misspellings and **zero false positives**. Matching is deliberately
exact-alias with no fuzzy fallback: a fabricated city manufactures a breach that never happened,
which for a police tool is worse than missing one. Both directions are pinned by tests.

**Three findings recorded (DEC-018)** — measured on the real file before writing code: Agora has
**no timestamps** (so the `temporal` root is testbed-only), **PGP in ~0.1% of rows** (so
`identity_key` is testbed-driven), and **zero MP geography** (so the geofence stays a DEMO story).
This maps onto the three-way toggle: DEMO carries the geofence, DATASET carries linkage and
stylometry, the testbed carries every metric.

---

## Current phase — 4: IDENTITY GRAPH — not started

Splink blocking and Neo4j GDS resolution.

**Objectives**

1. `engine/engines/graph.py` — load personas, entities, posts into Neo4j. Typed weighted edges:
   `SIGNED_WITH` 0.95, `PAID_TO` 0.80, `CONTACT` 0.70, `VOUCHES_FOR` 0.30, `MENTIONS` 0.20,
   `LOCATED`. Idempotent `MERGE`.
2. `engine/engines/linkage.py` — Splink on DuckDB. Blocking on shared PGP / wallet / email /
   telegram / onion, Jaro-Winkler handle >= 0.9, same category with overlapping window. EM-trained
   m/u exported to METRICS.
3. GDS: WCC over hard identifiers → `Actor` super-nodes; Louvain; FastRP 128-d into pgvector.
4. Endpoints `/graph/actor/{id}`, `/graph/candidates?persona=`, `/graph/search?q=`.
5. APScheduler graph reload; `/sources` reports graph freshness.
6. Tests: multi-persona → one WCC; **decoy → different WCC**; Splink recall >= 0.9 at 0.5.

**Note carried from Phase 3:** the rebrand pair shares a wallet *lineage edge*, not an address,
so WCC over hard identifiers must **not** merge it — that pair is reserved for Phase 5/7 to solve
on style and timing. The decoy must likewise stay separate. Both are the real tests of objective 6.

---

## Next phase — 5: STYLOMETRY & BEHAVIOUR

Authorship verification, counter-deception, rebrand detection.

**Prerequisites from Phase 4:** personas resolved into actors with per-persona post corpora
available, and the decoy and rebrand pairs surfaced as candidates for scoring.

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
| Splink P/R | pending — Phase 4 |
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
