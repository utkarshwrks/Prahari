# ARCHITECTURE — PRAHARI v2

PRAHARI v1 is a geofencing control room. PRAHARI v2 adds attribution engines and an immutable
audit trail on top of it, without changing what v1 already does.

**Interpretation, stated once and never walked back:** we attribute by correlating *voluntarily leaked*
footprints across public sources. We never break Tor, never scrape a live market, never probe a target
host, and never claim to.

---

## 1. The six stages

```
  STAGE 0            STAGE 1           STAGE 2                     STAGE 3
  COLLECT     ──▶    EXTRACT    ──▶    FOUR ENGINES        ──▶     EVIDENCE FUSION
  public data        entities          infra · identity            LR per signal, grouped
  DNM archives       PGP/wallet        stylometry · chain          by root cause, dampened
  Agora CSV          onion/city                                    by reliability
  OSINT feeds        contraband        each emits Signals          ↓
  crt.sh/Shodan      handle/email      with a root label           PairScore + trail
  mempool/Etherscan
                                                                   STAGE 4
                                                                   GEO-ATTRIBUTION
                                                                   v1 geofence, UNCHANGED
                                                                   → district routing
                                                                   ↓
                                                                   STAGE 5
                                                                   WORKBENCH + AUDIT
                                                                   hash chain · Ed25519
                                                                   Merkle root → Sepolia
                                                                   CSV / JSON / PDF export
```

Stage 4 is v1. It is load-bearing and frozen: `isInJabalpurZone()` remains the breach predicate, driven
by real haversine distance against the MP gazetteer only. See `AUDIT_V1.md` §5 for the six invariants.

---

## 2. Repository layout

```
prahari/
  web/                 v1 Next.js 14 app (moved here in Phase 2, extended in Phase 9)
  engine/              FastAPI
    ingest/            dnm_archives · kaggle_agora · osint · chain
    extract/           regex + spaCy + MuRIL, ports lib/extractor.ts
    engines/           infra · graph · linkage · stylometry · behaviour
    fusion/            score · calibrate · eval
    testbed/           generate.py — synthetic ground truth, fixed seed
    audit/             ledger · merkle · anchor
    models/            trained weights (gitignored, regenerable)
    fixtures/          1,000-row samples so the demo never needs a full download
  anchor/              Foundry: PrahariAnchor.sol, deploy + verify scripts
  docs/                ARCHITECTURE · DECISIONS · AUDIT_V1 · DEMO · METRICS · TESTLOG · QA · DECK
  docker-compose.yml   neo4j (+GDS), postgres (+pgvector)
  PROGRESS.md          Last / Current / Next / Blockers — the status contract
```

Until Phase 2 the v1 app still lives at the repo root (`app/ components/ lib/ store/`). See DEC-008.

---

## 3. Trust boundary

| Runs in | What | Never holds |
|---|---|---|
| **Browser** | React UI, zustand stores, Leaflet/MapLibre, localStorage records | No API key. No engine URL. No private key. |
| **Next server** | NextAuth, `/api/analyze`, `/api/live-intel`, `/api/signup`, and from Phase 2 the `/api/engine/[...path]` proxy | Holds `GROQ_API_KEY`, `NEXTAUTH_SECRET`. Sole path to the engine. |
| **FastAPI engine** | ingest, extract, four engines, fusion, audit ledger, anchoring | Holds `ETHERSCAN_API_KEY`, `SHODAN_API_KEY`, `ANCHORER_KEY`, DB credentials. Not exposed to the browser. |
| **Postgres / Neo4j** | personas, posts, entities, signals, pair_scores, cases, audit_records, seals, sources; graph + FastRP vectors | — |
| **Ethereum Sepolia** | `anchor(bytes32 root, bytes32 caseRef, uint32 leafCount)` | **32-byte hashes only.** No handle, wallet, name, or text ever goes on-chain. |

The browser reaching the engine directly is a Critical finding. The proxy exists so that stays true.

---

## 4. Data contracts

### Carried from v1, unchanged

```ts
Intercept      { id, source, timestamp, rawText, entities, severity, live?, channel?, url? }
Entities       { locations[], contraband[], wallets[], handles[] }
AlertLogEntry  { id, city, source, severity, timestamp, lat, lng, distanceKm,
                 rawText, status, assignee?, note?, read, live?, channel?, url? }
CaseRecord     { id, title, city, category, severity, status, assignee,
                 wallet?, handle?, notes, sourceText?, createdAt, updatedAt }
```

`CaseRecord` gains `actorId, personas[], confidence, sealRoot, sealTx` in Phase 9. The
`localStorage` key bumps to `prahari-records-v2` when that shape lands.

### New in v2

```ts
Persona    { id, market, handle, first_seen, last_seen }
Post       { persona_id, market, ts, title, body, price, category, raw_pgp }

Signal     { pair_id, root, name, strength, reliability, provenance, negative, cap }
           root ∈ identity_key | financial | infra | linguistic | temporal | social

PairScore  { p_raw, p_calibrated, roots_used[], roots_collapsed[], negatives[], trail[] }

AuditRecord{ seq, case_id, actor, action, payload, prev_hash, hash, signature, pubkey, ts }
Seal       { case_id, root, leaf_count, tx_hash, chain_id, block, anchored_at }
```

Every number in `PairScore` must be reproducible from `trail` alone. A score whose trail does not
recompute it is a Critical finding (D3.2 objective 3).

---

## 5. The confidence model

The USP. Naive evidence stacking treats every signal as independent and saturates at ~1.0 on
correlated evidence. PRAHARI collapses signals by **root cause** first, then dampens by reliability.

```
per signal      LR    = s / (1 − s)
per root        LR_root = max(LR of signals sharing that root)     ← collapses double-counting
combine         LR_total = Π over roots of LR_root ^ r_root        ← r = reliability exponent
posterior       odds = prior_odds × LR_total
                prior 1:10 for blocked candidate pairs, 1:10,000 otherwise
caps            must-not-link rules clamp the result
```

Worked example from the deck — verified by computation in Phase 1, and frozen as a Phase 7 test:

| Root | Signal | s | LR | r | LR^r |
|---|---|---|---|---|---|
| identity_key | PGP | 0.78 | 3.5455 | 0.9 | 3.1240 |
| financial | wallet | 0.71 | 2.4483 | 0.7 | 1.8716 |
| infra | infrastructure | 0.83 | 4.8824 | 0.8 | 3.5555 |
| linguistic | writing style | 0.69 | 2.2258 | 0.5 | 1.4919 |
| temporal | posting rhythm | 0.74 | 2.8462 | 0.5 | 1.6871 |

`LR_total = 52.32` · prior odds `1:10` → posterior odds `5.232` → **p = 0.8395 ≈ 0.84**

Naive noisy-OR on the same five inputs: `1 − Π(1−sᵢ)` = **0.9991 ≈ 0.999**.

That 0.84-vs-0.999 gap is the pitch. See DEC-003 for why the naive baseline is noisy-OR specifically.

**Must-not-link caps:** conflicting PGP on the same platform → 0.25 · copied bio with different hard IDs
→ 0.30 · exchange/mixer-tagged wallet → drop the financial root entirely · analyst reject → 0.10.

**Calibration and guarantee:** isotonic regression on a held-out split gives `p_calibrated`, reported with
Brier score and ECE. Split-conformal prediction then yields, for a risk budget α, a threshold τ such that
the false-merge rate among links at `p ≥ τ` is ≤ α with a stated coverage guarantee.

---

## 6. The audit chain

```
analyst action ──▶ canonical JSON (sorted keys, no whitespace, UTF-8)
                     ↓ keccak-256
                   leaf_n
                     ↓ hash_n = keccak(prev_hash ‖ leaf_n)     ← append-only chain
                     ↓ Ed25519 signature (analyst key, registered at signup)
                   audit_records
                     ↓ per-case Merkle tree over sorted leaves
                   root ──▶ PrahariAnchor.anchor(root, caseRef, leafCount) on Sepolia
                                ↓
                            tx_hash · block · explorer URL     (or Anvil + LOCAL CHAIN badge)
```

Tampering any record breaks the chain at that index, and `/audit/verify` reports the failing index.
A single record can be verified in isolation via its Merkle inclusion proof, without the rest of the case —
which is what makes an export admissible under Bharatiya Sakshya Adhiniyam 2023 §63.

Threat model, tested adversarially in D3.3: an attacker with **full database write access** but without the
analyst's Ed25519 private key or the anchorer wallet must not be able to alter, delete, reorder or replay a
record undetected.

---

## 7. Degradation contract

Nothing hard-fails. Every dependency has an honest fallback, and the UI always says which path ran.

| Missing | Behaviour |
|---|---|
| `GROQ_API_KEY` | Local regex extractor, badge says `local` |
| Engine down | DEMO and LIVE modes fully work; DATASET shows "engine offline" |
| `SHODAN_API_KEY` | Infra runs cache-only; crt.sh still carries the 0.95/0.85 rules |
| Model weights absent | Stylometry falls back to classic features, badge says so |
| Network down | Anvil chain + fixtures; **LOCAL CHAIN** badge, never a silent switch |
| Neo4j / Postgres down | Workbench stays up and degrades honestly |

A badge that misreports which engine actually ran is a Critical finding.
