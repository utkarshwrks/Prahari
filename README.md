# PRAHARI · प्रहरी — the sentinel

**Dark-web threat-actor attribution.** Link the personas behind dark-web
marketplace and forum activity into single real actors, and report how confident
we are — with a **published error rate** and a **tamper-evident record**.

Smart India Hackathon 2026 · Problem Statement **26151** (NTRO) · Team Vasiliades.
Runs at **₹0** on free and open-source software, entirely on-premise.

> **We never break Tor, never scrape a live market, and never claim to.**
> Attribution here means correlating the footprints operators leaked *themselves*
> into public indexes — and we say so, because a system that claims to break Tor
> is claiming something nobody can deliver.

---

## The idea in one breath

A threat actor wears many masks online — different handles, on different markets.
But the person behind them keeps making the same small public mistakes: the same
signing key, the same wallet, the same writing habit, the same activity rhythm.
PRAHARI collects those mistakes from **public** sources, works out which masks are
the same actor, and says **how sure** it is.

## Three things that make it different

1. **A confidence score that survives cross-examination.** Stack five correlated
   signals naively and you get **0.999** — false certainty. PRAHARI converts each
   to a likelihood ratio, **collapses them by root cause** so one fact cannot be
   counted five times, and **dampens each by its measured reliability**. The same
   evidence yields **0.84** — a number defensible in court. We publish a
   **false-merge rate** (3.1% at α=0.05) backed by a distribution-free
   split-conformal guarantee, and an **ECE of ~0.005** (0.84 really means 84%).
2. **A record nobody can quietly edit.** Every analyst action is canonically
   serialised, keccak-256 hashed, chained to its predecessor, and Ed25519-signed.
   Each case's Merkle root is **anchored on-chain** (Polygon Amoy, zero-gas) —
   32-byte hashes only, never PII. A single record verifies against the root via
   its inclusion proof, without disclosing the rest of the case.
3. **A live, honest network-layer demo.** PRAHARI stands up its **own** ephemeral
   Tor hidden service and its **own** client, then cross-correlates the timing at
   both ends to show that timing alone links a visitor to a service — the real
   principle behind onion de-anonymisation — legally, on infrastructure it owns.

---

## The five signal families

| Signal | What links two personas | Reliability |
|--------|-------------------------|-------------|
| **Identity key** | A reused PGP signing key across handles | highest |
| **Financial** | A shared wallet cluster (common-input clustering) across markets | high |
| **Infrastructure** | An onion whose TLS cert (certificate-transparency) names a clearnet host | high |
| **Linguistic** | Stylometry — n-grams, function words, punctuation, Hinglish markers | ~½ a key |
| **Temporal** | Posting rhythm + the live Tor timing correlation | contextual |

Only **hard identifiers** (key, wallet) can form an actor on their own; soft
signals adjust confidence but never merge two people by accident. **Negatives**
(`mimicry_suspected`, `llm_rewrite_suspected`) act as a **cap** on the score, not
a subtraction — counter-deception, honestly applied.

---

## The workbench

The analyst cockpit at `/workbench`:

- **Actor list** — candidates banded by confidence (Strong case / Worth a look /
  Weak-unresolved), searchable by handle, PGP, wallet or id.
- **Relationship graph (3D)** — an explainable force-directed graph: colour =
  entity type, size = importance, edge thickness = evidence strength; shared
  identifiers pull personas together, a decoy drifts to the rim. Hover for names,
  click for a detail card, **maximise into a fullscreen "holo space"** view.
- **Actor profile** — headline confidence, personas, clickable identifiers
  (copy / trace on-chain), infrastructure, timeline, linkages, provenance, and a
  **Preview → one-page PDF report** (vector, downloadable).
- **Evidence trail** — the per-root likelihood-ratio arithmetic, shown, with the
  PRAHARI-vs-naive comparison. A score whose trail cannot recompute it is not
  evidence.
- **Tor timing** — the live correlation experiment (real circuit, ~30–40 s).
- **Chain flow** — wallet clustering to real-world off-ramps; a mixer in the path
  drops the financial signal.
- **Ledger** — the tamper-evident audit chain with the on-chain anchor link.

**Generative UI.** The app reskins itself on every load: one of six hand-tuned
skins (palette, type, shape, rail side) is applied before first paint, so it
regenerates to something fresh each visit while every data feature stays
identical. A floating control reshuffles it live or locks it.

---

## Tech stack

```
Frontend   Next.js 14 (App Router) · TypeScript strict · NextAuth
3D         React Three Fiber · three.js · drei · d3-force
Engine     FastAPI · Python 3.12 (uv) · APScheduler
Graph/ML   Neo4j GDS · Splink · scikit-learn · scipy · spaCy
Chain      Solidity + Foundry · web3.py · Polygon Amoy (Sepolia secondary)
Crypto     PyNaCl (Ed25519) · keccak-256 Merkle · mempool.space (no key)
Net        stem (real Tor hidden service + client), timing correlation
Report     jsPDF (one-page vector attribution report)
Cost       ₹0 / $0 — no paid API key needed for the full demo
```

The browser **never** talks to the engine directly — every call goes through a
server-side proxy (`/api/engine/[...path]`) with a strict allowlist, so the
engine URL and any key never reach the client.

---

## Run it locally (no keys, no Docker)

```bash
# 1) engine  (Python 3.12 via uv)
cd engine && uv sync && uv run uvicorn engine.main:app --port 8000

# 2) web
cd web && npm install && npm run dev
```

Open http://localhost:3000, click **Open workbench**, and sign in with the
pre-filled demo analyst account (`analyst@prahari.local` / `prahari123`).
The demo account is disabled entirely in production.

Or use the one-shot script: `./scripts/demo.sh`.

---

## Deploy it for free

Full instructions in **[DEPLOYMENT.md](DEPLOYMENT.md)** — frontend on **Vercel**,
engine on **Render**, contract on **Polygon Amoy**. Configs are already in the
repo (`engine/Dockerfile`, `render.yaml`, `web/vercel.json`). The on-chain anchor
needs one free faucet claim to the anchorer wallet; one claim covers the deploy
plus 100+ full demos (see the budget table in DEPLOYMENT.md).

---

## Reproduce the numbers

Every metric is reproducible and traces to `docs/METRICS.md`:

```bash
cd engine && uv run python -m engine.fusion.eval
```

Tests: **256** engine tests, **12** Solidity tests, plus web tests and strict
typechecks.

---

## Document pack

A ready-to-share PDF pack is generated by `scripts/gen_docs.cjs` into
`~/Downloads/prahariv2docs/`:

1. **Simple Hinglish** — the whole project in the easiest language.
2. **Tech stack & technical deep-dive** — architecture, the fusion maths, Q&A.
3. **150+ Questions & Answers** — a full question bank.
4. **Every data feature explained** — for technical and non-technical readers.

Regenerate: `node scripts/gen_docs.cjs`.

---

## What it deliberately does not do

- It does **not** break Tor, and never claims to. Every source is a public index
  that already holds the data.
- It does **not** scrape live marketplaces or probe target hosts. Passivity is
  enforced by a network-layer test, not a promise.
- Behavioural analysis runs on **labelled synthetic ground truth**, because the
  public archive we ingest carries no reliable timestamps — stated openly.
- **Stylometry is the weakest signal** in the system and is weighted at about
  half a signing key's reliability, deliberately.

A system that publishes its limits is one you can check. That is the point of the
whole design.

---

*PRAHARI · प्रहरी · SIH 2026 · PS 26151 · Team Vasiliades · free and open source, on-premise.*
