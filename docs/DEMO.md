# DEMO — the seven-step script

Target: **under 3 minutes**, no manual steps, from `npm run demo` on a fresh clone.
Rehearsed three times by three different people before the finale (Phase 10 obj 3).

Timings below are budgets. Measured values from Phase 10 are in **bold** where the step has been
timed end to end.

---

## Before you start

```bash
npm run demo
```

That is the whole setup. It brings up the datastores, starts a local chain,
deploys the anchor contract, boots the engine and the web app, and waits until
each one actually answers before printing "ready".

**Measured cold start: 10 seconds.** The playbook budget is three minutes.

If Docker is not running it will say so. If Foundry is absent, sealing is
disabled and everything else still runs — the launcher tells you which.

Open `http://localhost:3000`. Log in as `officer@mp.gov.in` / `prahari123`.

Have ready: the tampered export file (`docs/fixtures/tampered-case.json`) and, if the network is
down, the Anvil fallback already running.

---

## Step 1 — The problem, on the map (0:00–0:25)

Land on `/dashboard` in **DEMO** mode. The feed streams. At ~6 s Jabalpur breaches, at ~15 s Katni.
Sirens fire, threat level goes CRITICAL, the counter increments, the alert log fills.

> "This is a live geofence over Jabalpur district. Two rings — 60 km core, 95 km zone. Three cities are
> in-zone. When dark-web chatter names one of them, this room knows in under a second."

**Do not skip to the new features.** The geofence is the reason a district cyber cell would run this.

## Step 2 — Real data, not a mock (0:25–0:50)

Switch the header toggle **DEMO → DATASET**. The feed reloads with real listings from the Agora
2014–2015 public academic dataset and the Gwern DNM archives.

> "Same room, real historical marketplace data — publicly released, academically archived. Category-level
> text only. We never touch Tor, never scrape a live market. Everything you'll see is correlation of
> footprints the actors leaked themselves."

Open one listing. Show the extracted entities and the engine badge.

## Step 3 — One actor, many faces (0:50–1:20)

Open the seeded actor. The 3D graph renders: personas across markets, joined by PGP keys, wallets,
contacts, and infrastructure.

> "Three handles on three marketplaces. The graph merged them into one actor — because they share a
> hard identifier, not because they sound alike."

Drag the **timeline scrubber**. Edges and feed narrow together — the NTRO requirement to query across a
chosen timeline.

Then show the **decoy**: a persona that copied the target's bio verbatim.

> "This one looks identical and is deliberately not merged. Different PGP, no shared wallet. Copying a
> bio is not evidence, and the system says so."

## Step 4 — Why 0.84 and not 0.999 (1:20–2:00) — **the pitch**

Click the confirmed pair. The Evidence Trail Sankey opens: five signals → root causes → score.

> "Five signals: PGP, wallet, infrastructure, writing style, posting rhythm. Stack them naively assuming
> independence and you get **0.999** — near certainty. That number is a lie. The wallet and the
> infrastructure often share a cause; the writing style is the weakest evidence we have.
>
> We convert each to a likelihood ratio, **collapse them by root cause** so one fact can't be counted
> twice, and dampen each by how reliable that signal type actually is. That gives **0.84**.
>
> 0.84 is defensible in court. 0.999 gets thrown out."

Move the **conformal threshold slider**. The "safe to act" count changes.

> "At α = 0.05, this threshold guarantees the false-merge rate among links above it stays under 5% — a
> distribution-free guarantee, not a hope. We publish our false-merge rate. That's the difference between
> a demo and evidence."

## Step 5 — Chain of custody (2:00–2:35)

Open the Audit Ledger. The hash chain is visible with `prev_hash` links; the Merkle tree draws as it hashes.

Press **Seal**. Tx card appears: block number, gas ~70k, Sepolia explorer link.

> "Every analyst action is canonically serialised, keccak-hashed, chained to the previous record, and
> signed with the analyst's Ed25519 key. The case's Merkle root is anchored on Ethereum Sepolia.
> Only 32-byte hashes go on-chain — no handle, no wallet, no text. Bharatiya Sakshya Adhiniyam 2023,
> section 63."

## Step 6 — Prove it (2:35–2:55)

Export the case as JSON. Drop it on the **Verify** zone → **GREEN**.

Drop the pre-prepared **tampered** file → **RED, with the failing record index**.

> "One byte changed, and it names exactly which record broke. Restore it and it's green again. You can
> verify a single record against the chain with its inclusion proof, without ever seeing the rest of
> the case file."

Show CSV / JSON / PDF exports carrying `root`, `tx_hash`, `chain_id` — the NTRO-mandated formats.

## Step 7 — Last mile (2:55–3:00)

Back to the map. The actor's operating footprint is drawn as a convex hull over their stated cities,
with the routed district label.

> "It ends where it has to end — a sealed, verifiable case file routed to the right district cyber cell.
> Jabalpur. That's the whole job."

---

## If the network dies

Do not apologise, do not restart. The Anvil fallback is part of the story.

> "We're offline, so it's sealing to a local chain — you can see the LOCAL CHAIN badge. Same contract,
> same proof, same verification. On-prem deployments for a government network run exactly this way."

Everything except Sepolia's explorer link works with Wi-Fi off. This is rehearsed (Phase 11 obj 6).

---

## Anticipated questions

| Question | Answer |
|---|---|
| "Do you scrape Tor?" | No. Public indexes, academic archives, and OSINT only. We de-anonymise by correlating leaked footprints. |
| "Is the data real?" | DEMO is synthetic and labelled as such. DATASET is real, publicly released academic data. Nothing is faked. |
| "Why 0.84?" | Because 0.999 assumes independence that isn't there. See step 4. |
| "What's on-chain?" | 32-byte hashes only. Never PII. |
| "What does this cost to run?" | ₹0. Free tiers, no-key public endpoints, open-source software, all self-hostable on-prem. |

Full set in `HACKATHON_QA.md`.
