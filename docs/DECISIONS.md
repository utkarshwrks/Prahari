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

---

## Phase 2 — Foundation

### DEC-014 — Container memory is pinned, not negotiated.
Docker Desktop on the build machine allocates ~8.3 GB. Neo4j's default heap sizing inspects host memory
and claims aggressively, which starves Postgres and, later, CPU inference in Phase 5. `docker-compose.yml`
therefore pins Neo4j to 1 GB heap + 512 MB pagecache (2 GB container limit) and Postgres to 1 GB.

Verified sufficient for the testbed scale (thousands of personas, not millions). If Phase 5 hits memory
pressure, raise Docker Desktop to 12 GB rather than unpinning these — unpinned Neo4j is what breaks first.

### DEC-015 — Neo4j healthcheck uses `cypher-shell`, not a port probe.
Neo4j binds 7687 well before it can answer queries. A TCP healthcheck reports healthy while the first
real query still fails, which would make `npm run demo` flaky in exactly the way Phase 10 must not be.
The healthcheck runs `RETURN 1` over Bolt so "healthy" means "answering queries".

Measured cold start with this healthcheck: **24 s** for both services (playbook budget: 60 s).

### DEC-016 — Postgres ENUMs are created and dropped explicitly in migrations.
Found by the Phase 2 up/down/up test, not in review. SQLAlchemy emits an inline `CREATE TYPE` the first
time an `Enum` column is used and never drops it. `op.drop_table()` therefore leaves `signal_root`
behind, and the *next* `alembic upgrade` fails with `DuplicateObject: type "signal_root" already exists`.

Every fresh clone would have worked and every rebuild would have broken — the worst failure shape for a
demo. The initial migration now creates the type explicitly with `checkfirst=True`, declares the column
with `create_type=False`, and drops the type in `downgrade()`.

Verified: `up -> 10 tables / down -> 0 tables, 0 enums / up -> 10 tables`, sources reseeded both times.
Regression-guarded by `engine/tests/test_migrations.py::test_up_down_up_is_clean`.

### DEC-017 — `/health` returns 200 when Postgres is down.
"The engine is up" and "the database is up" are different facts, and the workbench must tell them apart
to degrade honestly: engine-unreachable means DATASET mode shows "engine offline", whereas
database-unreachable means the engine can still serve `/version`, `/feed` and a fallback `/sources`.
Collapsing both into a 503 would make the two indistinguishable from the browser.

`/health` therefore stays 200 and carries the truth in `checks.database`. A non-200 from `/health` means
the process itself is gone.

---

## Phase 3 — Data

### DEC-018 — What the real Agora dataset can and cannot support.
Measured on the actual file before any code was written: 109,689 listings, 3,192 vendors (3,061 with more
than one listing), columns `Vendor, Category, Item, Item Description, Price, Origin, Destination, Rating,
Remarks`. Three gaps materially change what DATASET mode can claim.

| Gap | Measured | Consequence |
|---|---|---|
| **No timestamp column** | zero date/time fields | The `temporal` root has no real-data source. Posting-hour and inter-post-interval features, `ruptures` rebrand detection (Phase 5) and the "overlapping active window" blocking rule (Phase 4) run on the **testbed only**. |
| **PGP effectively absent** | 107 blocks in 109,689 listings (~0.1%), no PGP column | `identity_key` is the strongest signal (0.95 `SIGNED_WITH`) and real data barely supplies it. Hard-identifier linkage is demonstrated on the testbed; Agora supplies `social` and `linguistic` roots. |
| **No Madhya Pradesh geography** | 0 MP city mentions, 243 "India", 1,122 India-origin | The geofence has no hook in Agora. It stays a DEMO-mode story. |

**Division of labour, stated so it is never blurred on stage:**

- **DEMO** — synthetic, MP-focused. Carries the geofence.
- **DATASET** — real Agora. Carries linkage and stylometry over 3,061 multi-listing vendors.
- **Testbed** — labelled synthetic ground truth. Carries **every metric** in `docs/METRICS.md`.

Consequence for Phase 10: the landing page and deck must attribute metrics to the testbed, not to Agora.
Implying otherwise is the kind of claim a judge breaks with one question.

What Agora *does* supply and no synthetic source could: genuine vendor prose across 3,061 multi-listing
vendors — a real stylometry corpus — plus 1,490 onion references, 247 emails and 12 BTC addresses.

### DEC-019 — Gwern DNM Archives deferred, not dropped.
The archives are daily crawls and therefore **do** carry timestamps, which is exactly what Agora lacks.
They are also a very large manual/torrent fetch. Phase 3 ships the loader against the documented format
and a committed fixture; the full download is a Phase 10 nice-to-have, not a demo dependency.
Recorded so the temporal gap in DEC-018 is understood as addressable, not inherent.

---

## Phase 4 — Identity Graph

### DEC-020 — Splink m and u are MEASURED from ground truth, never estimated.
`estimate_u_using_random_sampling` assumes true matches are rare enough to ignore. On this testbed they
are not: it sampled all 29,646 pairs including the 130 that genuinely share a PGP key, and reported
**u(pgp) = 0.0053 when the measured value is 0.0** — no non-matching pair shares a key at all. That
contamination turned a near-conclusive identifier into a Bayes factor of 187, and recall collapsed to
0.11.

Measured with Laplace smoothing instead (u strictly positive, because an infinite Bayes factor drives
the posterior to exactly 1.0 — neither numerically safe nor honest to report):

| Field | m = P(agree \| match) | u = P(agree \| non-match) | Bayes factor |
|---|---|---|---|
| PGP fingerprint | 0.6531 | 0.0000170 | **38,519** |
| Wallet | 0.4531 | 0.0000170 | **26,724** |
| Email | 0.0031 | 0.0000509 | 61 |

**No Splink training runs after these are set.** Calling `estimate_m_from_label_column` afterwards
silently overwrote them, which put a PGP-sharing pair in the "all other" level and scored it 0.36 with
`match_weight = -0.8` — the strongest identifier in the system read as evidence *against*. That failure
was invisible except as bad recall.

### DEC-021 — Splink recall is 0.818, and the ceiling is structural.
The playbook's acceptance target is recall >= 0.9 at threshold 0.5. Measured: **0.818**, with
**precision 1.000 and zero false positives**.

The gap is not tuning. Of 159 true pairs, only **130 share any hard identifier**; Splink finds
**130 of 130 — 100% of what exact matching can reach**. The remaining 29 pairs share no PGP, no wallet
and no email, and are unreachable by record linkage in principle.

Those 29 are not a defect. They are the pairs **Phase 5 (stylometry, behaviour) and Phase 7 (fusion)
exist to catch** — an actor who rotated every hard identifier but kept their writing habits. The
rebrand case is deliberately one of them.

The honest pair of numbers to report, and the ones that go in the deck:

- **Recall over pairs sharing a hard identifier: 1.000**
- **Recall over all true pairs: 0.818** (ceiling 0.818 by construction)
- **Precision: 1.000, false positives: 0**

Raising the generator's identifier-sharing rate would push the headline past 0.9 while making the task
strictly easier. That is fixing the slide instead of the source, and it is refused.

### DEC-022 — Only hard identifiers form actors; wallet lineage stays soft.
WCC runs over `SIGNED_WITH` and `PAID_TO` only. `CONTACT`, `VOUCHES_FOR`, `MENTIONS` and
`FUNDS_FLOW_TO` are excluded, because a shared inbox, a rating link or a transfer between two distinct
addresses is evidence of a relationship, not proof of one controller.

Verified on the testbed: **0 false merges across 3,180 unrelated pairs**, the decoy stays in a
different actor from its target despite an identical bio and matching style, and the rebrand pair stays
separate so Phase 5 has something real to solve.

---

## Phase 5 — Stylometry & Behaviour

### DEC-023 — Siamese char-CNN cut; the playbook's documented logistic fallback is taken.
Phase 5 objective 3 allows reducing to "the classic-features logistic model" if CPU training of the
Siamese network exceeds 30 minutes, provided the decision is recorded. It is taken, for reasons beyond
the time budget:

- **The data cannot support it.** 244 personas x 12 templated posts is far too little text to train a
  two-tower char-CNN without memorising the generator's templates. It would score well on the testbed
  and mean nothing.
- **PyTorch CPU adds ~2 GB** to a demo that must cold-start in under three minutes.
- **Explainability is the product.** A logistic model publishes its coefficients; a char-CNN does not.
  "The network said 0.9" is not defensible in court, which is the whole argument of this project.

The fallback is implemented as a real trained model, not a stub: logistic regression over eight
pairwise features, stratified 70/30 split, seed 42.

| Metric | Value |
|---|---|
| ROC AUC | 0.7976 |
| Accuracy | 0.7068 |
| Train / test pairs | 445 / 191 |

Learned coefficients, which are themselves a finding:

| Feature | Weight |
|---|---|
| `char_ngram` | **+3.4000** |
| `hinglish_diff` | **-3.0039** |
| `punct_cosine` | +1.7887 |
| `honorific_diff` | -0.4257 |
| `ttr_diff` | -0.3281 |

**The Hinglish ratio is the second-strongest feature in the model.** A difference in romanised-Hindi
usage argues strongly against shared authorship. That is direct evidence the Hinglish markers earn
their place rather than being decoration for an Indian-jurisdiction pitch, and it is the empirical
case for MuRIL in the roadmap.

Roadmap, not "done": the Siamese model is revisited only if real multi-market corpora with genuine
per-author volume become available.

### DEC-024 — The LLM-rewrite detector is RELATIVE, and abstains without a reference corpus.
An absolute burstiness threshold does not work, and the measurement is unambiguous: across 244 testbed
personas, sentence-length coefficient of variation ranges 0.102-0.385 with a median of 0.205. The
initial `burstiness < 0.25` rule fired on **206 of 244 personas (84%)**. Templated text is inherently
flat; that says nothing about whether a machine rewrote it.

"Flat" is only meaningful against a reference. The detector now flags a persona only when it sits below
the **5th percentile of its own corpus** and shows a near-zero typo rate, and **abstains entirely when
no corpus is supplied** — an unvalidatable flag that downweights real evidence is worse than no flag.

| | Before | After |
|---|---|---|
| False positives on genuine personas | 206 / 244 (84%) | **11 / 244 (4.5%)** |
| Catches genuinely flattened text | — | **yes** (burstiness 0.000) |
| Behaviour with no reference corpus | fired anyway | **abstains** |

### DEC-025 — Mimicry is detected on BIOS, not the whole corpus.
The playbook specifies "Jaccard on bio shingles > 0.9". Applied to a persona's full post corpus instead,
the decoy's verbatim-copied bio is one line against twelve listings and dilutes below any sane
threshold: the decoy scored **s_style 0.914 — higher than genuine pairs — with no flag raised**. The
single most important negative case in the testbed passed as the strongest positive.

Bios are now profiled separately from post text and compared directly, with shingle size dropping to
k=3 for short texts so Jaccard does not collapse to all-or-nothing on exactly the inputs that matter.

Result: decoy **s_style 0.2000** (capped), flagged `mimicry_suspected`, against rebrand **0.8432**.
Its raw character-n-gram similarity is still 0.827 — the decoy genuinely does read like its target,
which is the point. The cap is the system recognising imitation rather than being fooled by it.

---

## Phase 6 — Infrastructure Fingerprinting

### DEC-026 — B-03 resolved: Shodan needs no key at all. InternetDB is free and unauthenticated.
The blocker was that Shodan free accounts may not include host-lookup API credits. Measured: they do
not need to. **`https://internetdb.shodan.io/{ip}` is free, requires no key, and returns ports,
hostnames, CPEs, tags and known vulns** — everything the infra engine needs for host fingerprinting.

`SHODAN_API_KEY` is therefore removed from the critical path entirely. It stays an optional enrichment
for the paid `/shodan/host` endpoint, and its absence costs nothing. This is strictly better than the
playbook assumed: one fewer key, and one fewer account for an on-prem deployment to register.

### DEC-027 — Certificate Transparency uses certspotter first, crt.sh second.
**crt.sh was down during Phase 6 — 0 of 5 requests succeeded, all HTTP 502.** It carries the two
strongest infra rules (cert SHA-256 reuse 0.95, CN/SAN naming a clearnet domain 0.85), and it is a
well-known flaky service. Building the demo on it alone means the strongest evidence path fails if
crt.sh is having a bad day on 20 September.

`api.certspotter.com` is also free, also keyless, was returning 100 certificates with
`dns_names`, `issuer` and `cert_sha256` throughout, and is now the **primary** source. crt.sh remains
as automatic failover, and `/infra/sources` reports which source actually answered.

The engine badge names the CT source that served each result. A pivot that silently came from a
different index than the analyst assumes is the same class of dishonesty as a wrong engine badge.

### DEC-028 — JARM and live scanning are restricted to hosts we control.
JARM actively probes a host's TLS stack. Run against a target it is a scan, which the passivity rule
forbids outright. It therefore runs **only** against testbed-controlled hosts, and the testbed's
infra-leak case is resolvable purely from planted metadata so the demo never needs a live probe.

Certificate Transparency and Shodan InternetDB are genuinely passive: both are third-party indexes
that already hold the data. We read an index; we never touch the target.

**No code path may issue a request to a `.onion` host.** This is enforced by a network-layer test, not
by convention.

---

## Phase 7 — Evidence Fusion

### DEC-029 — The conformal threshold must handle ties, or the guarantee is a lie.
Isotonic regression outputs are piecewise constant, so calibrated scores clump into steps. The textbook
split-conformal quantile `negatives[ceil((n+1)(1-α)) - 1]` can land **inside a block of identical
values**, and taking that value as τ admits the entire block.

Measured consequence at α = 0.05: **false-merge rate 25.2%** while the API reported a 5% guarantee.
A guarantee that does not hold is worse than no guarantee, because it is stated with confidence and
a court would rely on it.

τ now walks up to the next distinct value until the bound is genuinely met, and returns 1.0 with an
explicit `guarantee_holds: false` when no threshold can bound the rate. Verified across
α ∈ {0.01, 0.02, 0.05, 0.10, 0.20}: the bound holds at every one, τ decreases monotonically with α,
and the accepted-link count increases monotonically.

**Known coarseness, stated rather than hidden:** isotonic collapses this testbed's scores into few
distinct steps, so τ has poor resolution — α = 0.05 and α = 0.10 currently yield the same τ, and
α = 0.01 can only be honoured by accepting the 52 pairs scored at 1.0. That is a real limitation of
calibrating on 1,336 validation pairs, not a bug, and the slider must not imply finer control than the
data supports.

### DEC-030 — The trail publishes 12 decimal places, because 6 did not reproduce.
`reproduce_from_trail()` recomputed **0.925596** where `p_raw` was **0.925597** — accumulated rounding
across factors that were published at the display precision.

One unit in the last published place is still a published number that does not reproduce, and
"every number in the trail must be reproducible from the API output" is a Phase 7 constraint and a
D3.2 objective. An opposing expert recomputing from the exhibit and getting a different digit is
exactly the opening that discredits the rest. Factors now carry 12 dp; `roots_used` stays at 6 dp for
reading.

### DEC-031 — Candidate generation is not only Splink.
The prior is 1:10 for a pair that reached our attention and 1:10,000 otherwise. Deriving "reached our
attention" from Splink's blocking alone gave the **rebrand pair the 1:10,000 prior and crushed it to
0.0003** — unfindable by construction, in the one case built specifically to be findable without a
hard identifier.

The rebrand detector is a candidate generator in its own right. A pair proposed by **any** legitimate
generator earns the blocked prior. The rebrand pair now scores **0.2335** on `financial` (wallet
lineage) + `linguistic` + `temporal`, with **no `identity_key` root at all** — which is the entire
argument for Phases 5 and 6 existing.

### DEC-032 — `/fusion/threshold` and `/fusion/pair` report on the same scale.
`thresholds()` computed τ over raw scores while `evaluate()` used calibrated ones, so the two endpoints
published thresholds in different units. An analyst comparing a pair's score against the published τ
would have been comparing different things. `ensure_calibrated()` now guarantees both are calibrated.
