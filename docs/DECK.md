# DECK ALIGNMENT CHECKLIST

The deck must match the running system. Where they disagree, the system is right
and the slide changes — never the other way round.

Every figure below was measured on this machine and is reproducible with
`python -m engine.fusion.eval`.

---

## Numbers cleared for the deck

| Claim | Value | Source |
|---|---|---|
| Calibrated confidence, worked example | **0.84** (0.839543) | `/fusion/example` |
| Naive stacking on the same inputs | **0.999** (0.999126) | noisy-OR, DEC-003 |
| False-merge rate at α = 0.05 | **3.1%** (0.031348) | conformal, guarantee holds |
| Precision at τ | **1.000** | `fusion/eval` |
| F1 at τ | **0.938** | `fusion/eval` |
| Brier / ECE | **0.0053 / 0.0051** | isotonic, held-out split |
| Splink precision / recall | **1.000 / 0.818** | 130/130 reachable pairs |
| False merges over 3,180 unrelated pairs | **0** | Phase 4 |
| Agora listings ingested | **109,689** | 3,192 vendors |
| Blocklist drop rate | **1.67%** (1,832 bodies) | Phase 3 |
| `anchor()` gas | **95,232** | measured on Anvil |
| Cold start, `npm run demo` | **10 s** | measured |
| Tests | **236 engine · 95 web · 12 Solidity · 25 e2e** | — |

## Slide changes required

- [ ] **Add stage 6, Immutable Audit.** The deck shows five stages; the system has six.
- [ ] **Stack row** → Next.js 14 · FastAPI · Neo4j GDS · PostgreSQL + pgvector · Splink · scikit-learn ·
      Solidity + web3.py · Leaflet
- [ ] **Remove Kafka, Redis, MinIO, Scrapy, Playwright-as-scraper.** All four rejected in DEC-006 and
      none is in the build. Playwright is present only as a test runner.
- [ ] **Add the risk row for evidence tampering**, answered by the keccak chain + Ed25519 + Merkle root.
- [ ] **Add the BSA 2023 §63 reference** next to single-record inclusion proofs.
- [ ] **Add the 0.84-vs-0.999 line.** It is the single strongest slide in the deck.
- [ ] **Fix "POP keys" → "PGP keys."**
- [ ] **Fill the metrics table** from the block above.

## Claims to REMOVE or soften

These are things the system does not do, and a judge will ask.

- [ ] **"De-anonymises Tor."** It does not, and no honest system does. It correlates footprints actors
      leaked themselves into public indexes. Say that; it is a stronger claim because it is true.
- [ ] **Any figure attributed to Agora.** Agora has no timestamps, ~0.1% PGP coverage and zero Madhya
      Pradesh geography (DEC-018). **Every metric comes from the labelled testbed.** Attributing them to
      real marketplace data is the one claim that would collapse under a single question.
- [ ] **MapLibre 3D map, 3D force graph, d3 Sankey, timeline scrubber** — cut in DEC-044.
      Say **roadmap**. Never "done".
- [ ] **Siamese char-CNN** — cut in DEC-023 for a logistic model. Roadmap.
- [ ] **Live Sepolia anchoring** — the contract, tests and flow are real, and it has been exercised
      end-to-end on Anvil. If it has not been sealed on Sepolia before the finale, say
      "Sepolia-ready, demonstrated on a local chain", and show the LOCAL CHAIN badge doing its job.

## The honesty slide (recommended)

Worth its own slide, because it is a differentiator rather than a caveat:

> We publish what we cannot do. Agora carries no timestamps, so behavioural analysis runs on labelled
> synthetic ground truth. Stylometry is our weakest evidence and is weighted accordingly. Our
> false-merge rate is 3.1%, not 0%. We never touch Tor.

A team claiming 99% accuracy and Tor de-anonymisation is claiming something no one can deliver. The
gap between 0.84 and 0.999 is the whole argument.

## Ten viva answers

In `HACKATHON_QA.md`.
