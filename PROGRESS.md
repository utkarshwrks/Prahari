# PROGRESS

The single source of truth for project status. Updated at the end of every phase.

---

## Last phase — 2: FOUNDATION — 30 August 2026 — automated layer PASS

Rails only, no intelligence. The v1 workbench is untouched behaviourally.

**Shipped**

- **Monorepo** — v1 app moved to `web/`, root npm workspace, `@/*` paths intact. Every route and all
  45 v1 tests survived the move unchanged.
- **Containers** — `docker-compose.yml` with Neo4j 5 Community + GDS and Postgres 16 + pgvector, both
  native arm64. Verified `gds.wcc`/`gds.louvain`/`gds.fastRP` are present (what Phase 4 needs) and
  pgvector's L2 operator works. Cold start to both-healthy: **24 s** (budget 60 s).
- **Engine** — FastAPI on Python 3.12 (DEC-012). Settings with every key optional and a `capabilities()`
  matrix that says what is disabled and why; structured JSON logging; pooled DB access with
  `pool_pre_ping`; APScheduler heartbeat; `GET /health /version /feed /sources`; JSON 500 handler.
- **Schema** — the nine ARCHITECTURE tables plus `users`, reversible migration, pgvector extension,
  9-row source inventory seeded.
- **Proxy** — `web/app/api/engine/[...path]/route.ts` with a route allowlist. `ENGINE_URL` is not
  `NEXT_PUBLIC_`, so it cannot be inlined into a client bundle.
- **Three-way mode** — `DEMO · DATASET · LIVE` replacing the boolean toggle, with v1's `setDemoMode`
  clearing semantics preserved on all six transitions.
- **CI** — GitHub Actions (DEC-010): web, engine, and five guardrail jobs (emoji, decorative glyphs,
  `.onion`, committed secrets, product name). All five verified locally before commit.

**Tests passing**

| Command | Result |
|---|---|
| `npm test` | **56 passed** (3 files) — 45 v1 + 11 new mode tests |
| `npm run build` | clean, `/api/engine/[...path]` present |
| `uv run pytest` | **26 passed** |
| migrations up/down/up | clean, 10 tables, 0 enums left behind |
| engine boot, no `.env` | `/health` 200, scheduler running |
| **engine killed** | `/login` 200, LIVE 200, NER 200, DATASET degrades at HTTP 200 |
| client bundle leak scan | no `ENGINE_URL`, no key, no `localhost:8000` |

**One real bug found and fixed (DEC-016)**

The migration up/down/up test caught it: Postgres ENUMs are schema objects, not table-scoped, so
`drop_table` left `signal_root` behind and the *next* upgrade died with `DuplicateObject`. Every fresh
clone would have worked and every rebuild would have broken — the worst possible failure shape for a
demo. Fixed and regression-guarded.

---

## Current phase — 3: DATA — not started

Real public datasets, ground-truth testbed, deep extraction.

**Objectives**

1. `engine/ingest/dnm_archives.py` and `kaggle_agora.py` normalising to `Post`/`Persona`; blocklist that
   strips step-by-step content and logs the drop count.
2. `engine/ingest/osint.py` — port v1's three adapters to Python, same shapes, same 20 s cache.
3. `engine/ingest/chain.py` — mempool.space and Etherscan adapters with Postgres caching.
4. `engine/testbed/generate.py` — fixed-seed synthetic ground truth with the four labelled cases
   (multi-persona, rebrand, infra leak, decoy) and `labels.parquet`.
5. `engine/extract/` — port `extractor.ts`, add PGP fingerprints via `pgpy`, onion v3, XMR, spaCy
   `EntityRuler`, optional MuRIL for Hinglish, honest `source` badge.
6. `/feed` streams real DATASET items; `/extract` mirrors `/api/analyze`.
7. Tests: loaders on fixtures, extraction P/R on 30 hand-labelled sentences, testbed determinism.

**Carried in from Phase 1 — must be addressed here**

**FINDING-07** — Groq returns city names the gazetteer cannot resolve (`"jbp"` for Jabalpur), so
`registerCities()` silently drops a correctly-identified in-zone mention. Phase 3 needs a normalisation
layer between extraction and the gazetteer, and the METRICS extraction table must measure recall
**after** normalisation.

---

## Next phase — 4: IDENTITY GRAPH

Splink blocking and Neo4j GDS resolution.

**Prerequisites from Phase 3:** personas and posts loaded in Postgres with entities extracted; the
`entities` table populated and keyed so personas can be blocked across markets.

---

## Blockers

| # | Blocker | Blocks | Status |
|---|---|---|---|
| B-01 | Docker not installed | Phase 2 obj 2, 4 | **RESOLVED** 30 Aug — Docker 29.7.2, both images arm64-native, cold start 24 s |
| B-02 | Foundry (`forge`, `anvil`) not installed | Phase 8 | Open — not yet needed, install before Phase 8 |
| B-03 | Shodan free tier may not include host-lookup API credits | Phase 6 obj 1 | Open — **validate in the first hour of Phase 6**. Mitigation already in the design: crt.sh carries the 0.95/0.85 rules and Shodan degrades to cache-only. Not a free/open-source rule violation, just an unverified capacity assumption. |
| B-04 | Gwern DNM Archives + Kaggle Agora need manual download (free accounts) | Phase 3 | Open — by design. 1,000-row fixtures are committed so the demo never depends on the full download. |

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
| Extraction P/R | pending — Phase 3 |
| Splink P/R | pending — Phase 4 |
| **Fusion worked example** | **0.8395 → 0.84** (verified Phase 1) |
| **Naive noisy-OR baseline** | **0.9991 → 0.999** (verified Phase 1) |

---

## Demo status

Which of the seven `docs/DEMO.md` steps run end-to-end today.

| Step | State |
|---|---|
| 1. Geofence on the map (DEMO mode) | **works** — v1, breaches at ~6 s and ~15 s |
| 2a. DATASET mode wiring | **works** — toggle, proxy and honest empty state; data lands in Phase 3 |
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
