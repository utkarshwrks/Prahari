# PROGRESS

The single source of truth for project status. Updated at the end of every phase.

---

## Last phase — 5: STYLOMETRY & BEHAVIOUR — 31 August 2026 — automated layer PASS

The signals Phase 4 could not reach.

**Shipped**

- **Stylometry** — TF-IDF char 3-5 grams, 150 function words, TTR, punctuation habits, and **Hinglish
  markers** (romanised-Hindi ratio, Devanagari, honorifics).
- **Behaviour** — 24-bin hour histogram in **IST**, weekday, inter-post intervals; Jensen-Shannon → `s_time`.
- **Counter-deception** — bio-level mimicry detection and a **relative** LLM-rewrite detector.
- **Rebrand detection** — change-point plus death/birth gap, style threshold and wallet lineage.
- **Verifier** — logistic model over 8 pairwise features (Siamese cut, DEC-023).
- **Endpoints** — `/style/compare`, `/style/profile`, `/behaviour/compare`, `/behaviour/profile`,
  `/compare`, `/rebrand/candidates`.

**The Phase 5 inversion, which is the point of the phase**

| Case | Phase 4 (linkage) | Phase 5 (style) |
|---|---|---|
| **Decoy** | correctly separate (no shared identifier) | raw similarity **0.827** — but capped to **0.200** by `mimicry_suspected` |
| **Rebrand** | correctly separate (distinct wallets) | **0.843**, detected rank 1 with correct dates and lineage |

Both are invisible to record linkage. Style separates them in the right direction.

**Tests:** 139 engine (was 114), 56 web, build clean.

**Three findings, each caught by measurement rather than review**

1. **DEC-025 — mimicry was measured on the wrong text.** The playbook says "Jaccard on **bio**
   shingles"; applied to the full post corpus, the decoy's copied bio is one line in thirteen and
   diluted away. The decoy scored **0.914 — higher than genuine pairs — with no flag**. The single
   most important negative case passed as the strongest positive.
2. **DEC-024 — the LLM-rewrite threshold was meaningless.** Burstiness on the testbed ranges
   0.102-0.385; an absolute cutoff of 0.25 fired on **206 of 244 personas (84%)**. Now relative to the
   corpus's 5th percentile, and it **abstains** with no reference: 4.5% false positives, still catches
   genuinely flattened text.
3. **DEC-023 — Siamese model cut, with reasons beyond the time budget.** 244 personas of templated
   text would train a char-CNN to memorise the generator. The logistic fallback publishes its
   coefficients, and `hinglish_diff` came out the second-strongest feature.

---

## Current phase — 6: INFRASTRUCTURE FINGERPRINTING — not started

Passive onion → clearnet matching. **Passive only: never connect to a `.onion`, never scan a host.**

**Objectives**

1. `engine/engines/infra.py` — crt.sh (no key), Shodan (free key, cache-only without), JARM against
   testbed-controlled hosts only, favicon mmh3, header-order fingerprint.
2. Matching rules and strengths: cert SHA-256 reused 0.95 · CN/SAN names a clearnet domain 0.85 ·
   exposed `server-status` 0.90 · favicon hash 0.75 · JARM + banner 0.60 · banner alone 0.40.
3. Testbed infra-leak resolves from planted metadata, so the demo never needs a live Shodan call.
4. `/infra/pivot?onion=`, `/infra/sources` with cache hit rate.
5. Tests including **a network-layer assertion that no outbound request host ends in `.onion`**.

**Blocker to settle in the first hour:** B-03 — Shodan free accounts may not include host-lookup API
credits. Validate before building on it; crt.sh alone carries the 0.95 and 0.85 rules.

---

## Next phase — 7: EVIDENCE FUSION (the USP)

Root-cause collapse, reliability dampening, isotonic calibration, conformal guarantee.

**Prerequisites from Phase 6:** infra signals written with root `infra` and provenance, joining the
style (`linguistic`), behaviour (`temporal`), linkage (`identity_key`, `social`) and chain
(`financial`) signals already produced.

---

## Blockers

| # | Blocker | Blocks | Status |
|---|---|---|---|
| B-01 | Docker not installed | Phase 2 obj 2, 4 | **RESOLVED** 30 Aug — Docker 29.7.2, both images arm64-native, cold start 24 s |
| B-02 | Foundry (`forge`, `anvil`) not installed | Phase 8 | Open — not yet needed, install before Phase 8 |
| B-03 | Shodan free tier may not include host-lookup API credits | Phase 6 obj 1 | Open — **validate in the first hour of Phase 6**. Mitigation already in the design: crt.sh carries the 0.95/0.85 rules and Shodan degrades to cache-only. Not a free/open-source rule violation, just an unverified capacity assumption. |
| B-04 | Gwern DNM Archives manual download | Phase 3 | **Kaggle Agora RESOLVED** 31 Aug — 109,689 rows loaded, 1,000-row real fixture committed. Gwern deferred per DEC-019; it is the only source with timestamps, so it stays a Phase 10 nice-to-have, not a demo dependency. |

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
| **Extraction P/R** | **EN 1.000 / HI 1.000 recall** (regression guard; 7/10 on unseen forms, 0 false positives) |
| **Splink P/R** | **P=1.000 R=0.818** (130/130 reachable, 0 false positives) |
| **Fusion worked example** | **0.8395 → 0.84** (verified Phase 1) |
| **Naive noisy-OR baseline** | **0.9991 → 0.999** (verified Phase 1) |

---

## Demo status

Which of the seven `docs/DEMO.md` steps run end-to-end today.

| Step | State |
|---|---|
| 1. Geofence on the map (DEMO mode) | **works** — v1, breaches at ~6 s and ~15 s |
| 2. DATASET mode, real listings | **works** — 1,000 real Agora listings with extracted entities |
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
