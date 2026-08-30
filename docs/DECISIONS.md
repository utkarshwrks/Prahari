# DECISIONS

Every technical decision that deviates from, or resolves an ambiguity in, the v2 playbook.
Append-only. Each entry: what was decided, why, and what it costs.

---

## Phase 1 — Sync

### DEC-001 — The product is PRAHARI. Locked.
No second product name. The deck's working title "ANVESHAN" is retired; v2 is PRAHARI v2.
Hindi wordmark प्रहरी stays. Grep for any other product name must return nothing at the release gate.

### DEC-002 — "No emojis" means no pictographic characters **and** no decorative glyphs in rendered UI.
**Ambiguity resolved.** The playbook's automated check (`grep -rP "[\x{1F300}-\x{1FAFF}]"`) and its manual
checklist ("search the UI for any emoji at 1440 px") disagree about `✓ ⚠ ↳`. The automated grep passes on
v1 as-is; a manual tester would flag six strings.

Decision, so Phase 1 and Phase 11 cannot contradict each other:

- **Rendered UI strings:** no pictographic emoji, and no decorative `✓ ⚠ ↳ ●` used as an icon. Use lucide.
- **Code comments, prose and docs:** `→` and `←` are permitted as typographic arrows. They are never rendered.
- **The Phase 11 grep is widened** to `[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}]` over rendered
  strings, so the automated and manual layers test the same rule.

Cost: six source edits in Phase 1 (`BreachToaster`, `NotificationCenter`, `IntelDetailModal` ×2,
`WalletTracker`, `LiveNERAnalyzer`) plus emoji removal from `README.md` and `HACKATHON_QA.md`.

### DEC-003 — Naive-stack baseline is **noisy-OR**, not an LR product.
**Ambiguity resolved — this one would have failed a Phase 7 acceptance test.** The playbook requires the
fusion engine to report 0.84 and a naive baseline of 0.999 from the same five signals. Verified by
computation this phase:

| Formulation | Result |
|---|---|
| PRAHARI: `LR=s/(1−s)` per signal, max per root, `Π LR_root^r`, prior odds 1:10 | **0.8395** → 0.84 ✓ |
| Naive **noisy-OR**: `1 − Π(1−sᵢ)` | **0.999126** → 0.999 ✓ |
| Naive LR-product, prior 1:1 | 0.9963 ✗ (rounds to 1.00, not 0.999) |

`engine/fusion/score.py` must implement `naive_stack` as **noisy-OR**. Phase 7's test asserts
0.84 ± 0.01 and 0.999 ± 0.001. Recorded now so Phase 7 does not rediscover it under deadline.

### DEC-004 — Ethereum Sepolia locked, with Anvil as an explicit visible fallback.
Public chain is Sepolia only. Foundry Anvil is the offline demo path. The fallback is **never silent** —
a "LOCAL CHAIN" badge renders and a Sepolia explorer link must be impossible to show for an Anvil tx
(enforced by a Phase 8 test, and attacked by D3.3 objective 5).

### DEC-005 — Free / open-source only. No trials, no cards.
Anything requiring payment stops the phase and is written to `PROGRESS.md` under Blockers rather than
silently substituted.

### DEC-006 — Rejected: Kafka, Redis, MinIO, Scrapy, Playwright-as-scraper.
- **Kafka / Redis** — the ingest volume is thousands of rows, not a stream. APScheduler + FastAPI
  `BackgroundTasks` cover it. Both also add containers to a demo that must cold-start in under 3 minutes.
- **MinIO** — no blob workload. Postgres holds everything.
- **Scrapy / Playwright as a scraper** — violates the passivity rule. We query public indexes, never crawl
  markets. (Playwright is still used, in Phase 9, purely as a **test runner** — that is not scraping.)

These appear on the current deck and must be removed from it (Phase 10 obj 6).

### DEC-007 — Accepted: MuRIL, Splink, Neo4j GDS, JARM, conformal prediction.
- **MuRIL** — Hinglish/Devanagari is the actual language of MP marketplace text; English-only NER
  under-recalls. Public HF model, CPU inference, free.
- **Splink** — probabilistic record linkage with trained m/u weights and an auditable EM fit, on a DuckDB
  backend. Open source (UK Ministry of Justice), and its match weights are explainable in court.
- **Neo4j GDS Community** — WCC, Louvain and FastRP are all in the free plugin. Enough for actor
  resolution and neighbour search.
- **JARM** — TLS fingerprinting, but only against testbed hosts and clearnet domains already surfaced by
  crt.sh. Never against a target.
- **Conformal prediction** — gives a distribution-free false-merge guarantee at a chosen α. This is the
  defensible claim no competing team will make.

### DEC-008 — Tests live at `__tests__/` at the repo root for Phase 1; Phase 2 moves them to `web/__tests__/`.
The playbook writes Phase 1 tests to `web/__tests__/`, but `web/` does not exist until Phase 2 obj 1.
Creating it early would half-do the restructure and break every `@/` import. Tests go at the root now and
move with the app in Phase 2, in the same commit as the path change.

### DEC-009 — v1 users move to Postgres via the **engine proxy with a local fallback**, not a direct DB driver.
**Ambiguity resolved.** Phase 2 obj 4 says move users to Postgres "behind the same `lib/users.ts` function
signatures", but obj 8's own acceptance test requires the workbench to keep working when the engine is
killed — and login is not optional. A direct `pg` driver in Next also adds a second connection pool and a
Node-only dependency to a module imported near the Edge middleware boundary.

Decision: `lib/users.ts` keeps its signatures and tries the engine first, falling back to the existing
bcrypt flat-file path when the engine is down. The demo officer account stays code-resident and always
works. Same honesty rule as Groq: the app degrades, it never breaks.

### DEC-010 — CI is set up in Phase 2, not left implicit.
Phase 8 requires an end-to-end Anvil test "in CI" and Phase 11 requires a "link to CI run", but no phase
creates CI. A GitHub Actions workflow (`npm test`, `pytest`, `forge test`) is added in Phase 2 so later
phases have somewhere to attach.

### DEC-011 — Extraction is implemented twice, on purpose.
`lib/extractor.ts` (TypeScript) stays as the engine-offline path; `engine/extract/` (Python) is the
extended one with spaCy + MuRIL. Two implementations risk drift, so the 30 hand-labelled sentences from
Phase 3 are run against **both**, and the TS version is only required to match on the regex/gazetteer
subset. Accepted cost of the "workbench never hard-depends on the engine" rule.

### DEC-012 — Engine Python is pinned to 3.11/3.12, not the system 3.14.
The build machine defaults to Python 3.14.7. spaCy, PyTorch CPU, Splink and the HF stack do not reliably
publish wheels for 3.14; a source build on CPU would cost hours and may fail outright. `engine/pyproject.toml`
pins `requires-python = ">=3.11,<3.13"` and the environment is created with `uv`. Decided in Phase 1 so
Phase 2 does not lose a day to it.

### DEC-013 — Groq model id is configurable; the v1 default was decommissioned.
**Deviation from the Phase 1 constraint "do not change any v1 behaviour except the emoji removal",
recorded deliberately.**

v1 hardcoded `llama-3.3-70b-versatile`. Groq has retired it — the endpoint now returns
`404 model_not_found`. Because `analyze()` catches every Groq error and falls through to the local
extractor (INV-3), the failure was invisible: the app reported `source: "local"` and looked healthy
while the Groq path was dead. A valid key could never produce a Groq result.

This is a defect, not a behaviour change: the intended behaviour ("use Groq when a key is present") was
unreachable. Fixed rather than deferred because the key exists to make live testing possible, and a
silent permanent fallback would have been discovered on stage.

- `lib/extractor.ts` now reads `GROQ_MODEL`, defaulting to `openai/gpt-oss-120b`.
- Verified end-to-end: `POST /api/analyze` returns `source: "groq"` for English and Hinglish input.
- The honest-badge invariant is unaffected — the badge still reports the engine that actually ran.

### FINDING-07 — Groq returns city names that the gazetteer cannot resolve.
Surfaced while verifying DEC-013. On the Hinglish input
`"bhai jbp aur katni mein delivery ho jayegi"`, Groq returns `locations: ["jbp", "katni"]` — lowercase,
and `"jbp"` is a colloquial abbreviation absent from `lib/cities.ts`.

`getCity()` lowercases its lookup so `"katni"` resolves, but `"jbp"` does not, and
`registerCities()` skips any name `getAnyCity()` cannot resolve. The result is a **silently dropped
in-zone mention**: the model correctly identified Jabalpur, and the geofence never saw it.

The local extractor does not have this bug because it only ever emits exact gazetteer names — but it
also never detects `"jbp"` at all. Neither path is correct today.

Phase 3 must add a normalisation/alias layer between extraction and the gazetteer (`jbp`, `jblp`,
`jabalpore`, Devanagari `जबलपुर`, etc.), and the extraction P/R table in `docs/METRICS.md` must measure
recall *after* normalisation, not before. Not fixed in Phase 1 — it is Phase 3 scope and needs the
Hinglish lexicon that phase introduces.
