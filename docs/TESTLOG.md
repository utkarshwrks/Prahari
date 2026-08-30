# TESTLOG

Every phase has three test layers — Automated, Manual, Claude-driven. A phase closes only on **PASS**
in all three. Format per the playbook D1 contract.

---

## Phase 1 — SYNC — 30 August 2026

### Automated

| Command | Result | Count |
|---|---|---|
| `npm test` | **PASS** | 45 passed, 0 failed (2 files) |
| `npm run build` | **PASS** | clean, 12/12 static pages, no type errors, middleware 49.1 kB |
| `grep -rnP "[\x{1F300}-\x{1FAFF}]"` over `*.ts *.tsx *.md *.css` | **PASS** | 0 files |
| DEC-002 widened glyph grep over `app components lib store types` | **PASS** | 0 glyphs-as-icons; 6 permitted `→` in comments/prose/error strings |

Breakdown of `npm test`:

```
✓ __tests__/cities.test.ts     (17 tests)
✓ __tests__/extractor.test.ts  (28 tests)
  Test Files  2 passed (2)
       Tests  45 passed (45)
```

`cities.test.ts` covers: exact `ZONE_CITIES` set equality; zone/other partition with no overlap;
Katni 83.4 km < 95; Sagar 146.8 km > 95; Narsinghpur 85.3 km with its margin asserted > 5 km;
haversine symmetry and self-distance; breach predicate over every city, case-insensitive, non-throwing
on unknown input; **INV-2 — the national gazetteer can never trigger a breach** (six cities checked);
core ring strictly tighter than the zone ring; gazetteer uniqueness and MP coordinate bounds.

`extractor.test.ts` covers: BTC bech32 / legacy P2PKH / ETH extraction, plus negative cases (short hex,
wrong-length ETH, invalid base58); dedup; contraband substring suppression in both directions
(`pistol parts` suppresses `pistol`, but bare `aadhaar` still reports when alone); word-boundary city
matching (`Katnipur` must not match `Katni`); handle extraction; total-function behaviour on empty,
whitespace, regex-hostile and 10k-character input; **INV-3 — `analyze()` never throws, and reports the
engine that actually ran** including the invalid-key fallback path.

### Manual

**Run by the phase author, not an independent tester** — the second-person rule was waived. Recorded here honestly: this satisfies the checklist mechanically but **not** the
independence intent of the D1 contract. Executed headless via Playwright at 1440x900 against
`npm run dev`, 30 August 2026.

- [x] **`docs/AUDIT_V1.md` covers every file** — 7 spot-checked line counts all MATCH (cities 85,
      intel 417, MapView 235, live-intel 221, EntityChips 68, mockIntel 215, RecordsModal 433). An
      automated sweep of all four directories found **0 files missing** from the audit.
- [x] **`docs/ARCHITECTURE.md` matches the six stages** — Collect, Extract, Four Engines, Evidence
      Fusion, Geo-attribution, Workbench all present and in order.
- [x] **`PROGRESS.md` shows Phase 2 as Current** — `## Current phase — 2: FOUNDATION — not started`.
- [x] **`npm test` passes and asserts the right thing** — 45/45. Read `cities.test.ts` directly:
      `expect(km("Katni")).toBeLessThan(GEOFENCE_ZONE_KM)` at :41 and
      `expect(km("Sagar")).toBeGreaterThan(GEOFENCE_ZONE_KM)` at :46.
- [x] **No emoji or banned glyph in the UI at 1440 px** — programmatic sweep of *rendered, visible* text
      nodes only (script/style/hidden excluded) across five surfaces: landing (151 nodes), `/login`
      (19), `/dashboard` populated (111), IntelDetailModal open (207), notification drawer (265).
      **753 text nodes, 0 hits** against `[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}]` plus
      `✓ ✔ ✗ ✘ ⚠ ↳ ←`.
- [x] **v1 demo journey still fires breaches** — see the correction below.

**All six edited glyph sites confirmed rendering a lucide icon, not a character:**

| Site | Evidence |
|---|---|
| `BreachToaster` | Toast reads `GEOFENCE BREACH / JABALPUR / 22:52:48 · in-zone jurisdiction hit`, no `⚠`, renders `class="lucide lucide-triangle-alert ... animate-pulse text-red-bright"` |
| `IntelDetailModal` in-zone banner | Banner shown, no `⚠`, 2x `svg.lucide-triangle-alert` present |
| `IntelDetailModal` / `NotificationCenter` case toast | `"Case CASE-31O87-4L created"`, no `✓`, `lucide lucide-check` present |
| `WalletTracker` | `"Wallet copied"`, no `✓`, `lucide lucide-check` present (needs clipboard permission to fire) |
| `LiveNERAnalyzer`, `AuthShell` | Covered by the dashboard and `/login` sweeps — 0 banned glyphs |

**Correction to the checklist item on demo timing.** The playbook's check — "Jabalpur breach at ~6 s,
Katni at ~15 s" — cannot be verified by watching the breach counter, because `generateIntercept()` also
picks a zone city at random ~32% of the time. Breaches therefore occur *in addition to* the two forced
ones, and a first observed breach at 4.3 s is correct behaviour, not a regression. What was verified
instead:

- breaches fire during the run (first at 4.3 s; 6 by the 20 s mark)
- the counter increments progressively (`0 → 2 → 4 → 5 → 6`), proving a live stream rather than one burst
- threat level reaches **CRITICAL**
- the forced timers themselves are unchanged in source (`store/intel.ts:340-341`, 6000 ms / 15000 ms)

A deterministic assertion on the two forced breaches needs a seeded generator; logged as a Phase 9
Playwright-suite item rather than faked here.

### Claude

**Not yet run.** D3.1 with N = 1, in a fresh session with repo access, Part A pasted first.
Must return PASS.

### Verdict

**PASS — automated and manual layers green. Claude independent review outstanding.**

Every acceptance criterion is objectively met: six docs exist and are cross-consistent, `npm test`
(45/45) and `npm run build` pass, both emoji greps are clean, `PROGRESS.md` names Phase 2 as Current,
and the running UI at 1440 px contains zero banned glyphs across 753 rendered text nodes with all six
edited sites confirmed on lucide icons.

**Caveat recorded, not hidden:** the manual layer was executed by the phase author rather than an
independent tester, and the D3.1 Claude review has not been run. The D1 contract asks for both to be
independent of the author. The project owner accepted this trade to keep moving. Nothing is claimed as
verified that was not actually executed, and one checklist item was corrected rather than forced to
pass (see the demo-timing note above).

Phase 1 is **functionally complete and safe to build on**. Phase 2 may begin.

### Notes carried forward

- Three playbook corrections found by audit — DEC-003 (naive baseline is noisy-OR, not LR-product),
  FINDING-01 (stale emoji debt item), FINDING-02 (two `document.write` sites, not one). All recorded.
- Four open blockers (B-01 Docker, B-02 Foundry, B-03 Shodan free tier, B-04 manual dataset downloads).
  None resolved by substituting a paid service.

---

## Phase 2 — FOUNDATION — 30 August 2026

### Automated

| Command | Result | Count |
|---|---|---|
| `npm test` | **PASS** | 56 passed (3 files) — 45 v1 + 11 mode |
| `npm run build` | **PASS** | clean, `/api/engine/[...path]` route present |
| `uv run pytest` | **PASS** | 26 passed |
| `alembic upgrade / downgrade / upgrade` | **PASS** | 10 tables, 0 enums left behind, sources reseeded |
| CI guardrails (5 jobs) | **PASS** | emoji, glyphs, `.onion`, secrets, product name — all run locally |

### Manual (author-run, same caveat as Phase 1)

- [x] `docker compose up` brings Neo4j (7474) and Postgres up — **both healthy in 24 s** (budget 60 s)
- [x] GDS verified usable: `gds.wcc.stream`, `gds.louvain.stream`, `gds.fastRP.stream` all present;
      GDS 2.13.12. pgvector 0.8.6 with a working L2 distance operator.
- [x] `uvicorn engine.main:app` starts with **no `.env`**; `/health` and `/version` return JSON
- [x] `npm run dev` from the repo root; `/login` 200; header shows `DEMO · DATASET · LIVE`
- [x] All six mode transitions preserve v1 semantics — feed and map clear, counters and alert log
      persist (11 unit tests, including the no-op case of re-selecting the active mode)
- [x] DATASET mode shows an honest empty state, not an error:
      `"No dataset loaded. Phase 3 ingests the Agora and DNM archives."`
- [x] `/sources` returns 9 seeded rows with `last_scan`, `freshness_s`, `items_24h`, plus `key_present`
- [x] APScheduler heartbeat visible in `/health` (`running: true`, ticks incrementing)
- [x] **Engine killed → workbench survives.** `/login` 200, `/api/live-intel` 200, `/api/analyze` 200,
      and `/api/engine/feed` returns HTTP 200 with
      `{ok: false, engine: "offline", detail: "Engine unreachable. DEMO and LIVE modes are unaffected."}`

**Trust boundary verified.** Scanned the built client bundles for `ENGINE_URL`, `localhost:8000`,
`gsk_`, `NEXTAUTH_SECRET` — **zero hits**. The proxy's route allowlist rejects unlisted paths
(`/api/engine/openapi.json` and `/api/engine/admin` both 404). One grep hit on `prahari123` was traced
to the demo password intentionally displayed on the login page (v1 behaviour), not a leak.

### Claude

**Not run.** D3.1 with N = 2 plus the devtools-leak probe, in a fresh session.

### Verdict

**PASS — automated and manual layers green. Claude independent review outstanding.**

Every Phase 2 acceptance criterion met: `docker compose up`, `uvicorn` and `npm run dev` all start from
a clean state with no `.env`; the v1 demo journey is behaviourally untouched; `/sources` returns JSON;
all tests pass.

### Defect found and fixed

**DEC-016 (Major)** — Postgres ENUM not dropped on downgrade, making the migration non-reversible.
Found by the up/down/up test, not by review. Fresh clones worked; rebuilds failed with
`DuplicateObject`. Fixed, and guarded by `test_up_down_up_is_clean`.

---

## Phase 3 — DATA — 31 August 2026

### Automated

| Command | Result | Count |
|---|---|---|
| `npm test` | **PASS** | 56 passed |
| `npm run build` | **PASS** | clean |
| `uv run pytest` | **PASS** | **92 passed** (26 → 92) |
| Extraction P/R, 30 labelled sentences | **PASS** | EN R=1.000, HI R=1.000 (thresholds 0.85 / 0.70) |
| Testbed determinism | **PASS** | same seed → identical digest; different seed differs |
| Blocklist | **PASS** | 1,832 / 109,689 bodies dropped (1.67%), count asserted |

### Manual (author-run)

- [x] Loader run against the real 32 MB Agora CSV: 109,689 rows, **0 skipped**, 3,192 personas
- [x] 1,000-row **real** fixture committed — verified genuine by header check, not fabricated
- [x] DATASET mode streams real listings with entities; three opened and confirmed category-level
- [x] Hinglish sentence through the analyzer — `jbp` and `katni` both resolve, engine badge correct
- [x] PGP block → fingerprint computed via `pgpy` (not guessed)
- [x] Testbed generated twice with the same seed → identical label digest
- [x] Blocked how-to strings are dropped and the counter increments
- [x] `docs/METRICS.md` extraction table filled; **0 pending cells remain**
- [x] End-to-end through the proxy: `/feed` 1,000 items, `/extract` resolves `jbp` → Jabalpur
- [x] Engine killed → workbench fully alive, DATASET degrades honestly

### Claude

**Not run.** D3.1 with N = 3, plus the fixture/PII sweep, in a fresh session.

### Verdict

**PASS — automated and manual layers green. Independent review outstanding.**

### Defects found and fixed during the phase

| ID | Severity | Finding |
|---|---|---|
| **FINDING-07** | Major | Fixed. `jbp` now resolves to Jabalpur; the geofence sees what the model found. 43 aliases, region terms explicitly refused. |
| — | Major | **Testbed was too small to calibrate.** First run produced 21 positive pairs; Phase 7 conformal prediction at α=0.05 would have had ~10 in validation — statistically meaningless. Resized to 159 positives with a capped 20:1 ratio. |
| — | Major | **Rebrand case was trivially solvable.** The pair shared an identical wallet address, so Phase 4's hard-identifier WCC would have merged it, proving nothing about style or timing. Changed to distinct addresses joined by a lineage (transfer) edge. |
| — | Minor | `vendor@proton.test` yielded a spurious `@proton` handle, which would have become a false `social` edge. Handles are now matched on email- and telegram-masked text. |

### Honest note on the reported 1.000 extraction scores

The 30 labelled sentences and the alias table were authored together, so those figures are a
**regression guard, not a generalisation estimate**. An independent probe using surface forms
deliberately absent from the alias table scores **7/10**; all three misses are unseen misspellings
and **none is a false positive**. Matching is exact-alias by design — a fabricated city
manufactures a breach that never happened, which for a police tool is worse than missing one.
Both directions are pinned (`test_never_invents_a_city`, `test_known_limit_unseen_typos_are_missed`).

---

## Phase 4 — IDENTITY GRAPH — 31 August 2026

### Automated

| Command | Result | Count |
|---|---|---|
| `uv run pytest` | **PASS** | **114 passed** (92 → 114) |
| `npm test` | **PASS** | 56 passed |
| `npm run build` | **PASS** | clean |
| Graph tests | **PASS** | 12 — idempotent MERGE, WCC, decoy, rebrand, false merges |
| Linkage tests | **PASS** | 10 — measured m/u, precision, decoy score, coverage |

### Manual (author-run)

- [x] `/graph/stats` — 244 personas, 372 entities, 518 edges, 140 actors, 244 embeddings
- [x] Multi-persona actors share one actor id — **130 / 130**
- [x] **Decoy is in a different actor from its target**, despite identical bio and matching style
- [x] `/graph/candidates?persona=decoy` **lists the target** (blocking works) at
      `match_probability = 0.001022` — well under the 0.5 the playbook requires
- [x] `/graph/search` returns in well under 1 s
- [x] Loading twice leaves node, entity and edge counts unchanged (idempotent `MERGE`)
- [x] Graph reload job registered on the scheduler; skips cleanly when Neo4j is down

### Claude

**Not run.** D3.1 with N = 4, plus the exchange-deposit-address adversarial probe.

### Verdict

**PASS on every acceptance criterion except Splink recall, which is 0.818 against a target of 0.9 —
documented as a structural ceiling in DEC-021, not waived.**

Precision is 1.000 with zero false positives, and Splink finds **130 of the 130 pairs that share any
hard identifier**. The 29 it misses share no PGP, wallet or email and are unreachable by record
linkage in principle. They are Phase 5 and 7's work.

### Defects found and fixed

| ID | Severity | Finding |
|---|---|---|
| **DEC-020** | Critical | `estimate_u_using_random_sampling` reported u(pgp) = 0.0053 when the measured value is 0 — it sampled the 130 true PGP-sharing pairs it was supposed to exclude. A near-conclusive identifier became a Bayes factor of 187 and recall collapsed to 0.11. Now measured from ground truth with Laplace smoothing (BF 38,519). |
| — | Critical | Calling `estimate_m_from_label_column` **after** setting explicit measured m/u silently overwrote them. A pair sharing a PGP key landed in the "all other" level and scored 0.36 at `match_weight = -0.8` — the strongest identifier in the system read as evidence *against* the match. Invisible except as bad recall. |
| — | Major | Splink's default prior (0.0001) is 54× below this testbed's true rate (159 / 29,646 = 0.0054), crushing every posterior. Now computed from the labels. |
| — | Major | The decoy was never proposed as a candidate, so the system never got the chance to reject it on evidence. Added `block_on("bio")`: a verbatim copied bio is a reason to *look*, and the different PGP and wallet are what argue it down. |
