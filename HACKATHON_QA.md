# PRAHARI v2 — Hackathon Q&A

The **complete 150+ question bank** is in the PDF pack
(`~/Downloads/prahariv2docs/3_PRAHARI_150_questions_and_answers.pdf`, regenerate
with `node scripts/gen_docs.cjs`). The most-asked questions are below.

## The problem & the approach

**Q. What is PS 26151?**
De-anonymisation and attribution of dark-web threat actors — linking the personas
behind marketplace/forum activity into real actors, queryable across a timeline,
using lawful means.

**Q. Do you break Tor?**
No. We correlate footprints operators leaked into PUBLIC places (certificate-
transparency logs, public marketplace archives, public chain data). The live Tor
timing demo runs entirely on our OWN hidden service and client, so it is legal
and reproducible.

**Q. What is the one-sentence pitch?**
PRAHARI links dark-web personas into one actor from public footprints and reports
how confident it is — with a published error rate and a tamper-evident record.

**Q. What signals do you use?**
Identity keys (PGP), financial (wallets), infrastructure (onion→clearnet),
linguistic (stylometry), and temporal (timing). Only hard identifiers form an
actor; soft signals adjust confidence.

## The maths (the USP)

**Q. Why not just multiply the signal probabilities?**
Because they are correlated. Multiplying assumes independence and saturates to
~0.999 — false certainty that collapses under cross-examination. Root-collapse +
reliability dampening give an honest 0.84.

**Q. What is root-cause collapse?**
Signals sharing one underlying cause (e.g. a wallet and the infra it paid for) are
grouped so one fact is counted once, not several times.

**Q. What is reliability dampening?**
Each root's likelihood ratio is raised to an exponent r∈(0,1]. A PGP key (r high)
counts far more than writing style (r ≈ 0.5). Contribution = LR^r.

**Q. What makes the confidence "calibrated"?**
We measure Expected Calibration Error (~0.005) and use split-conformal prediction
to bound the false-merge rate at a chosen risk budget (3.1% at α=0.05) —
distribution-free and finite-sample.

**Q. What are negatives / counter-deception?**
Evidence against a link (`mimicry_suspected`, `llm_rewrite_suspected`) acts as a
CAP on the score, not a subtraction — it bounds how sure we may be.

**Q. How do I reproduce the numbers?**
`cd engine && uv run python -m engine.fusion.eval`; every figure traces to
`docs/METRICS.md`.

## The ledger & blockchain

**Q. How is the audit trail tamper-evident?**
Each action is canonically serialised, keccak-256 hashed, chained, and Ed25519-
signed. The per-case Merkle root is anchored on-chain; any edit breaks the chain
and the root no longer matches.

**Q. What is anchored, and where?**
Only the 32-byte Merkle root — never PII — on Polygon Amoy (chainId 80002, a
zero-gas testnet; Sepolia secondary), verifiable on amoy.polygonscan.com.

**Q. What happens if money passes through a mixer?**
The financial signal is DROPPED for attribution — a mixer output is shared by
thousands, so it is not evidence of a common controller.

## The live Tor demo

**Q. What does it prove, and is it legal?**
That traffic-timing alone can link a visitor to a hidden service without
decrypting anything. It is legal because both the hidden service and the client
are ours. It takes ~30–40s; if Tor can't bootstrap it falls back to a controlled
replay badged "simulated".

## Tech & deployment

**Q. What is the stack?**
Next.js 14 + TypeScript + React Three Fiber (frontend); FastAPI + Python 3.12,
Neo4j GDS, Splink, scikit-learn (engine); Solidity + Foundry + web3.py + Polygon
Amoy (chain); PyNaCl + keccak Merkle (audit); `stem` (Tor). ₹0 to run.

**Q. How does the browser reach the engine?**
Only through a Next.js proxy with a strict allowlist — the engine URL/key never
reach the client.

**Q. How is it deployed for free?**
Frontend on Vercel, engine on Render (Docker), contract on Polygon Amoy. See
[DEPLOYMENT.md](DEPLOYMENT.md). One free faucet claim covers the deploy plus 100+
demos.

## Differentiation

**Q. How is PRAHARI different from existing tools?**
Black-box match scores don't show their working, treat correlated evidence as
independent, and don't bound their error rate. PRAHARI shows the arithmetic,
collapses correlated evidence, dampens by reliability, publishes a false-merge
rate, and anchors a tamper-evident record — at ₹0, on-premise.

**Q. Why does calibration win?**
A defensible 0.84 that survives cross-examination is worth more than an
impressive but brittle 0.999. Courts and judges can re-run the numbers.

---

*For the full 154-question bank, the tech deep-dive, the simple-Hinglish primer,
and the data-features explainer, see the PDF pack in `~/Downloads/prahariv2docs/`.*
