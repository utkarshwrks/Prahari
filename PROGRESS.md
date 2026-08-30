# PROGRESS

The single source of truth for project status. Updated at the end of every phase.

---

## Last phase — 1: SYNC — 30 August 2026 — automated + manual layers PASS

Absorbed PRAHARI v1, audited it against the v2 blueprint, and established the operating contract.
Nothing behavioural was built or changed.

**Shipped**

- `docs/AUDIT_V1.md` — all 65 modules across `lib/`, `store/`, `app/api/`, `components/dashboard/` with
  line counts, responsibility, and keep/modify/retire disposition. Six load-bearing invariants
  **verified against source**, not assumed. Six findings recorded, three of which correct the playbook.
- `docs/ARCHITECTURE.md` — six-stage pipeline, repo layout, trust boundary, v1 + v2 data contracts,
  the confidence model with the worked 0.84 example, the audit chain, and the degradation contract.
- `docs/DECISIONS.md` — DEC-001…DEC-012, including three ambiguity resolutions that would otherwise
  have surfaced mid-phase under deadline (DEC-003 noisy-OR, DEC-009 users, DEC-012 Python pin).
- `docs/DEMO.md` — seven-step script with a per-step time budget and the offline story.
- `docs/METRICS.md` — every metric defined, all tables scaffolded empty, fusion example filled.
- `docs/TESTLOG.md` — the D1 contract, Phase 1 logged.
- `__tests__/cities.test.ts` (17 tests), `__tests__/extractor.test.ts` (28 tests), `vitest.config.ts`,
  `npm test`. **45/45 passing.**
- Emoji removed from `README.md` and `HACKATHON_QA.md`; six decorative glyphs in rendered UI replaced
  with lucide icons per DEC-002.
- `README.md` rewritten top section: v2 in ten lines, three USPs, Feature Status table (FR-01…FR-45).

**Tests passing**

| Command | Result |
|---|---|
| `npm test` | 45 passed (2 files) |
| `npm run build` | clean, 12/12 static pages, no type errors |
| emoji grep `[\x{1F300}-\x{1FAFF}]` | 0 files |
| DEC-002 widened glyph grep over source | 0 glyphs-as-icons (6 permitted `→` in comments/prose) |

**Three corrections to the playbook, found by audit**

1. **DEC-003 — the naive-stack baseline is noisy-OR.** Phase 7 mandates a 0.999 naive figure. LR-product
   gives 0.9963 and would have failed that test; `1 − Π(1−sᵢ)` gives 0.999126. Fixed before it cost a day.
2. **FINDING-01 — the "emojis in entity chips" debt item is stale.** `EntityChips.tsx` was already
   lucide-only. The real emoji were in the two docs; source instead had `✓ ⚠ ↳`, which the playbook's own
   grep range does not match. Resolved by DEC-002 so Phase 1 and Phase 11 test the same rule.
3. **FINDING-02 — there are two `document.write` sites, not one.** `RecordsModal.tsx:400` (named in the
   playbook) and `AlertLog.tsx:62` (not named). Phase 9 obj 6 must cover both.

---

## Current phase — 2: FOUNDATION — not started

Monorepo restructure, containers, engine skeleton, three-way mode toggle. Platform rails only, no
intelligence.

**Objectives**

1. Restructure to the A3 layout: v1 app → `web/`, every `@/` import path still resolving, `npm run dev`
   working from the repo root. Move `__tests__/` → `web/__tests__/` in the same commit (DEC-008).
2. `docker-compose.yml`: Neo4j Community + GDS plugin, PostgreSQL 16 + pgvector, volumes, healthchecks.
3. `engine/`: FastAPI, `pyproject.toml` **pinned to Python >=3.11,<3.13** (DEC-012), uvicorn entry,
   structured logging, `/health`, `/version`, CORS for `localhost:3000`, `pydantic-settings` with every
   key optional and honest degradation when absent.
4. SQLAlchemy models + Alembic migration: `personas`, `posts`, `entities`, `signals`, `pair_scores`,
   `cases`, `audit_records`, `seals`, `sources`. Users move behind the engine proxy with a local
   fallback, signatures unchanged (DEC-009).
5. `web/app/api/engine/[...path]/route.ts` — server-side proxy so no engine URL or key reaches the browser.
6. `HeaderControls.tsx`: DEMO toggle → three-way `DEMO · DATASET · LIVE`. `store/intel.ts` `tick()` gains
   a third branch calling `GET /api/engine/feed` (empty list for now). Mode-switch semantics identical to
   v1's `setDemoMode()`.
7. APScheduler with one no-op job, plus `/sources` returning `last_scan`, `freshness_s`, `items_24h`.
8. GitHub Actions CI (DEC-010) — no later phase creates it, and Phases 8 and 11 both assume it exists.
9. Tests: pytest for `/health`, settings degradation, migration up/down; web test for the three-way toggle.

**Prerequisites not yet met on this machine**

- **Docker is not installed.** Blocks objectives 2 and 4.
- Python 3.14.7 is the system default; `uv` is available. Objective 3 must pin 3.11/3.12 (DEC-012).

---

## Next phase — 3: DATA

Real public datasets, ground-truth testbed, deep extraction.

**Prerequisites from Phase 2:** Postgres reachable with the `personas`/`posts` tables migrated; the
engine's `/feed` and `/extract` endpoints stubbed and reachable through the web proxy; DATASET mode
wired to `/api/engine/feed` and showing an honest empty state.

---

## Blockers

| # | Blocker | Blocks | Status |
|---|---|---|---|
| B-01 | Docker not installed on the build machine | Phase 2 obj 2, 4 | Open — install Docker Desktop before starting Phase 2 |
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
