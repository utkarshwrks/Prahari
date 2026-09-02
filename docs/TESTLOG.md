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

---

## Phase 5 — STYLOMETRY & BEHAVIOUR — 31 August 2026

### Automated

| Command | Result | Count |
|---|---|---|
| `uv run pytest` | **PASS** | **139 passed** (114 → 139) |
| `npm test` | **PASS** | 56 passed |
| `npm run build` | **PASS** | clean |
| Stylometry tests | **PASS** | 25 |

### Manual (author-run)

- [x] `/style/compare` on a true pair scores higher than on unrelated pairs (0.594 vs 0.531)
- [x] **Decoy response contains `mimicry_suspected`** and is capped at 0.200, while its raw
      char-n-gram similarity is 0.827 — the cap is recognition of imitation, not blindness to it
- [x] **Decoy (0.200) < rebrand (0.843)** — the inversion relative to Phase 4
- [x] `/rebrand/candidates` lists the testbed case at rank 1 with the correct death (2026-02-10) and
      birth (2026-02-15) dates, gap 5 days, wallet lineage true
- [x] LLM-rewrite detector validated against genuinely flattened text (burstiness 0.000 → flagged)
      while genuine personas are not (4.5% false positive rate)
- [x] Endpoints degrade to classic features when no model is available; badge reports `classic`
- [x] `/style/profile` reports Hinglish ratio, honorific rate and burstiness

### Claude

**Not run.** D3.1 with N = 5, plus the adversarial "copy formatting only" probe.

### Verdict

**PASS — automated and manual layers green. Independent review outstanding.**

### Defects found and fixed

| ID | Severity | Finding |
|---|---|---|
| **DEC-025** | **Critical** | Mimicry was measured over the full post corpus instead of bios. The decoy's verbatim-copied bio was one line in thirteen and diluted below threshold, so the decoy scored **s_style 0.914 — higher than genuine pairs — with no flag raised**. The most important negative case in the testbed was passing as the strongest positive. Fixed by profiling bios separately; k drops to 3 shingles for short texts. |
| **DEC-024** | Major | The LLM-rewrite detector used an absolute burstiness threshold that fired on **206 of 244 personas (84%)** — templated text is inherently flat, which says nothing about machine rewriting. Now relative to the corpus's 5th percentile, and abstains entirely without a reference corpus. False positives 84% → 4.5%. |
| **DEC-023** | — | Siamese char-CNN cut per the playbook's documented fallback, for reasons beyond the time budget: 244 personas of templated text would train it to memorise the generator, and a network cannot publish coefficients. Logistic model: AUC 0.7976. |

### Note on the reported separation

Mean `s_style` separation is **+0.0628** (true 0.594 vs unrelated 0.531) — positive, as required, but
narrow. That is expected and correct: the testbed generates from a small template vocabulary, so all
personas read somewhat alike, and stylometry is the weakest evidence in the system by design. It
carries reliability 0.5 in fusion, half a PGP key's. The number to trust here is not the separation
but the **direction of the two cases**: decoy 0.200 against rebrand 0.843.

---

## Phase 6 — INFRASTRUCTURE FINGERPRINTING — 31 August 2026

### Automated

| Command | Result | Count |
|---|---|---|
| `uv run pytest` | **PASS** | **165 passed** (139 → 165) |
| `npm test` | **PASS** | 57 passed |
| `npm run build` | **PASS** | clean |
| Infra tests | **PASS** | 26, of which 7 are passivity assertions |

### Manual (author-run)

- [x] `/infra/pivot` on the testbed onion resolves to the planted domain with the cert-reuse evidence
      line, strength **0.95**
- [x] **Live CT lookup on a real public domain** (`iitb.ac.in`) returns **100 certificates** in the
      workbench — the adapter is real, not a fixture
- [x] Shodan works with **no key at all**; ports, hostnames and CPEs returned (B-03 closed)
- [x] Repeating a pivot serves from cache — hit rate **0.50** after two calls
- [x] `/infra/certificates?domain=…onion` is **refused outright**, not attempted
- [x] Confirmed from the code path and a socket spy that **no request ever went to a `.onion` host`**

### Claude

**Not run.** D3.1 with N = 6, plus the outbound-URL review.

### Verdict

**PASS on every acceptance criterion.**

### Passivity — how it is enforced, not asserted

Seven tests, because this claim is the project's legal basis rather than a feature:

1. `assert_not_onion()` rejects `.onion` in every casing, with credentials, ports and paths
2. public indexes are allowed (over-blocking would also be a bug)
3. `onion.example.com` — a clearnet host — is correctly **not** blocked
4. static sweep: no `.onion` URL literal exists in the engine source
5. **network-layer**: `socket.getaddrinfo` is monkeypatched during a full pivot; **zero `.onion`
   resolutions attempted**
6. JARM refuses any host not explicitly owned (DEC-028)
7. `match()` can never return a `.onion` as a clearnet result, even if one is fed in as a candidate

### Findings

| ID | Severity | Finding |
|---|---|---|
| **DEC-026** | — | **B-03 closed, better than assumed.** Shodan needs no key: `internetdb.shodan.io` is free and unauthenticated. `SHODAN_API_KEY` removed from the critical path — one fewer key for an on-prem deployment. |
| **DEC-027** | Major | **crt.sh was DOWN: 0 of 5 attempts, all HTTP 502.** It carries the two strongest infra rules. Had the demo been built on it alone, the strongest evidence path would fail whenever crt.sh has a bad day. certspotter (free, keyless) is now primary with crt.sh as failover, and the response names which source answered. |
| **DEC-028** | — | JARM actively probes TLS, so it runs only against hosts we control. The testbed leak resolves from planted metadata, keeping live probes off the demo's critical path entirely. |

---

## Phase 7 — EVIDENCE FUSION — 31 August 2026

### Automated

| Command | Result | Count |
|---|---|---|
| `uv run pytest` | **PASS** | **201 passed** (165 → 201) |
| `npm test` | **PASS** | 57 passed |
| Fusion tests | **PASS** | 36 |

### Acceptance criteria

| Criterion | Required | Measured |
|---|---|---|
| Deck example | 0.84 ± 0.01 | **0.839543** ✔ |
| Naive baseline (noisy-OR) | 0.999 ± 0.001 | **0.999126** ✔ |
| Decoy | ≤ 0.30 with negative listed | **0.000803**, `mimicry_suspected` ✔ |
| `/fusion/threshold?alpha=0.05` | returns τ and count | τ **0.029851**, 93 links ✔ |
| Trail reproduces `p_raw` | exactly | **yes**, all 300 sampled pairs ✔ |

### Adversarial (D3.2) probes, run as tests

1. **Same fact under two names** — three `infra` signals at s=0.83 collapse to exactly the
   one-signal score. No double-counting.
2. **Weak linguistic ceiling** — style alone at s=0.95 cannot exceed 0.75.
3. **No invalid probability** — s ∈ {0, 1, 1e-12, 1−1e-12}, six roots at 0.999: always in (0,1),
   never NaN, never 1.0.
4. **Decoy above 0.30** — impossible; `mimicry_suspected` caps at 0.30 and it lands at 0.0008.
5. **Recomputed false-merge rate at each α** — bound holds at 0.01 / 0.02 / 0.05 / 0.10 / 0.20.

### Verdict

**PASS on every acceptance criterion.**

### Defects found and fixed

| ID | Severity | Finding |
|---|---|---|
| **DEC-029** | **Critical** | **The conformal guarantee did not hold.** Isotonic outputs are piecewise constant; the quantile landed inside a tie block and admitted all of it. Measured false-merge rate **25.2% while the API reported a 5% guarantee**. τ now walks to the next distinct value until the bound genuinely holds, and returns `guarantee_holds: false` when none can. |
| **DEC-031** | **Critical** | **The rebrand pair was unfindable by construction.** Deriving "candidate" from Splink blocking alone gave it the 1:10,000 unblocked prior, crushing it to **0.0003** — in the one case built specifically to be findable without a hard identifier. Now **0.2335**. |
| **DEC-030** | Major | **The trail did not reproduce the score.** Factors published at 6 dp recomputed to 0.925596 against a `p_raw` of 0.925597. One digit, but reproducibility is the entire claim. Factors now at 12 dp. |
| **DEC-032** | Major | `/fusion/threshold` computed τ on raw scores while `/fusion/pair` reported calibrated ones — two endpoints, two scales. |

### Stated limitation

Isotonic collapses this testbed's scores into few distinct steps, so τ has coarse resolution:
α = 0.05 and α = 0.10 share a τ, and α = 0.01 is only honourable by accepting the 52 pairs scored at
1.0. That is a limit of 1,336 validation pairs, not a defect, and Phase 9's threshold slider must not
imply finer control than the data supports.

---

## Phase 8 — IMMUTABLE AUDIT — 31 August 2026

### Automated

| Command | Result | Count |
|---|---|---|
| `uv run pytest` | **PASS** | **233 passed** (201 → 233) |
| `forge test` | **PASS** | **12 passed**, 0 failed |
| `npm test` | **PASS** | 57 passed |
| Audit tests | **PASS** | 32, of which 7 are D3.3 attacks |

### Manual (author-run) — the full demo flow against a live Anvil chain

- [x] Confirm a link → ledger shows the record with `prev_hash` and a valid Ed25519 signature
- [x] Seal → tx `0x27e5418…`, **block 3, gas 95,232**, chain id 31337
- [x] Export JSON, CSV, PDF — each carries `merkle_root`, `tx_hash`, `chain_id`
- [x] Edit one field in the exported JSON → **RED at failing index 2**, "content was altered"
- [x] Restore → **GREEN**
- [x] Single-record inclusion proof (3 siblings) → **GREEN**; altered proof → **RED**
- [x] `forge test` passes; a second `anchor()` with the same root **reverts**
- [x] **Wi-Fi-independent:** the whole flow ran against local Anvil with a visible LOCAL CHAIN badge

### D3.3 — attacker with full database write access, without the analyst key

| # | Attack | Outcome |
|---|---|---|
| 1 | Modify an `audit_records` row in place | **detected at index 2** |
| 2 | Delete a middle record | **detected** — `seq` gap is itself evidence |
| 2b | Delete, relink `prev_hash` **and** renumber `seq` | **still detected** — the stored hash was computed over the original `prev_hash` |
| 3 | Re-sign with a different key | **detected** — key not registered to that analyst |
| 4 | Replay a valid seal from another case | **reverts on chain** (`AlreadyAnchored`) |
| 5 | Show a Sepolia explorer link for an Anvil tx | **impossible** — derived from the connected chain id, not config |

**Zero undetected attacks.**

### Verdict

**PASS on every acceptance criterion.**

### Findings

| ID | Severity | Finding |
|---|---|---|
| **DEC-033** | — | B-02 resolved. Foundry 1.8.1. Measured `anchor()` gas **95,232** against the playbook's ~70k estimate — the difference is the `Seal` struct carrying `caseRef` and `anchorer`, which makes the on-chain record self-describing. `docs/METRICS.md` records the measured figure, not the estimate. |
| **DEC-034** | **Critical (prevented)** | `explorer_url` is derived from the **connected** chain id, never from configuration. A Sepolia link on an Anvil transaction would be a fabricated evidence trail — worse than having no fallback. Enforced by parametrised tests over every local chain id. |
| **DEC-035** | Major (prevented) | Merkle **promotes** an odd node rather than duplicating it. Duplication is the CVE-2012-2459 shape, where two distinct leaf sets share a root — a forgery primitive in an evidence structure. |
| **DEC-036** | — | Verification names the **failing index**. "Invalid" is not a useful answer to a court. |
| **DEC-037** | — | Only 32-byte hashes on chain, and `caseRef` is itself `keccak256(case_id)` — even a case number is investigative metadata on a permanent public ledger. |
| **DEC-038** | **Critical** | **The exported Merkle root was not the root that had been anchored.** Sealing appended a `seal` record *after* anchoring, so the chain held the root over N records while the export published the root over N+1. A genuine, untampered export would have failed chain verification. **All 32 audit tests passed** — none of them sealed, exported, and compared the two roots. Found by running the demo flow end to end. Fixed by appending the seal-intent record before computing the anchored root; exports now also publish `sealed_root`, `sealed_root_matches_current` and `records_added_after_seal`. |

---

## Phase 9 — WORKBENCH UI — 31 August 2026

### Automated

| Command | Result | Count |
|---|---|---|
| `npm test` | **PASS** | **79 passed** (57 → 79) |
| `npm run build` | **PASS** | clean |
| `node e2e/journey.mjs` | **PASS** | **25/25** |
| `uv run pytest` | **PASS** | 235 |
| `forge test` | **PASS** | 12 |

### Playwright journey — 25 assertions through the real browser path

Login → dashboard → CRITICAL → evidence trail shows **0.840 against a naive 0.999** with the LR table
and named root causes → audit ledger with `prev` hash links and Merkle root → three-way mode toggle →
focus trap and Escape → reduced motion → 1440/1024/390 with zero horizontal overflow and no banned
glyphs → 44px touch targets on a touch device.

### Defects found and fixed

| ID | Severity | Finding |
|---|---|---|
| **DEC-039** | **Critical** | **FINDING-02 closed.** Both print paths interpolated analyst-authored fields into `document.write()`. Confirmed exploitable: a case title containing `<img src=x onerror=…>` executed on the officer's origin. Rewritten to build DOM nodes via `textContent` — escape by construction, with no escaping helper for a future call site to forget. |
| **DEC-042** | **Major** | **The focus trap was a no-op on every dialog.** `focusableWithin` filtered on `offsetParent !== null`, which is null for `position: fixed` — and every dialog here is fixed. Nine unit tests passed because happy-dom reports it differently from a real browser. Caught only by the journey. |
| **DEC-040** | Major | **FINDING-05 closed.** Motion gated behind `prefers-reduced-motion`, but information is not: sirens freeze at full extent rather than mid-frame. |
| **DEC-043** | Minor | 31 touch targets under 44px. Gated on `pointer: coarse` rather than viewport width. |

Two of my own tests were wrong before the code was: one matched the word `innerHTML` inside its own
documentation, another detached the opener before testing focus restoration. Both tightened.

### Verdict

**PASS on the criteria attempted. Scope cut recorded (DEC-044), not hidden.**

MapLibre GL, react-force-graph-3d, the d3 Sankey and the timeline scrubber are deferred as **roadmap**.
Leaflet works; tilt is presentation, not capability. Everything carrying the two USPs was built, and
the responsive, motion and accessibility contracts are verified at all three widths.

---

## Phase 11 — MASTER TESTING — 31 August 2026

Nothing was built in this phase. The system was attacked and had to hold.

### Objective 1 — Fresh-machine run

Cloned to a clean directory, installed following only `README.md`.

**This is where the gate earned its place. The first fresh clone FAILED.**

| Step | Result |
|---|---|
| Clone contents | no `.env.local`, no `node_modules`, no `.venv`, fixture present (1,001 rows) |
| First engine run | **26 failed, 15 errors — `ModuleNotFoundError`** |
| After manifest fix | **236/236 passed** |
| `npm run demo` | **12 s** (budget 180 s) |
| Seven demo steps | **7/7 correct** in 14 s |

### Objective 2 — Full suite on the fresh clone

| Suite | Result |
|---|---|
| `npm test` | **98 passed** |
| `npm run build` | clean *(after the second fix — see below)* |
| `uv run pytest` | **236 passed** |
| `forge test` | **12 passed** |
| Browser journey | **25 assertions** |

### Objective 4 — Metrics reproduction

Two consecutive `python -m engine.fusion.eval` runs produced **byte-identical** output. Every figure now
appears **verbatim at tool precision** in `docs/METRICS.md`, the landing page and `docs/DECK.md`:
`0.031348`, `0.029851`, `0.005333`, `0.005083`, `0.9381`.

The document previously rounded the false-merge rate to `0.0313`. A rounding is still a disagreement an
opposing expert can point at, so the document now carries what the tool emits.

### Objective 6 — Offline drill

Everything on the demo's critical path runs with no external network: DEMO geofence, DATASET feed
(committed fixture), fusion, graph, infra pivot (planted metadata), seal (local Anvil), verify.
Network-dependent paths (LIVE OSINT, live CT lookup) degrade and report, never error.

### Objective 7 — Failure drill

| Killed | Behaviour | Recovery |
|---|---|---|
| Postgres | engine up, `db:false`, fusion + audit unaffected | **healed, no restart** |
| Neo4j | graph unavailable with a reason, rest unaffected | **healed, no restart** |
| Chain | seal `UNAVAILABLE`, no explorer link, **ledger still verifies offline** | — |
| Engine | web fully alive, every engine route HTTP 200 + `engine: offline` | — |

Nothing returned 5xx at any point.

### Objective 9 — Security sweep: **11/11**

Production refuses to boot without `NEXTAUTH_SECRET` and refuses the dev default; demo account off in
production; RBAC enforced; both unauthenticated endpoints rate limited; exports escaped; no engine URL
or key in client bundles; only 32-byte hashes on chain; no outbound `.onion` possible; `.env.local`
untracked; no committed keys.

### Objective 10 — Global-rule sweep: **10/10**

Emoji grep empty; no decorative glyphs in rendered UI; product name is PRAHARI everywhere; no paid
service; manifests complete; no unresolved `planned` rows; roadmap items honestly marked; METRICS has
no pending cells; DECK lists claims to remove.

*(One initial "paid service" hit was my own grep matching "magnetic stripe" in the Agora dataset
fixture — real marketplace text, not a dependency.)*

### Defects found by the gate

| ID | Severity | Finding |
|---|---|---|
| **DEC-050** | **Major** | **The dependency manifest was incomplete.** Phases 3–8 installed 16 packages ad-hoc with `uv pip install`; they worked on the build machine and existed nowhere else. A fresh clone failed with `ModuleNotFoundError` on 26 tests — exactly what a judge's laptop and the CI runner would have seen. |
| **DEC-051** | **Major** | **The Phase 10 production guard broke `npm run build`.** `next build` runs with `NODE_ENV=production`, so the import-time secret check failed the build on any machine without a secret. A build authenticates nobody; a running server does. Build phase exempted via `NEXT_PHASE`; the runtime guard is unchanged and verified. |

### Objectives NOT completed, stated plainly

- **Objective 5 — manual checklists by two teammates who did not write the phase.** Not done. Every
  manual layer in this log was author-run. That satisfies the checklist mechanically and **not** the
  independence intent.
- **Objective 8 — Claude master review** (D3.1 with N=ALL, plus D3.2–D3.5) in a fresh session. Not run.
  D3.1 explicitly requires "an independent reviewer, not the author".
- **Objective 3 — Lighthouse** not run.
- **Objective 11 — Sepolia contract address and a public tx hash.** The contract, its tests and the full
  seal/verify flow are real and exercised end to end, but **only on local Anvil**. Nothing has been
  anchored on Sepolia.

### Second pass — judge simulation from a differently-named clone

Re-run after the first two fixes, cloning into `SIH-Vasiliades-PRAHARI` and `PRAHARI-finale` rather
than a folder called `prahari`. **Two more defects, both invisible on the development machine.**

| ID | Severity | Finding |
|---|---|---|
| **DEC-053** | **Major** | **`npm run demo` hung for 142 s and left nothing listening.** Docker Compose derives its project name from the directory, so a clone into any other folder name looked for a different project, missed the running stack, and collided with the fixed container names. It failed *silently* — the worst failure at step one of a demo. |
| **DEC-054** | **Major** | **The first click on the Audit panel timed out on a healthy engine.** A cold fusion/audit request triggers ~20 s of Splink training, past the proxy's 8 s ceiling, and rendered as "engine offline". The dev machine was always warm. A judge opening that panel first would have seen a broken product. |

Verified after both fixes, on a fresh clone in a differently-named directory:

| Check | Result |
|---|---|
| `npm run demo` | **17 s** |
| First audit call, cold | **11.4 s**, 4 records, verify true |
| Seven demo steps | **7/7** |
| Browser journey | **25/25** |
| Suites on that clone | 98 web · 236 engine · 12 Solidity, build clean |

### VERDICT

**RELEASE GATE: CONDITIONAL PASS.**

Every objective that can be verified mechanically passes, including the two that failed first and were
fixed. The automated evidence is complete: **371 tests green on a genuinely fresh clone**.

The gate is **not** a full PASS, because three of its twelve objectives require a second person or a
fresh reviewer, and one requires a public-chain transaction that has not been made. Recording that as a
pass would be the precise failure this phase exists to prevent.

**Tag `v2.0-sih` when:** the D3.1 review returns PASS in a fresh session, two teammates run the manual
checklists, and either a Sepolia seal is recorded in `docs/QA.md` or the deck says
"Sepolia-ready, demonstrated on a local chain".

---

## v2.1 baseline

Phase 0 of the v2.1 upgrade. Branch `feat/v2.1-workspace` off `v2-rebuild` @ `800d9ae`.
Run on the working tree, macOS 15 (darwin 25.5.0), Node v26.7.0, npm 11.19.0, Python 3.12.

The playbook this phase executes expects **371 green**. That number is real — it was measured at the
Phase 11 release gate above — but it is **no longer true of this tree**, and the difference is not a
regression introduced here. Recorded exactly as found:

| Check | Expected | Measured | Result |
|---|---|---|---|
| `npm ci` (web) | clean | clean | **PASS** |
| `npm test` (web) | 98 passed | **0 test files, exit 1** | **FAIL** |
| `npm run lint` (web) | clean | ESLint unconfigured; `next lint` opens an interactive setup prompt and exits 1 | **FAIL** |
| `npm run build` (web) | clean | compiled, 10 routes, middleware 49.3 kB | **PASS** |
| `uv sync --extra dev` | clean | clean | **PASS** |
| `uv run pytest -q` | 236 passed | **239 passed, 17 skipped** in 12.94 s | **PASS** |
| `forge test` | 12 passed | `forge` not installed on this machine | **NOT RUN** |
| `node web/e2e/journey.mjs` | 25/25 | harness error at check 1 | **FAIL** |

### Why three of these are red

**1. The web unit suite does not exist.** `aa8789e` ("rebuild the product as an attribution workbench;
remove v1 entirely") deleted `web/__tests__/` in full — `a11y`, `cities`, `extractor`, `mode`,
`report`, `security`, 891 lines, 98 tests — along with the v1 console those tests covered. Nothing
replaced them. `web/vitest.config.ts` still names `__tests__/**/*.test.ts` and still lists the two
happy-dom overrides for files that are gone, so `vitest run` reports *"No test files found"* and exits
1. The commit message says "Engine untouched: 236 tests still green" and does not mention the web
suite; the loss was never recorded.

This matters beyond the count. Three of those files tested code that **survived the rebuild** and is
still shipping: `lib/report.ts` (the `createElement` + `textContent` escape-by-construction path that
closes FINDING-02), `lib/a11y.ts` (the DEC-042 `getClientRects()` focus trap), and the security
assertions that enforce INV-6. Those invariants are currently asserted by nothing.

**2. `npm run lint` was never configured.** There is no `.eslintrc*` and no `eslintConfig` block, so
`next lint` tries to scaffold one interactively. In CI or a non-TTY shell it exits non-zero without
linting anything. `npm run build` does typecheck (`tsc --noEmit` passes clean), so type safety is
covered; lint rules are not.

**3. The e2e journey still drives v1.** `web/e2e/journey.mjs` waits for `**/dashboard` after login
(line 47). The v2 rebuild removed `/dashboard`; `LoginForm.tsx:26` navigates to `/workbench`. The
harness dies on its first navigation, so **none** of the 25 checks — including the `BANNED` emoji regex
that enforces INV-7/DEC-002 — has run since the rebuild.

### What passes, verified

- `uv run pytest -q`: **239 passed, 17 skipped**, 12.94 s. Three more than the 236 recorded at the
  release gate. The 17 skips are the network- and chain-gated tests, skipped by design.
- `npm run build`: clean compile, `tsc --noEmit` clean, 10 routes.
- Both services boot and serve: engine `GET /health` → 200 (caches warmed in 0.8 s), web → 200.
- Login through the real browser succeeds against the seeded demo account and lands on `/workbench`.

### Baseline screenshots

`node web/e2e/baseline-shots.mjs` → `web/e2e/__baseline__/{home,login,workbench,sangam}.png`.
1440×900, `fullPage`, skin pinned to `abyss` via `?skin=` so a re-run is diffable — without the pin the
generative skin picker draws a different palette every run and every diff is noise. Guarded routes are
captured after a real credential login. Waits are `domcontentloaded` + 6 s settle, not `networkidle`:
the workbench polls the engine on a 30 s timer, so the network is never idle and `networkidle` always
times out.

### Verdict

**BASELINE: RED. Phase 0's gate is NOT met and Phase 1 does not start against it.**

The tree does not have the safety net the upgrade's prime directive depends on. "`npm test` must be
green at the end of every phase" is not a meaningful gate when `npm test` runs zero tests, and a visual
baseline is worth much less than an e2e that actually walks the product. Restoring both is Phase 0
work, not Phase 1 work — see `docs/UPGRADE_V2.1.md`.

---

## v2.1 Phase 0b — the safety net, restored

The Phase 0 baseline was red. This phase makes the gate real. **No product code changed** — the only
edit outside tests, config and docs is a comment block plus one `eslint-disable-next-line` in
`app/layout.tsx`. Bundle sizes are byte-identical to the Phase 0 baseline.

| Check | Phase 0 | Phase 0b | Result |
|---|---|---|---|
| `npm test` | 0 test files, exit 1 | **144 passed** (10 files) | **PASS** |
| `npm run lint` | interactive prompt, exit 1 | no warnings or errors | **PASS** |
| `npm run build` | clean | clean, identical route sizes | **PASS** |
| `uv run pytest -q` | 239 passed, 17 skipped | 239 passed, 17 skipped | **PASS** |
| `node web/e2e/journey.mjs` | harness error at check 1 | **35/35 passed** | **PASS** |
| `forge test` | not run | not run | **CONDITION** |

**Total: 418 green** (144 web · 239 engine · 35 e2e), plus 17 engine skips by design and 12 Solidity
tests that this machine cannot run.

### The web suite, rebuilt

Not a restore of the deleted v1 files — most of what they covered no longer exists. New coverage for
what ships today, weighted towards the invariants that had no assertion at all:

| File | Tests | Covers |
|---|---|---|
| `security.test.ts` | 18 | **INV-2** (ENGINE_URL read only in the proxy, never `NEXT_PUBLIC_`, no client component reads a secret, the allowlist is an allowlist and its contents are pinned), **INV-6** (no `innerHTML`/`outerHTML`/`document.write` anywhere; `dangerouslySetInnerHTML` appears exactly once and is fed a module constant), **INV-7** (emoji and decorative-glyph greps), **INV-1** (no `.onion` fetch in the web layer) |
| `report.test.ts` | 14 | **FINDING-02** — the audit's XSS payload set through `lib/report.ts`, asserting text-not-markup, no injected table cells, no `document.write`, no inline script |
| `reportPdf.test.ts` | 18 | The second export path — the payload set through the vector report, null/empty/absurd-length fields, and **INV-5** (a null confidence renders as a dash, never as `0.000`) |
| `authConfig.test.ts` | 18 | **INV-8** from both sides — production refuses a missing secret and refuses the committed dev default separately, while the build phase stays exempt (**DEC-051**) and only the build phase; demo-account gating; the RBAC matrix |
| `a11y.test.ts` | 16 | **DEC-042** — ordering, filtering, wrap-around, Escape, focus restoration, and a source assertion that `offsetParent` has not returned |
| `geoderive.test.ts` | 18 | **INV-5** on the map — derived points labelled inferred in the payload *and* the caption, determinism, no jitter |
| `rateLimit.test.ts` | 13 | **DEC-046** — window behaviour, key isolation, bounded memory, and the fixed-vs-sliding limitation pinned rather than hidden |
| `skins.test.ts` | 14 | Registry ↔ `globals.css` agreement in both directions; the pre-paint script is dependency-free, validates its inputs, and cannot break first paint |
| `time.test.ts` | 10 | Freshness chips — including that a future timestamp clamps to "now" rather than rendering a negative age |
| `features.test.ts` | 5 | Every flag defaults **OFF**, and only the exact value `1` enables one |

Two deliberate design choices, both following DEC-042's lesson that happy-dom is not a browser:

- `security.test.ts` and the DEC-042 case assert against the **source tree**, because "no file does X"
  cannot be proven by exercising one code path — and under happy-dom the broken focus trap and the
  correct one return the same list.
- `security.test.ts` also reproduces the **original vulnerable construction** and asserts it fails the
  same checks the fixed path passes, so the FINDING-02 assertions are provably load-bearing rather
  than vacuously true.

### The journey, repointed

`web/e2e/journey.mjs` drove v1 and died before check 1. Rewritten against v2's real surface:
**35 checks, 35 green**, up from 25 of which none were running.

Kept, with referents that still exist: the 0.840-vs-0.999 pitch, the LR table, root causes, the ledger
(chain of custody, `prev 0x` links, Merkle root, leaf count), the live region, reduced-motion parity,
horizontal-overflow and `BANNED`-glyph checks at three viewports, and DEC-043 touch targets on a
coarse pointer. Added: actor list and triage thresholds, graph mount and legend, all four panel tabs,
the SANGAM route, keyboard reachability, focus visibility, and accessible names on every control.

Four v1 checks have no v2 equivalent. They are **printed as GAPS on every run** rather than dropped:

```
GAP  threat level reaches CRITICAL      — v2 has no threat-level widget
GAP  in-zone city rendered              — v2 has no geofence city list
GAP  DEMO / DATASET / LIVE toggle       — v2 has no mode switch
GAP  dialog focus trap (4 checks)       — v2 renders no role=dialog anywhere
```

### FINDING-06 — an INV-5 violation, found by the restored suite

`lib/geoderive.ts` emits a **Binance off-ramp marker for every actor**, including one with no
infrastructure, no markets and no personas:

```js
offramps.forEach((ex, i) => {
  if (i >= Math.max(1, p.infrastructure.length)) return;   // max(1, 0) === 1
```

`Math.max(1, …)` guarantees the first iteration always runs. The marker is stamped `inferred: false`
and captioned *"Wallet-cluster cash-out reaches Binance. Known exchange region."* — a positive,
unhedged claim about an actor's cash-out route, derived from nothing, drawn on the map with the same
styling as a measured fact. The source comment says "(illustrative)"; the payload says `inferred:
false`. INV-5 requires a derived fact to be labelled as such in the payload **and** on screen.

Pinned as two `it.fails` cases plus one that measures the current output. Not asserted as correct
(that would cement it) and not skipped (that would hide it): as written the suite is green today and
**these tests start failing the moment someone fixes the bug**, which is the prompt to remove the
`.fails`. Phase 0b changes no product code. **Phase 5 owns the fix** — off-ramp geography becomes
"always DERIVED, always labelled" under the three-class model.

### FINDING-07 — the DEC-042 focus trap is unreachable

`trapFocus` and `focusableWithin` are exported from `lib/a11y.ts` and **called from nowhere**. The v2
rebuild removed every dialog, so the fix Phase 9 shipped now guards nothing, and `role="dialog"` does
not appear in the tree. Not a live defect — there is no untrapped dialog, because there is no dialog.
It is a standing trap for Phase 2 and Phase 3, both of which add drawers and modals. The journey
prints it as a GAP on every run.

### Stated condition

`forge test` is **not run**: Foundry is not installed on this machine (`forge: command not found`).
Install with `curl -L https://foundry.paradigm.xyz | bash && foundryup`. Phase 0b changed no Solidity,
so the anchor suite's 12 tests are unaffected by construction — but that is an argument from the diff,
not a measurement, and it is recorded as a condition rather than a pass.

### Verdict

**PHASE 0 GATE: GREEN.** Four of the five suites run and pass, the fifth is a stated environment
condition. `npm test` and `node web/e2e/journey.mjs` can now fail, which is the only property that
makes them gates. **Phase 1 may start.**

---

## v2.1 Phase 1 — the skin bug: draw once per visit

| Check | Phase 0b | Phase 1 | Result |
|---|---|---|---|
| `npm test` | 144 passed | **220 passed** (12 files) | **PASS** |
| `npm run lint` | clean | clean | **PASS** |
| `npm run build` | clean | clean, `/workbench` unchanged at 131 kB / 239 kB | **PASS** |
| `uv run pytest -q` | 239 / 17 skipped | 239 / 17 skipped | **PASS** |
| `node web/e2e/journey.mjs` | 35/35 | **48/48** | **PASS** |
| `forge test` | not run | not run | **CONDITION** |

**Total: 507 green** (220 web · 239 engine · 48 e2e).

### New unit coverage

| File | Tests | Covers |
|---|---|---|
| `skinSession.test.ts` | 33 | All four resolution tiers; nine corrupt/outdated record shapes; storage that throws on read, on write, and on both; the in-memory fallback; persist round-trip |
| `signals.test.ts` | 37 | **The gate** — six skins × two token families, both directions, declared exactly once; stylesheet ↔ TypeScript agreement; three.js integers derived from the same literals; components read the registry, not literals |
| `skins.test.ts` | 14 → 19 | Rewritten for the new script: tier order, per-field record validation, persist-vs-not, per-access storage guards, the independent type pair |
| `security.test.ts` | 18 → 19 | The script's interpolations are restricted to a named allowlist of module constants; every runtime input is validated against the registry |

### New e2e coverage — 13 checks

```
PASS  first load draws a skin — plasma/a/font 0
PASS  first load records it as a fresh draw — fresh
PASS  skin, layout and type hold across public routes
PASS  later loads resolve from the session, not a new draw
PASS  draw survives login and the workbench — plasma/a/0
PASS  draw survives /sangam
PASS  draw survives a HARD RELOAD of /workbench — plasma/a/0
PASS  ?skin= applies for that request
PASS  ?skin= did NOT overwrite the visit's draw
PASS  skin is applied before first paint (no flash) — abyss
PASS  signal-root colours are identical across all six skins
PASS  decorative accent DOES vary by skin (control) — 3 distinct
PASS  a new visit draws independently — 5 distinct draws in 6 visits
```

Two of those deserve naming. The **control** check asserts `--accent` *does* differ across three
skins: without it, "signal colours identical across six skins" would also pass if the walk were
silently reading nothing. And **independence** samples six fresh contexts rather than two, so the
check does not depend on a 1-in-36 coincidence to avoid a false failure.

### Measured before the fix

The same walk on the pre-DEC-055 build, for the record:

```
FAIL  skin, layout and type hold across public routes
      — /about: arctic/a | /docs: ember/b | /login: arctic/b | /: plasma/b
FAIL  draw survives a HARD RELOAD of /workbench — plasma/b (was plasma/a)
FAIL  signal-root colours are identical across all six skins
```

Four different draws in a five-route walk, and the rail changed sides twice.

### Four Phase 0b tests changed, deliberately

`skins.test.ts` and `security.test.ts` pinned the *pre*-DEC-055 contract, including one named
"records that semantic signal-root tokens are not yet separated". They failed when Phase 1 landed —
which is the tests working, not breaking. Each was rewritten to assert the new contract, and the
properties they guarded (input validation, storage guards, fallback-still-sets-a-skin, no unvalidated
interpolation) are all still asserted, more strictly than before.

### Verdict

**PHASE 1 GATE: GREEN.** Skin constant within a visit, independent across visits, no first-paint
flash, semantic tokens identical under all six skins with a passing control. **DEC-055.**

---

## v2.1 Phase 2 — the analyst workspace

| Check | Phase 1 | Phase 2 | Result |
|---|---|---|---|
| `npm test` | 220 passed | **280 passed** (14 files) | **PASS** |
| `npm run lint` | clean | clean | **PASS** |
| `npm run build` | clean | clean, `/workbench` 103 kB (was 239 kB as the cockpit) | **PASS** |
| `uv run pytest -q` | 239 / 17 skipped | 239 / 17 skipped | **PASS** |
| `journey.mjs` — flag ON | 48/48 | **71/71** | **PASS** |
| `journey.mjs` — flag OFF | n/a | **51/51** (23 workspace checks skipped by design) | **PASS** |
| `forge test` | not run | not run | **CONDITION** |

**Total: 590 green** (280 web · 239 engine · 71 e2e).

### New unit coverage

| File | Tests | Covers |
|---|---|---|
| `workspace.test.ts` | 18 | **No duplicate fetches** — one actor, one request, however many routes ask; one shared in-flight promise for simultaneous callers; exactly two calls per actor; five route visits add none. **One object, one number** — checked with `toBe`, not `toEqual`. Error classification, the 422-array case, timeline failure not taking the profile down, band thresholds |
| `routes.test.ts` | 42 | All eleven route files exist and export a component; twelve legacy components still present; the workspace **reuses** each panel rather than forking it; the flag gates the shell not the routes; skip link, `nav` landmark, `aria-current`, `aria-sort`; **FINDING-07** (the palette uses `trapFocus`), `role="dialog"`/`aria-modal`/listbox semantics; deep-link keys in the URL; compare computes no score |

### New e2e coverage — 23 checks (flag on)

Eleven routes render at 200 with no client-side exception; **one actor, one
confidence across all five actor routes** (`saw [0.991]`); a deep link restores
band, sort and direction (`57 rows, band=Strong case, sort=Posts`); changing a
facet writes it back to the URL; and seven command-palette checks covering
Cmd/Ctrl-K, `role="dialog"`, focus entry, the Tab trap, actor search, Escape,
and focus returning to the opener.

### The journey now runs in both builds

It detects the flag from the page (`nav[aria-label="Workspace"]`) rather than
assuming it, and drives the cockpit at whichever path serves it. With the flag
off it asserts the flag-off guarantee — the cockpit is at `/workbench`, the
shell is not rendered — and prints four `SKIP` lines instead of passing
vacuously.

That detection is not defensive tidiness. **The flag-off build was broken and
the flag-on gate could not see it**: the `/workbench` rewrite was registered as
`afterFiles` (the default for a bare array), which applies only when no page
matched, and `app/workbench/page.tsx` always matches. The rewrite never fired
and the flag-off build served the Overview. Fixed with `beforeFiles`; verified
by a full 51/51 flag-off run.

### Three defects found by walking the routes in a real browser

1. **`limit=500` → HTTP 422.** The engine caps at 200
   (`Query(50, ge=1, le=200)`). Both the Overview and the actor list used 500.
2. **A 422's `detail` is an array of objects**, not a string. Rendering it threw
   React error #31 and blanked the entire route — a validation error took the
   page down instead of printing one line. `detailOf()` now coerces any shape to
   text, and every rendering call site goes through it.
3. **The `beforeFiles` rewrite bug** above.

None was reachable by a unit test of the code as written. All three took seconds
to find with a browser pointed at a real engine, which is the standing argument
for keeping this journey.

### One flaky check replaced

"skin is applied before first paint" raced an `evaluate()` against
`waitUntil: "commit"`. It passed for two phases and then failed on an unrelated
build — a flaky gate is worse than no gate. It now asserts the property
structurally: the picker is an **inline, non-deferred script in `<head>`**, so
it executes during head parsing, before the body exists and therefore before
anything can be painted.

It deliberately does **not** assert the script precedes the stylesheet links.
Next injects those above the page's own head children, and it makes no
difference — an inline head script is render-blocking either way; after a
stylesheet the browser simply blocks it on the CSSOM first. Asserting the order
would have been asserting a Next.js implementation detail rather than the
guarantee.

### A harness note worth writing down

The journey logs in **four times per run** (main context, reduced-motion, touch,
skin walk). `lib/auth.ts` rate-limits the credentials callback per IP with an
in-process fixed-window counter (DEC-046), so several runs back to back get
throttled and every subsequent run dies with `waitForURL: Timeout` at login.
That is the limiter working, not a broken harness — restart the web server to
clear the window. This cost real debugging time and is now in the file header.
It is also a live demonstration of the DEC-046 limitation: the counter is
module-scoped memory.

### Verdict

**PHASE 2 GATE: GREEN.** Ten routes live plus the classic cockpit, legacy
cockpit intact and byte-identical at `/workbench/classic`, no duplicate fetches
(measured), e2e green in both flag states. **DEC-056.**

---

## v2.1 Phase 3 — the graph intelligence lab

| Check | Phase 2 | Phase 3 | Result |
|---|---|---|---|
| `npm test` | 280 passed | **373 passed** (17 files) | **PASS** |
| `npm run lint` | clean | clean | **PASS** |
| `npm run build` | clean | clean, graph route 123 kB first-load JS | **PASS** |
| `uv run pytest -q` | 239 / 17 skipped | 239 / 17 skipped | **PASS** |
| `journey.mjs` | 71/71 | **90/90** (19 new lab checks) | **PASS** |
| `forge test` | not run | not run | **CONDITION** |

**Total: 702 green** (373 web · 239 engine · 90 e2e).

### New unit coverage — 93 tests

| File | Tests | Covers |
|---|---|---|
| `graphModel.test.ts` | 40 | Model construction; **agreement with `ActorGraph3D`'s private builder** on node and edge counts; the inferred flag; **determinism** across runs, across freshly built models, and differing per actor; pinning; the coincident-node `NaN` case; filters; ego hops; degree/components; the temporal scrubber's monotonicity; the evidence DAG naming discards; the **800-node budget** |
| `graphViews.test.ts` | 35 | Exactly eleven kinds, all reachable, each with a stated question; **every view captioned** and each caption explaining what the layout means; the per-view honesty rules; the automatic fallback and its announcement; the perf guard; the inspector's no-invented-fields rules; deep-linked controls |
| `graphExport.test.ts` | 18 | Provenance on every format; "not reported by the engine" rather than a fabricated version; JSON round-trip preserving `inferred`; **GraphML against the FINDING-02 payload set**; no model data interpolated into markup |

### New e2e coverage — 19 checks

```
PASS  all eleven views render with a caption
PASS  no client-side exception in any view
PASS  legend names the entity types
PASS  caption states that distance is meaningful but position is not
PASS  the tau coarseness caveat is on the slider itself
PASS  the 2D layout is identical across two loads — 7 nodes placed
PASS  evidence DAG shows the four stages of the argument
PASS  evidence DAG names collapse outcomes
PASS  evidence DAG shows the posterior beside the naive baseline
PASS  inspector lists the node's edges
PASS  inspector names the reliability exponent
PASS  inspector names discarded signals, not just survivors
PASS  inspector offers provenance rather than blanks
PASS  a pasted lab URL restores view, roots, threshold and toggles
PASS  the lab has a live profile to export
PASS  all four export formats are offered
PASS  the export panel states what provenance it carries
PASS  reduced motion falls back to the linkage list, and says so
PASS  the fallback lists every edge — 13 rows
```

The determinism check is done **in the browser**, comparing the SVG transform
attributes across two loads of the same URL. The unit test proves the solver is
deterministic; this proves the rendered page is, which is the property the gate
actually asks for.

### Three defects found while building, all by running the code

1. **`createDocument` under happy-dom returns an HTML document** whose root is
   `<html>`, and `setAttribute("xmlns", …)` emitted a **second** xmlns attribute
   beside the implicit one — malformed XML ("attributes construct error"). Fixed
   by seeding through `DOMParser` and using `createElementNS`.
2. **happy-dom's `DOMParser` rejects `attr.name` / `attr.type`.** The dot is
   legal in an XML attribute name and GraphML mandates exactly those two, so
   re-parsing *valid* output failed. Well-formedness moved to the e2e, where a
   real `DOMParser` exists. Asserting it under happy-dom would be testing
   happy-dom — DEC-042 again.
3. **The 2D layout settled into a thumbnail** in the middle of a 900×800 stage.
   No test caught it and none would have: every assertion about bounds and
   determinism passed. Found by screenshotting the real page. Fixed with a
   uniform fit-to-stage scale, which preserves distance ratios and therefore the
   caption's claim.

### One pre-existing defect closed

`__tests__/workspace.test.ts` (Phase 2) annotated its spies as
`ReturnType<typeof vi.spyOn>`, which erases the method signature to
`(...args: unknown[]) => unknown` and then refuses the concrete `api.actor`
overload. `npx tsc --noEmit` failed on it; **`next build` did not surface it**,
which is why Phase 2 went green. Fixed by inferring the types from a factory.
The lesson is recorded because it generalises: `next build`'s type check is not
a substitute for `tsc --noEmit` over the whole tree.

### Verdict

**PHASE 3 GATE: GREEN.** Eleven views, all captioned, fallback intact and
announced, exports carry provenance, determinism proven in the browser.
**DEC-057.**
