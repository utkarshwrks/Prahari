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
