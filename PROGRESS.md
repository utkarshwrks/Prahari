# PROGRESS

The single source of truth for project status. Updated at the end of every phase.

---

## Last phase — 6: INFRASTRUCTURE FINGERPRINTING — 31 August 2026 — automated layer PASS

Passive onion → clearnet matching. Nothing here connects to Tor or scans a host.

**Shipped**

- **`engine/engines/infra.py`** — Certificate Transparency with failover, Shodan InternetDB, favicon
  mmh3, header-order fingerprint, JARM guarded behind explicit ownership.
- **Rule table** — all six playbook strengths, with **max** aggregation, never a sum.
- **Testbed infra-leak** — resolves to the planted domain at **0.95** with five evidence lines, from
  planted metadata, so the demo never depends on a third-party index being up.
- **Endpoints** — `/infra/pivot`, `/infra/certificates`, `/infra/host`, `/infra/sources`.
- **Passivity enforcement** — `assert_not_onion()` on every outbound URL, plus a network-layer test
  that spies on `socket.getaddrinfo` and asserts no `.onion` resolution is ever attempted.

**Two blockers resolved by measurement, both in the project's favour**

1. **B-03 closed, and better than assumed (DEC-026).** Shodan needs **no key at all**:
   `internetdb.shodan.io` is free and unauthenticated and returns ports, hostnames, CPEs, tags and
   vulns. `SHODAN_API_KEY` is off the critical path entirely — one fewer key, one fewer account for an
   on-prem deployment.
2. **crt.sh was DOWN — 0/5 attempts, all HTTP 502 (DEC-027).** It carries the 0.95 and 0.85 rules.
   certspotter is also free and keyless, returned 100 certificates throughout, and is now primary;
   crt.sh is automatic failover. `/infra/sources` names which source actually answered.

**Results**

| Check | Value |
|---|---|
| Testbed leak → planted domain | **0.95**, 5 evidence lines |
| Decoy host, shared nginx banner only | **0.40** |
| Live CT on a real public domain | **100 certificates** via certspotter |
| Shodan InternetDB, no key | ports + hostnames returned |
| Cache hit rate on repeat | 0.50 |
| **Outbound `.onion` requests** | **0** |

**Tests:** 165 engine (was 139), 57 web, build clean.

---

## Current phase — 7: EVIDENCE FUSION, CALIBRATION, CONFORMAL GUARANTEE — not started

**The phase that decides whether the project wins.** All five signal roots now exist.

**Objectives**

1. `engine/fusion/score.py` — `LR = s/(1-s)`; group by root; **max LR per root**; `Π LR_root^r`;
   prior odds 1:10 blocked / 1:10,000 otherwise; must-not-link caps.
2. Unit test reproducing **0.84** from the deck example and **0.999** from the naive baseline —
   which is **noisy-OR**, `1 − Π(1−sᵢ)`, not an LR product (DEC-003, settled in Phase 1).
3. `calibrate.py` — isotonic regression, Brier, ECE, reliability-diagram JSON.
4. Split-conformal: threshold τ for risk budget α, `/fusion/threshold?alpha=`.
5. `eval.py` — precision, recall, F1, false-merge at τ, Brier, ECE; writes METRICS.
6. `POST /fusion/feedback` — analyst verdict updates negatives and re-scores.
7. `/fusion/pair/{id}`, `/fusion/actor/{id}`.

**Signals available to fuse**

| Root | Source | Status |
|---|---|---|
| `identity_key` | Splink PGP/email match | Phase 4 |
| `financial` | shared wallet, lineage edges | Phase 4 |
| `infra` | onion → clearnet pivot | Phase 6 |
| `linguistic` | `s_style` with mimicry caps | Phase 5 |
| `temporal` | `s_time`, rebrand candidates | Phase 5 |
| `social` | handle similarity, vouches | Phase 4 |

**The two cases fusion must get right:** the **decoy** must land ≤ 0.30 with its negative listed, and
the **rebrand** pair must clear threshold on linguistic + temporal + financial-lineage alone, since
neither has a hard identifier.

---

## Next phase — 8: IMMUTABLE AUDIT

Hash chain, Ed25519 signatures, Merkle roots, Sepolia anchoring with Anvil fallback.

**Prerequisites from Phase 7:** the canonical JSON serialisation of `PairScore`, and the list of
analyst actions that must be hashed.

---

## Blockers

| # | Blocker | Blocks | Status |
|---|---|---|---|
| B-01 | Docker not installed | Phase 2 obj 2, 4 | **RESOLVED** 30 Aug — Docker 29.7.2, both images arm64-native, cold start 24 s |
| B-02 | Foundry (`forge`, `anvil`) not installed | Phase 8 | Open — not yet needed, install before Phase 8 |
| B-03 | Shodan free tier credits | Phase 6 | **RESOLVED** 31 Aug — no key needed at all. `internetdb.shodan.io` is free and unauthenticated (DEC-026). |
| B-04 | Gwern DNM Archives manual download | Phase 3 | **Kaggle Agora RESOLVED** 31 Aug — 109,689 rows loaded, 1,000-row real fixture committed. Gwern deferred per DEC-019; it is the only source with timestamps, so it stays a Phase 10 nice-to-have, not a demo dependency. |

| B-05 | crt.sh returned HTTP 502 on 5/5 attempts | Phase 6 | **MITIGATED** 31 Aug — certspotter (also free, also keyless) is now primary, crt.sh is failover (DEC-027). Not resolved upstream; the service is simply unreliable. |

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
