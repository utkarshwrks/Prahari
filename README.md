# PRAHARI · प्रहरी — "The Sentinel That Never Sleeps"

**Dark-web threat-actor attribution and geofencing control room for the Madhya Pradesh Police Cyber Cell, Jabalpur.**
Smart India Hackathon 2026 · PS 26151 (NTRO) · Team Vasiliades.

## What PRAHARI v2 is, in ten lines

Threat actors on dark-web markets leak footprints: a reused PGP key, a wallet that appears twice, an
onion whose TLS certificate names a clearnet domain, a writing habit that survives a rebrand. PRAHARI
collects those footprints from public and academically-released sources, extracts entities from them
(including Hinglish), and runs four independent engines — infrastructure, identity graph, stylometry,
blockchain — over the result. It then fuses their evidence into a **single calibrated confidence score**
that refuses to double-count correlated signals, geofences whatever it finds against Jabalpur district,
and seals the whole case into a tamper-evident, cryptographically anchored record an officer can take to
court. It runs at ₹0 on free tiers and open-source software, entirely on-premise.

**We never break Tor, never scrape a live market, and never claim to.** Attribution here means
correlating footprints the actors leaked themselves, from public indexes.

## Three things no competing system does

1. **A confidence score that survives cross-examination.** Stack five correlated signals naively and you
   get **0.999** — false certainty. PRAHARI converts each to a likelihood ratio, collapses them by root
   cause so one underlying fact cannot be counted five times, and dampens each by its measured
   reliability. The same five signals yield **0.84**. We publish our false-merge rate and back it with a
   distribution-free conformal guarantee at a chosen risk budget α.
2. **Court-grade chain of custody.** Every analyst action is canonically serialised, keccak-256 hashed,
   chained to its predecessor and signed with the analyst's Ed25519 key. Each case's Merkle root is
   anchored on Ethereum Sepolia — 32-byte hashes only, never PII. A single record can be verified against
   the chain via its inclusion proof, satisfying Bharatiya Sakshya Adhiniyam 2023 §63.
3. **Last-mile jurisdiction routing.** Attribution ends where it has to: a sealed case file routed to the
   responsible district cyber cell, geofenced by real haversine distance, not a guess.

```
Framework   Next.js 14 (App Router) · TypeScript strict     Web      6,544 TS/TSX · 65 modules
Engine      FastAPI · Python 3.11 · CPU-only inference      Cost     ₹0 / $0 to run
Data        PostgreSQL + pgvector · Neo4j GDS · DuckDB      Keys     none required to run v1
Chain       Solidity + ethers v6 · Sepolia (Anvil offline)  Status   Phase 1 of 11 complete
```

Run v1 today with no keys and no Docker: `npm install && npm run dev`, then log in as
`officer@mp.gov.in` / `prahari123`. All DEMO data is synthetic and labelled as such.

---

## Feature status

**v1** = shipped in the geofence console · **done** = built and tested in v2 · **planned** = specified,
not started · **roadmap** = descoped, never demoed as working.

| # | Feature | Phase | Status |
|---|---|---|---|
| FR-01 | Two-ring Jabalpur geofence (60 km core / 95 km zone), haversine-driven | v1 | **v1** |
| FR-02 | 10-city MP gazetteer with computed in-zone set | v1 | **v1** |
| FR-03 | 46-city national gazetteer, plotting only, cannot breach | v1 | **v1** |
| FR-04 | Synthetic intel streamer, 7 templates × 4 categories | v1 | **v1** |
| FR-05 | Pre-tagged entity extraction on the feed | v1 | **v1** |
| FR-06 | Threat state machine NOMINAL → ELEVATED → CRITICAL with decay | v1 | **v1** |
| FR-07 | Geofence breach detection, sirens, toasts, counters | v1 | **v1** |
| FR-08 | Leaflet map, 4 basemaps, heat-sized markers, fly-to | v1 | **v1** |
| FR-09 | Alert log with status / assignee / note, capped 200 | v1 | **v1** |
| FR-10 | Notification centre drawer | v1 | **v1** |
| FR-11 | Case records with localStorage persistence | v1 | **v1** |
| FR-12 | Records modal: table, 5 charts, report, JSON export | v1 | **v1** |
| FR-13 | Live NER analyzer, server-side, honest engine badge | v1 | **v1** |
| FR-14 | Wallet cluster tracker | v1 | **v1** |
| FR-15 | Handle watch list | v1 | **v1** |
| FR-16 | Threat analytics: 90 s activity buckets, spike index | v1 | **v1** |
| FR-17 | Jabalpur zone monitor panel | v1 | **v1** |
| FR-18 | LIVE OSINT mode: HN + Google News + Reddit | v1 | **v1** |
| FR-19 | NextAuth credentials auth, bcrypt, middleware-protected dashboard | v1 | **v1** |
| FR-20 | Guided tour | v1 | **v1** |
| FR-21 | Landing, about and docs pages | v1 | **v1** |
| FR-22 | Tactical design system, radius ≤ 4 px, no gradients off-palette | v1 | **v1** |
| FR-23 | Breach audio, mutable | v1 | **v1** |
| FR-24 | Zero-key, zero-cost operation | v1 | **v1** |
| FR-25 | Repository audit with verified invariants | 1 | **done** |
| FR-26 | Regression tests on the geofence and extractor | 1 | **done** |
| FR-27 | No emoji or decorative glyphs in rendered UI | 1 | **done** |
| FR-28 | Monorepo layout (`web/` + `engine/` + `anchor/`) | 2 | **done** |
| FR-29 | Containerised Neo4j (GDS) + PostgreSQL (pgvector) | 2 | **done** |
| FR-30 | FastAPI engine, all keys optional, honest degradation | 2 | **done** |
| FR-31 | Three-way mode: DEMO · DATASET · LIVE | 2 | **done** |
| FR-32 | Server-side engine proxy — no engine URL in the browser | 2 | **done** |
| FR-33 | Autonomous scheduler + `/sources` freshness reporting | 2 | **done** |
| FR-34 | Public dataset loaders (Gwern DNM, Kaggle Agora) | 3 | **done** |
| FR-35 | Ground-truth testbed with four labelled cases, fixed seed | 3 | **done** |
| FR-36 | Deep extraction: PGP, onion v3, XMR, spaCy + MuRIL Hinglish NER | 3 | **done** |
| FR-37 | Identity graph in Neo4j with typed, weighted relationships | 4 | **done** |
| FR-38 | Splink probabilistic record linkage with trained m/u weights | 4 | **done** |
| FR-39 | GDS actor resolution: WCC, Louvain, FastRP embeddings | 4 | **done** |
| FR-40 | Stylometry with Hinglish markers + LaBSE embeddings | 5 | **done** |
| FR-41 | Behavioural profiling and rebrand change-point detection | 5 | **done** |
| FR-42 | Counter-deception: mimicry and LLM-rewrite detection | 5 | **done** |
| FR-43 | Passive onion → clearnet infrastructure pivoting (crt.sh, JARM) | 6 | **done** |
| FR-44 | Evidence fusion: root-cause collapse, reliability dampening, caps | 7 | **done** |
| FR-45 | Isotonic calibration + split-conformal false-merge guarantee | 7 | **done** |
| FR-46 | Immutable audit ledger: keccak hash chain + Ed25519 signatures | 8 | **done** |
| FR-47 | Per-case Merkle root + single-record inclusion proofs | 8 | **done** |
| FR-48 | Sepolia anchoring with visible LOCAL CHAIN Anvil fallback | 8 | **done** |
| FR-49 | CSV / JSON / PDF export carrying root, tx hash and chain id | 8 | **done** |
| FR-50 | 3D actor graph with timeline scrubber | 9 | roadmap |
| FR-51 | Evidence trail Sankey with visible LR maths | 9 | **done** (table + bars; d3 Sankey roadmap) |
| FR-52 | MapLibre tilted map with extruded heat and actor footprint | 9 | roadmap |
| FR-53 | Accessibility: focus trap, aria-live, `prefers-reduced-motion` | 9 | **done** |
| FR-54 | Responsive contract at 1440 / 1024 / 390 px | 9 | **done** |
| FR-55 | Production security: secret enforcement, rate limits, RBAC | 10 | **done** |
| FR-56 | Reproducible metrics pipeline | 10 | **done** |

**Roadmap rows are roadmap, not done.** FR-50 (3D force graph) and FR-52 (MapLibre tilted map) were
cut in DEC-044; the Siamese authorship model was cut in DEC-023. Leaflet works and the tilt is
presentation rather than capability. These are described as roadmap on stage, never as shipped.

## Setup in five commands

```bash
git clone <repo> && cd Prahari
npm install                                   # web workspace
(cd engine && uv venv --python 3.12 && uv pip install -e ".[dev]")
docker compose up -d                          # neo4j + postgres
npm run demo                                  # everything, in order, ~10s
```

Then open http://localhost:3000 and log in as `officer@mp.gov.in` / `prahari123`.
The demo account is **disabled in production** and the app **refuses to boot** in production without
`NEXTAUTH_SECRET`.

| Command | What it does |
|---|---|
| `npm run demo` | starts datastores, local chain, contract, engine and web, then waits until each answers |
| `npm run test:all` | web + engine + Solidity suites |
| `npm run e2e` | the 25-assertion browser journey |
| `python -m engine.fusion.eval` | regenerates every metric in `docs/METRICS.md` |

## Measured results

| Metric | Value |
|---|---|
| Calibrated confidence, worked example | **0.84** against a naive **0.999** |
| False-merge rate at α = 0.05 | **3.1%**, guarantee holds |
| Precision / F1 at τ | **1.000 / 0.938** |
| Brier / ECE | **0.0053 / 0.0051** |
| Splink precision / recall | **1.000 / 0.818** (130/130 reachable) |
| False merges over 3,180 unrelated pairs | **0** |
| Agora listings ingested | **109,689** across 3,192 vendors |
| `anchor()` gas | **95,232** |
| Cold start | **10 s** |
| Tests | 236 engine · 95 web · 12 Solidity · 25 e2e |

## Every external service, and whether it needs a key

| Need | Service | Key |
|---|---|---|
| Certificate transparency | certspotter (primary), crt.sh (failover) | **none** |
| Host fingerprints | Shodan **InternetDB** | **none** |
| BTC data | mempool.space | **none** |
| Map tiles | CartoDB / OpenStreetMap | **none** |
| OSINT | HN Algolia, Google News RSS, Reddit | **none** |
| Datasets | Kaggle Agora, Gwern DNM archives | free account, manual |
| Chain | Ethereum Sepolia via publicnode, or local Anvil | **none** |
| LLM extraction *(optional)* | Groq free tier | free key |
| ETH history *(optional)* | Etherscan free tier | free key |

**Zero keys are required to run the full demo.** The two optional keys enrich features that degrade
honestly without them.

Status is authoritative in [`PROGRESS.md`](PROGRESS.md). Design decisions and their reasons are in
[`docs/DECISIONS.md`](docs/DECISIONS.md); the v1 audit is in [`docs/AUDIT_V1.md`](docs/AUDIT_V1.md).

---

## Table of Contents

**Part I — The Concept**
[1. What is PRAHARI?](#1-what-is-prahari-in-plain-english) ·
[2. The model, worked end-to-end](#2-the-model--how-one-message-becomes-an-alert) ·
[3. The geofence, precisely](#3-the-geofence-precisely) ·
[4. DEMO vs LIVE mode](#4-demo-mode-vs-live-mode--is-the-data-real) ·
[5. The honest thesis](#5-the-honest-thesis-read-this--its-the-whole-point) ·
[6. Why it matters](#6-why-it-matters)

**Part II — Functional Specification**
[7. Feature reference (FR-01 … FR-24)](#7-functional-specification) ·
[8. User roles & journeys](#8-user-roles--journeys) ·
[9. Screen-by-screen reference](#9-screen-by-screen-reference)

**Part III — Architecture**
[10. System architecture](#10-system-architecture) ·
[11. Request & data flows](#11-request--data-flows) ·
[12. Rendering strategy](#12-rendering-strategy-server-vs-client)

**Part IV — Code Analysis**
[13. File inventory](#13-file-inventory) ·
[14. `lib/` — the domain layer](#14-lib--the-domain-layer) ·
[15. `store/` — the state engine](#15-store--the-state-engine) ·
[16. `app/api/` — the server routes](#16-appapi--the-server-routes) ·
[17. `components/` — the UI layer](#17-components--the-ui-layer) ·
[18. `app/` — pages, layout, middleware](#18-app--pages-layout-middleware)

**Part V — Reference**
[19. Data models & types](#19-data-models--type-reference) ·
[20. Algorithms explained](#20-algorithms-explained) ·
[21. HTTP API reference](#21-http-api-reference) ·
[22. Design system](#22-design-system-reference)

**Part VI — Non-Functional**
[23. Performance](#23-non-functional-performance) ·
[24. Security & privacy](#24-non-functional-security--privacy) ·
[25. Reliability & offline](#25-non-functional-reliability--offline-behaviour) ·
[26. Accessibility & responsiveness](#26-non-functional-accessibility--responsiveness) ·
[27. Cost & scalability](#27-non-functional-cost--scalability)

**Part VII — Operations**
[28. Setup & configuration](#28-setup--configuration) ·
[29. Deployment](#29-deployment) ·
[30. Testing & QA status](#30-testing--qa-status) ·
[31. Known limitations & tech debt](#31-known-limitations--technical-debt) ·
[32. Extending PRAHARI](#32-extending-prahari) ·
[33. Demo script](#33-the-30-second-demo-script) ·
[34. FAQ](#34-faq) ·
[35. Glossary](#35-glossary) ·
[36. Guardrails](#36-guardrails-baked-in-non-negotiable)

---
---

# PART I — THE CONCEPT

## 1. What is PRAHARI? (in plain English)

Imagine a security guard who reads every "for sale" advert posted by criminals on the dark
web. He can't see *who* posted it (the dark web hides that), but he **can** read *what* they
wrote — and criminals almost always say **where they deliver**: *"MDMA, delivery across
Jabalpur and Katni"*.

PRAHARI is that guard, automated. It:

1. **Reads** dark-web-style listings (marketplaces, forums, paste sites).
2. **Extracts** the important bits — the **city**, the **contraband**, the **crypto wallet**, the **@handle**.
3. **Checks the city against a map of Jabalpur.** If the crime names a city inside Jabalpur's
   jurisdiction, it **sounds the alarm** — a red siren on the map, a breach alert, a rising
   threat level.
4. **Connects the dots** — the same wallet or handle appearing in different listings links
   otherwise-separate criminals.
5. **Hands the officer a lead** — everything is logged, case-managed, and exportable as a report.

That's the whole idea: **turn openly-published dark-web crime into a local, actionable map.**

---

## 2. The model — how one message becomes an alert

Say this listing appears in the feed:

```
Marketplace listing: MDMA & LSD, delivery across Jabalpur and Katni.
Contact @nightowl_mp. BTC bc1q7xk3f2m9v0…
```

Here is exactly what PRAHARI does with it, with the responsible code path:

| Stage | What happens | Result for this example | Code |
|-------|--------------|--------------------------|------|
| **1. Ingest** | A new intercept arrives in the Live Intel Feed | Card appears, newest on top | `store/intel.ts → tick()` |
| **2. Extract** | NER tags the entities | `Jabalpur`, `Katni` · `MDMA`, `LSD` · `bc1q7x…` · `nightowl_mp` | `lib/mockIntel.ts` (pre-tagged) / `lib/extractor.ts` (live) |
| **3. Geofence** | Each city is measured against Jabalpur | `Jabalpur` = **in-zone** ✅ · `Katni` = **in-zone** ✅ | `lib/cities.ts → isInJabalpurZone()` |
| **4. Alert** | In-zone hit → breach | Map sirens · toast **"GEOFENCE BREACH: JABALPUR"** · Threat Level → **CRITICAL** · counter +1 · Alert Log row · bell badge +1 | `store/intel.ts → ingest()` |
| **5. Report** | Correlate + case-manage + export | `bc1q7x…` seen before → wallet cluster · assign an officer · export JSON / printable report | `store/records.ts`, `panels/AlertLog.tsx` |

If the listing had named **Bhopal** instead (an MP city *outside* Jabalpur), it would still
show on the map — but as a **dim red** marker at **medium** severity, with **no breach**. If it
named **no city at all**, it's **low** severity and just feeds the wallet/handle correlation.

**The exact severity rule (`lib/mockIntel.ts`):**

```ts
const severity =
  !city                      ? "low"      // no location stated
  : isInJabalpurZone(city)   ? "high"     // inside the 95 km neighbour ring
                             : "medium";  // named a city, but outside the ring
```

---

## 3. The geofence, precisely

Jabalpur's jurisdiction is drawn as **two concentric rings** on the map, centred on
`23.1815° N, 79.9864° E`:

| Ring | Radius | Style | Label | Meaning |
|------|--------|-------|-------|---------|
| **Core** | **60 km** | solid, pulsing | `◎ JABALPUR JURISDICTION` | The city and its immediate district |
| **Neighbour** | **95 km** | dashed | `NEIGHBOUR RING · KATNI · NARSINGHPUR` | Adjacent towns under watch |

A city triggers a **breach** if it falls inside the **neighbour ring (≤ 95 km)**.

Crucially, the in-zone set is **not hard-coded** — it is *computed at module load* from real
great-circle distance:

```ts
export const ZONE_CITIES = CITIES.filter((c) => isInJabalpurZone(c.name)).map((c) => c.name);
```

Run the haversine formula over the 10-city MP gazetteer and the answer falls out:

| City | Distance from Jabalpur | In zone? |
|------|------------------------|----------|
| Jabalpur | 0 km | ✅ **yes** |
| Katni | ~83 km | ✅ **yes** |
| Narsinghpur | ~85 km | ✅ **yes** |
| Sagar | ~147 km | ❌ no |
| Satna | ~172 km | ❌ no |
| Rewa | ~198 km | ❌ no |
| Bhopal | ~265 km | ❌ no |
| Ujjain | ~435 km | ❌ no |
| Gwalior | ~380 km | ❌ no |
| Indore | ~430 km | ❌ no |

**Why this matters:** re-districting PRAHARI for Indore or Gwalior is a **data change, not a
code change** — edit `JABALPUR`, the two radii, and `CITIES`. Nothing else moves.

---

## 4. Demo mode vs LIVE mode — is the data real?

The header **DEMO** toggle switches the data source. This is the single most important
control in the app, and the honest answer to *"is your data real?"*

| | **DEMO ON** (default) | **DEMO OFF** (LIVE OSINT) |
|---|---|---|
| **Source** | `lib/mockIntel.ts` — local synthetic generator | `/api/live-intel` — real public internet |
| **Feeds** | 7 templates × 4 categories | Hacker News (Algolia) · Google News RSS (India) · Reddit r/cybersecurity, r/netsec |
| **Cadence** | one intercept every **900–1500 ms** | poll every **9–13 s**, ingest ≤ **4 new items** per poll |
| **Network** | none — works fully offline | outbound HTTPS, 5.5 s timeout per source |
| **Guarantee** | forced Jabalpur breach at **6 s**, Katni at **15 s** | none — depends on real news |
| **Badge** | `● DEMO` | `● LIVE OSINT` / `◌ CONNECTING` / `○ OFFLINE` |
| **Entities** | pre-tagged at generation time | extracted live by the same regex/gazetteer pipeline |
| **Geofence** | identical `isInJabalpurZone()` | identical `isInJabalpurZone()` |

**LIVE mode is the proof.** The *exact same* NER → geofence → alert pipeline runs on real
headlines like *"ShinyHunters has leaked the data of multiple companies"*. Only the
**ingestion source** is simulated in DEMO mode.

> **We never scrape the Tor dark web** — that's illegal and impossible to do honestly.
> In production you swap in a *licensed* dark-web content feed at the ingestion layer.
> **Nothing else in the codebase changes.** That is the whole point of the architecture.

Switching modes calls `setDemoMode()`, which **clears** the feed, city heat, pulses and threat
level (so a mode switch starts visually clean) but **keeps** cumulative counters and the alert
log — because those are the permanent record.

---

## 5. The Honest Thesis (read this — it's the whole point)

> **We do NOT deanonymize the Tor network. We cannot, and we never pretend to.**

The dark web is anonymous *by design* — you cannot geolocate a Tor user's IP. Any tool that
claims to is lying or breaking the law.

PRAHARI does something **honest and legal** instead: it reads the **public content** of criminal
listings and geofences on the **locations the criminals state themselves**. A marketplace
*must* advertise where it ships, so the location leaks in the text. That's
**content-based geospatial intelligence — not network deanonymization.**

- **Is the demo data real?** No. Every DEMO intercept is **synthetic**, generated locally at the
  *category* level (a contraband type + a city + a handle + a wallet). No real dark-web access,
  no Tor, no scraping, no illegal content, no how-to content.
- **Is any data real?** Yes — LIVE mode ingests genuine public OSINT from three free APIs.
- **Is it legal / private?** Yes. It reads public criminal-market content, not private citizens.
  No interception, no deanonymization. Every lead is auditable to its public source.

---

## 6. Why it matters

- Narcotics, weapon parts, stolen Aadhaar/PAN dumps and counterfeit currency are advertised
  openly on Tor, **naming Indian cities** as delivery points.
- National threat feeds don't zoom into a single district; local cyber cells have never had a
  console built for that **last mile**.
- PRAHARI is **local** (built for Jabalpur), **honest** (no fake deanonymization), **actionable**
  (exports real leads, manages cases) and **free** (₹0 to run).

---
---

# PART II — FUNCTIONAL SPECIFICATION

## 7. Functional Specification

Every capability, with a stable ID, the module that implements it, and its acceptance criteria.

### 7.1 Public site

| ID | Feature | Implementation | Behaviour |
|----|---------|----------------|-----------|
| **FR-01** | Landing page | `app/page.tsx` (346 L) | Hero + stat strip, 3-card problem section, insight diagram, 9 capability cards, 6 USP cells, 5-stage pipeline, final CTA |
| **FR-02** | Live feed preview | `components/home/FeedTicker.tsx` | Vertically marqueeing synthetic intercepts on the landing hero (`animate-marqueeUp`) |
| **FR-03** | Insight diagram | `components/home/InsightDiagram.tsx` | Visual "we geofence what they say, not the network" explainer |
| **FR-04** | About page | `app/about/page.tsx` (167 L) | Mission, problem-in-MP, honest approach, 4 differentiating principles |
| **FR-05** | Docs page | `app/docs/page.tsx` (220 L) | 6 anchored sections — Overview, How It Works, How To Use, Features, Tech Stack, FAQ — with a sticky sidebar (`DocsSidebar.tsx`) and an accordion FAQ (`Faq.tsx`) |
| **FR-06** | Shared shell | `components/public/PublicShell.tsx` | `TopNav` + `<main>` + `Footer` on every public page |

### 7.2 Authentication

| ID | Feature | Implementation | Behaviour |
|----|---------|----------------|-----------|
| **FR-07** | One-click demo login | `components/auth/LoginForm.tsx` | Prefills `officer@mp.gov.in` / `prahari123` and immediately calls `signIn()` |
| **FR-08** | Credential sign-in | `lib/auth.ts` + NextAuth | Email + password → `verifyCredentials()` → bcrypt compare → JWT session |
| **FR-09** | Account creation | `app/api/signup/route.ts` + `lib/users.ts` | Validates email regex, non-empty name, ≥ 6-char password, duplicate rejection; persists bcrypt hash to `data/users.json` |
| **FR-10** | Auto sign-in after signup | `components/auth/SignupForm.tsx` | On 201, immediately calls `signIn()`; distinct error if creation succeeded but sign-in failed |
| **FR-11** | Route protection | `middleware.ts` | `withAuth` on `matcher: ["/dashboard/:path*"]` → unauthenticated redirect to `/login?callbackUrl=…` |
| **FR-12** | Sign out | `components/dashboard/UserMenu.tsx` | `signOut({ callbackUrl: "/" })` |

### 7.3 The Control Room

| ID | Feature | Implementation | Behaviour |
|----|---------|----------------|-----------|
| **FR-13** | Live Intel Feed | `panels/LiveIntelFeed.tsx` + `IntelCard.tsx` | Newest-first animated list, capped at 60. Severity rail, source/channel badge, 2-line snippet, primary city, entity count. Click → detail modal |
| **FR-14** | Intercept detail modal | `IntelDetailModal.tsx` (142 L) | Portalled modal: ID, source/severity/time meta grid, raw listing, all entity chips, in-zone warning, "Open Source Article" (live only), **Locate on Map**, **Create Case** |
| **FR-15** | Geospatial Command | `MapView.tsx` (235 L) | MP map, 10 city markers sized/coloured by threat-heat, two geofence rings, transient sirens, 4 switchable basemaps, per-city popup with distance + "Ping this city" |
| **FR-16** | Map fly-to | `MapFocuser` + `focusOnCity()` | Any alert/city click flies the map to `zoom 8.5` over 1.1 s. Re-clicking the same city re-fires (keyed on a monotonic `seq`) |
| **FR-17** | Threat Level HUD | `ThreatHUD.tsx` | `NOMINAL → ELEVATED → CRITICAL`, time-decaying, with a pulsing glow at CRITICAL |
| **FR-18** | Live NER Analyzer | `panels/LiveNERAnalyzer.tsx` | Paste any text → `POST /api/analyze` → entity chips + honest engine badge (`via Groq` / `via local engine`) → **plots extracted cities on the live map** |
| **FR-19** | Threat Analytics | `panels/ThreatAnalytics.tsx` | 4 animated counters (intercepts, breaches, wallets, handles), contraband bar chart, 90-second / 24-bucket activity sparkline with spike marker |
| **FR-20** | Jabalpur Zone Monitor | `panels/JabalpurZoneMonitor.tsx` | Zone level, in-zone hit count, Katni/Narsinghpur `HEAT n`/`CLEAR` tiles, latest breaches, handle watchlist. Every row pings + flies the map |
| **FR-21** | Wallet Cluster Tracker | `panels/WalletTracker.tsx` | Top-7 recurring addresses ranked by count, proportional bar backdrop, click-to-copy with toast |
| **FR-22** | Alert Log + export | `panels/AlertLog.tsx` | Scrollable breach list; **JSON** blob download; **REPORT** printable window |
| **FR-23** | Notification Center | `NotificationCenter.tsx` (423 L) | Bell + unread badge → portalled drawer. Severity filter, status filter, "Read all", per-alert detail with coords, km-from-Jabalpur, raw text, status buttons, officer assignment, note (saves on blur), Locate, Create Case |
| **FR-24** | Records & Reports | `RecordsModal.tsx` (433 L) | 3 tabs — **Records** (search/filter table + full CRUD editor), **Analytics** (5 recharts), **Reports** (6 stat tiles + 2 JSON exports + printable case report) |
| **FR-25** | Guided tutorial | `TourGuide.tsx` (249 L) | 9-step spotlight walkthrough, auto-starts on first visit, gated on `localStorage`, replayable from the user menu |
| **FR-26** | Breach alerting | `BreachToaster.tsx` + `lib/sound.ts` | Sonner toast (top-center, max 2 visible, 5 s) + a synthesized two-tone WebAudio ping |
| **FR-27** | Operator controls | `HeaderControls.tsx` | DEMO toggle, toast on/off, mute on/off — all persisted in the store for the session |

### 7.4 Case management lifecycle

Two related but distinct workflows:

```
ALERT lifecycle  (store/intel.ts)     New → Acknowledged → Investigating → Closed
                                       + assignee, + note

CASE lifecycle   (store/records.ts)   Open → In Progress → Escalated → Closed
                                       + title, city, category, severity,
                                         assignee, wallet, handle, notes, sourceText
```

An **alert** is a machine-generated geofence event. A **case** is an officer-owned
investigation record. "Create Case" bridges the two (from either the intercept modal or the
alert detail), copying the raw text into `sourceText` so provenance survives.

---

## 8. User roles & journeys

There is exactly **one role** in this build: `officer` (set in `lib/users.ts` for both the demo
account and every signup). `role` is threaded through the JWT and session callbacks and is
present on `session.user.role`, but **no route or UI currently branches on it** — it is
scaffolding for a future SP / Inspector / Constable hierarchy.

**Journey A — the pitch (60 seconds)**
`/` → Launch Console → Use Demo Account → `/dashboard` → tutorial auto-starts → skip →
breach fires at 6 s → threat goes CRITICAL → paste text into NER → export a lead.

**Journey B — the working officer**
Log in → watch the feed → bell shows unread breaches → open drawer → filter to `High` →
open an alert → read the intercept → set **Investigating** → assign **SI A. Yadav** → add a
note → **Locate on Map** → **Create Case** → open Records → export the printable report.

**Journey C — the analyst**
Toggle DEMO off → LIVE OSINT streams real headlines → open Records → Analytics tab →
read severity mix, source breakdown, top mentioned cities, cases by status.

---

## 9. Screen-by-screen reference

### `/dashboard` layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ PRAHARI प्रहरी │  [THREAT LEVEL: CRITICAL] │ ●UPLINK  12:04:33  [DEMO][TS][MU] │
│ MP CYBER CELL   │                          │            [RC][AL 3][OF Officer] │
├───────────────┬──────────────────────────────────────┬───────────────────────┤
│ LIVE INTEL    │        GEOSPATIAL COMMAND            │  THREAT ANALYTICS     │
│ FEED   ●DEMO  │  ┌────────────────────────────────┐  │  ┌────┬────┐          │
│        142 RX │  │   [Dark][Light][Streets][Sat]  │  │  │ 142│  7 │          │
│ ┌───────────┐ │  │                                │  │  ├────┼────┤          │
│ │▌MARKETPLACE│ │  │      ╭─ ─ ─ ─ ─ ─ ─╮          │  │  │  8 │ 12 │          │
│ │ MDMA & LSD│ │  │     ╱   ◎ JABALPUR   ╲         │  │  └────┴────┘          │
│ │ ● Jabalpur│ │  │    │  ●Jabalpur ●Katni│        │  │  ▄▄▄ contraband       │
│ └───────────┘ │  │     ╲   (60/95 km)   ╱         │  │  ╱╲╱╲ activity 90s    │
│ ┌───────────┐ │  │      ╰─ ─ ─ ─ ─ ─ ─╯          │  ├───────────────────────┤
│ │▌FORUM     │ │  │         ●Bhopal  ●Satna        │  │ JABALPUR ZONE MONITOR │
│ │ pistol... │ │  └────────────────────────────────┘  │  Katni HEAT 4 │ Nar.. │
│ └───────────┘ │  ┌────────────────────────────────┐  ├───────────────────────┤
│               │  │ LIVE NER ANALYZER  [Analyze]   │  │ WALLET CLUSTERS       │
│               │  └────────────────────────────────┘  ├───────────────────────┤
│               │                                      │ ALERT LOG [JSON][RPT] │
└───────────────┴──────────────────────────────────────┴───────────────────────┘
   360px                      1fr                              392px
```

Grid: `xl:grid-cols-[360px_1fr_392px]`. Below `xl` it collapses to one scrolling column, and
the ThreatHUD + HeaderControls move into a dedicated mobile bar under the header.

**Overlay layers** (portalled to `document.body`, z-index ordered):

| Layer | z-index | Component |
|-------|---------|-----------|
| Tour spotlight | `1000` | `TourGuide` |
| Notification drawer | `900 / 901` | `NotificationCenter` |
| Modals (records, intercept) | `950` | `RecordsModal`, `IntelDetailModal` |
| Map layer switcher | `600` | `MapView` |
| Map vignette | `500` | `MapPanel` |
| Scanline / CRT overlay | `55 / 60` | `layout.tsx` + `globals.css` |
| Header | `30` | `DashboardHeader` |

---
---

# PART III — ARCHITECTURE

## 10. System architecture

```
                              ┌─────────────────────────┐
   BROWSER                    │      NEXT.JS SERVER     │        EXTERNAL
                              │   (Node runtime)        │
 ┌──────────────┐             │                         │
 │ ControlRoom  │             │  /api/auth/[...nextauth]│──► bcrypt · data/users.json
 │   (client)   │             │  /api/signup            │──► fs write
 │              │             │  /api/analyze           │──► Groq API (optional)
 │  ┌────────┐  │             │  /api/live-intel        │──┬► HN Algolia
 │  │zustand │  │  fetch      │       (20 s cache)      │  ├► Google News RSS
 │  │intel   │◄─┼─────────────┤                         │  └► Reddit JSON
 │  │records │  │             │                         │
 │  └───┬────┘  │             │  MIDDLEWARE (Edge)      │
 │      │       │             │  withAuth /dashboard/*  │
 │  ┌───▼────┐  │             └─────────────────────────┘
 │  │ panels │  │
 │  │ map    │──┼──────────────────────────────────────────► CartoDB / ArcGIS tiles
 │  │ modals │  │
 │  └────────┘  │             SHARED DOMAIN (lib/)
 │              │             cities · indiaCities · mockIntel
 │ localStorage │             extractor · analytics · time · sound
 │ records-v1   │             ▲ imported by BOTH client and server
 │ tour_v1_done │
 └──────────────┘
```

**Layering discipline.** `lib/` is a pure domain layer with no React and no side effects (except
`users.ts`, which is explicitly `import "server-only"`). `store/` owns all mutable runtime
state and all timers. `components/` is presentational and reads the store through selectors.
This means the geofence logic in `lib/cities.ts` is imported *unchanged* by the client map, the
client store, and the server-side `/api/live-intel` route — one source of truth for "what
counts as in-zone."

**The Edge-safety split.** `middleware.ts` runs on the Edge runtime, which cannot load `fs` or
`bcrypt`. So the auth constants were extracted into `lib/authConfig.ts`:

```ts
// lib/authConfig.ts — NO Node-only imports, safe for Edge
export const AUTH_SECRET = process.env.NEXTAUTH_SECRET || "prahari-local-development-secret-…";
export const SIGNIN_PAGE = "/login";
```

Both `middleware.ts` (Edge) and `lib/auth.ts` (Node) import from it. Without this split the
middleware bundle would fail to build.

---

## 11. Request & data flows

### Flow A — the synthetic intercept (DEMO mode)

```
setTimeout(tick, 900–1500ms)
   └─► generateIntercept()                    lib/mockIntel.ts
         ├─ roll city:  32% zone · 48% other MP · 20% none
         ├─ pick template (7) → picks its category (4)
         ├─ pick 1–2 contraband items from that category
         ├─ 72% chance of a handle · 62% chance of a wallet
         ├─ render rawText
         └─ derive severity from the city
   └─► ingest(intercept)                      store/intel.ts
         ├─ walletSet.add() / handleSet.add()      → cumulative distinct counters
         ├─ for each location:
         │    ├─ getAnyCity() → coords
         │    ├─ isInJabalpurZone() → breach?
         │    ├─ cityHeat[city] += breach ? 2 : 1
         │    ├─ lastPulse = { seq: ++pulseSeq, … }   → map siren
         │    └─ if breach: breaches++, lastBreach = {seq}, push AlertLogEntry
         ├─ intercepts = [new, ...old].slice(0, 60)
         ├─ alertLog   = [...new, ...old].slice(0, 200)
         └─ threatLevel = computeThreat(lastBreachAt, lastMpAt)
   └─► React re-renders every subscribed panel
         ├─ MapView      ← lastPulse.seq  → transient siren, 1800 ms
         ├─ BreachToaster← lastBreach.seq → sonner toast + WebAudio ping
         ├─ ThreatHUD    ← threatLevel
         └─ every analytics panel ← intercepts / counters
```

### Flow B — the LIVE OSINT poll

```
setTimeout(tick, 9000–13000ms)
   └─► GET /api/live-intel
         ├─ cache hit (< 20 s)? → return cached
         └─ Promise.allSettled([ fromHackerNews(), fromGoogleNews(), fromReddit() ])
              ├─ each fetch: AbortSignal.timeout(5500), cache: "no-store"
              ├─ extract(): INDIA_CITY_NAMES gazetteer + 27 threat keywords
              │             + @handle regex + BTC/ETH wallet regex
              ├─ severityFor(locations) — SAME isInJabalpurZone()
              └─ filter isRelevant() — must have a keyword OR a location
         ├─ sort newest-first, slice(0, 40), cache for 20 s
         └─ 0 items → { ok: false, note: "No live OSINT reachable (offline?)" }, HTTP 200
   └─► client: skip ids in liveSeen, ingest at most 4, set liveStatus: "live"
   └─► any throw → liveStatus: "offline"  (badge flips, app keeps running)
```

### Flow C — manual NER analysis

```
User pastes text → [Analyze]
   └─► POST /api/analyze { text }
         ├─ 400 on invalid JSON or empty text
         ├─ text.slice(0, 4000)                    ← input cap
         └─ analyze()                              lib/extractor.ts
              ├─ GROQ_API_KEY set? → groqExtract()
              │     model llama-3.3-70b-versatile, temperature 0
              │     system: "return ONLY minified JSON … No prose."
              │     content.match(/\{[\s\S]*\}/) → JSON.parse → asArr() coercion
              │     any throw → fall through
              └─ localExtract()  gazetteer + regex, deterministic
   └─► { ok: true, entities, source: "groq" | "local" }
   └─► registerCities(locations, "analysis")
         └─ SAME breach path as ingest() → pulses, alerts, threat escalation
```

The NER analyzer is not a toy: analyzing *"LSD delivery in Jabalpur"* produces a **real
breach**, a real alert-log row, and a real map siren.

### Flow D — authentication

```
LoginForm → signIn("credentials", { email, password, redirect: false })
   └─► POST /api/auth/callback/credentials
         └─ authorize()                            lib/auth.ts
              └─ verifyCredentials()               lib/users.ts  (server-only)
                   ├─ getAllUsers() = [DEMO_USER, ...JSON.parse(data/users.json)]
                   ├─ find by lowercased email
                   └─ bcrypt.compare(password, passwordHash)
         └─ jwt callback   : token.id, token.role ← user
         └─ session callback: session.user.id/.role ← token
   └─► router.push(callbackUrl || "/dashboard") ; router.refresh()

Any /dashboard request → middleware.ts withAuth → no token? → 302 /login?callbackUrl=…
```

---

## 12. Rendering strategy (server vs client)

| Module | Directive | Why |
|--------|-----------|-----|
| `app/layout.tsx` | Server | Fonts, metadata, static chrome |
| `app/page.tsx`, `about`, `docs` | Server | Fully static marketing content — zero JS shipped for the copy |
| `app/dashboard/page.tsx` | Server (12 lines) | Only exports metadata and renders the client `ControlRoom` |
| `app/providers.tsx` | `"use client"` | `SessionProvider` + Sonner `<Toaster>` — mounted **once**, app-wide |
| `ControlRoom` and all panels | `"use client"` | Timers, zustand subscriptions, DOM measurement |
| `MapView` | `"use client"` + **`dynamic({ ssr: false })`** | Leaflet touches `window` at import time — SSR would crash |
| `lib/users.ts` | `import "server-only"` | Hard compile-time guarantee that `fs`/bcrypt never bundle to the browser |
| `middleware.ts` | Edge | Uses only `authConfig.ts` |

The `ssr: false` dynamic import in `MapPanel.tsx` also supplies a themed loading state
(`INITIALISING TACTICAL MAP…`), so there is no layout shift while the ~150 KB Leaflet chunk
loads.

---
---

# PART IV — CODE ANALYSIS

## 13. File inventory

Every source file, its size, and its single responsibility.

### `lib/` — domain layer (773 lines)

| File | L | Responsibility |
|------|---|----------------|
| `mockIntel.ts` | 215 | Synthetic intercept generator; contraband taxonomy; `Intercept` type |
| `users.ts` | 120 | Server-only user store; bcrypt; `data/users.json` persistence |
| `extractor.ts` | 108 | NER: Groq path + deterministic local fallback |
| `cities.ts` | 85 | MP gazetteer, haversine, the two geofence rings, in-zone predicates |
| `analytics.ts` | 78 | Pure selectors: wallet clusters, handle watch, activity buckets, spike |
| `indiaCities.ts` | 68 | 46-city national gazetteer for LIVE-mode plotting |
| `auth.ts` | 51 | NextAuth options: Credentials provider, jwt/session callbacks |
| `sound.ts` | 37 | WebAudio two-tone breach ping (no audio asset) |
| `time.ts` | 16 | `relativeTime()` and `clockString()` |
| `authConfig.ts` | 11 | Edge-safe auth constants |

### `store/` — state engine (543 lines)

| File | L | Responsibility |
|------|---|----------------|
| `intel.ts` | 417 | The engine: streamer, counters, threat state machine, city heat, alert log, case actions |
| `records.ts` | 126 | Persisted case-record CRUD (localStorage) + 3 seed cases |

### `app/` — routes & pages (1,072 lines)

| File | L | Responsibility |
|------|---|----------------|
| `page.tsx` | 346 | Landing page |
| `docs/page.tsx` | 220 | Documentation |
| `api/live-intel/route.ts` | 221 | Real OSINT aggregator (3 sources, cached) |
| `about/page.tsx` | 167 | Mission page |
| `providers.tsx` | 35 | SessionProvider + Toaster |
| `login/page.tsx` | 33 | Login shell |
| `layout.tsx` | 30 | Root layout, fonts, background layers |
| `signup/page.tsx` | 28 | Signup shell |
| `api/signup/route.ts` | 23 | Account creation endpoint |
| `api/analyze/route.ts` | 21 | Server-side NER endpoint |
| `dashboard/page.tsx` | 12 | Protected control-room entry |
| `api/auth/[...nextauth]/route.ts` | 6 | NextAuth handler |
| `fonts.ts` | — | 4 `next/font/google` families as CSS vars |
| `globals.css` | ~450 | Design system, Leaflet theming, Sonner theming, animations |

### `components/dashboard/` (2,167 lines)

| File | L | Responsibility |
|------|---|----------------|
| `RecordsModal.tsx` | 433 | 3-tab records / analytics / reports modal |
| `NotificationCenter.tsx` | 423 | Bell, drawer, filters, alert detail, case actions |
| `TourGuide.tsx` | 249 | 9-step spotlight onboarding |
| `MapView.tsx` | 235 | Leaflet map, rings, markers, sirens, basemaps |
| `IntelDetailModal.tsx` | 142 | Full intercept detail + Locate + Create Case |
| `ControlRoom.tsx` | 115 | 3-column grid, lifecycle (`start`/`stop`) |
| `IntelCard.tsx` | 93 | Animated feed card |
| `EntityChips.tsx` | 68 | Typed entity chip renderer |
| `DashboardHeader.tsx` | 64 | Header composition |
| `UserMenu.tsx` | 62 | Profile dropdown, replay tour, sign out |
| `HeaderControls.tsx` | 62 | DEMO / toasts / mute toggles |
| `ThreatHUD.tsx` | 53 | Threat-level gauge |
| `BreachToaster.tsx` | 44 | Store breach events → toast + ping |
| `RecordsButton.tsx` | 33 | Records launcher + global open event |
| `MapPanel.tsx` | 26 | `ssr: false` map wrapper + vignette |
| `AnimatedNumber.tsx` | 20 | framer-motion counter tween |
| `Clock.tsx` | 19 | 1 Hz HH:MM:SS |
| `SourceBadge.tsx` | 18 | Source pill |

### `components/dashboard/panels/` (664 lines)

| File | L | Responsibility |
|------|---|----------------|
| `ThreatAnalytics.tsx` | 152 | Counters + contraband chart + activity sparkline |
| `LiveNERAnalyzer.tsx` | 143 | Paste → analyze → plot |
| `JabalpurZoneMonitor.tsx` | 138 | Zone level, neighbour ring, breaches, handle watch |
| `AlertLog.tsx` | 116 | Alert list + JSON + printable report |
| `WalletTracker.tsx` | 71 | Wallet cluster ranking |
| `LiveIntelFeed.tsx` | 44 | Feed list + detail modal wiring |

### `components/` — public, auth, ui, home, docs (911 lines)

| File | L | Responsibility |
|------|---|----------------|
| `auth/LoginForm.tsx` | 125 | Demo login + credential form |
| `auth/SignupForm.tsx` | 105 | Registration + auto sign-in |
| `public/TopNav.tsx` | 104 | Public navigation |
| `public/Footer.tsx` | 84 | 4-column footer |
| `home/FeedTicker.tsx` | 69 | Landing marquee preview |
| `docs/Faq.tsx` | 64 | Accordion FAQ |
| `home/InsightDiagram.tsx` | 56 | Thesis diagram |
| `docs/DocsSidebar.tsx` | 49 | Sticky doc nav |
| `auth/AuthShell.tsx` | 48 | Centered auth layout |
| `ui/TacticalPanel.tsx` | 45 | **The workhorse panel primitive** |
| `public/SectionHeading.tsx` | 39 | Kicker + rule + title |
| `ui/Logo.tsx` | 31 | Wordmark |
| `public/PublicShell.tsx` | 14 | Nav + main + footer |

---

## 14. `lib/` — the domain layer

### `lib/cities.ts` — the geospatial source of truth

```ts
export const JABALPUR = { name: "Jabalpur", lat: 23.1815, lng: 79.9864 };
export const GEOFENCE_CORE_KM = 60;
export const GEOFENCE_ZONE_KM = 95;
export const CITIES: City[] = [ /* 10 MP cities */ ];
```

**Key exports and their contracts:**

| Export | Signature | Notes |
|--------|-----------|-------|
| `getCity(name)` | `string → City \| undefined` | Case-insensitive lookup against a precomputed `CITY_MAP` (O(1)) |
| `getAnyCity(name)` | `string → City \| undefined` | MP set **first**, then the national gazetteer. Used for plotting |
| `haversineKm(a, b)` | `→ number` | Great-circle, R = 6371 km |
| `isInJabalpurZone(name)` | `→ boolean` | **The breach predicate.** Only consults the MP map |
| `isInCore(name)` | `→ boolean` | ≤ 60 km — currently exported but unused by the UI |
| `ZONE_CITIES` / `OTHER_CITIES` | `string[]` | Computed at module load by filtering `CITIES` |

**The critical design detail:** `isInJabalpurZone()` calls `getCity()`, **not** `getAnyCity()`.
That means a national city surfaced by LIVE OSINT — say Mumbai — can be *plotted* on the map
but can **never** trigger a breach. The geofence set is deliberately narrower than the plotting
set. If this were `getAnyCity()`, the geofence would silently widen to 46 cities and the whole
Jabalpur premise would collapse.

`CITY_MAP` and `INDIA_MAP` are both built once via `Object.fromEntries(...)` at module load, so
every lookup during the streaming loop is a hash hit, not a scan.

### `lib/mockIntel.ts` — the synthetic generator

The file header states the guardrail explicitly:

> *100% offline — no network, no scraping, no real data. Listings are CATEGORY-LEVEL only
> (a contraband type + city + handle + wallet) — never any synthesis or how-to content.
> Entities are PRE-TAGGED deterministically at generation time, so the feed never needs a
> model to look intelligent.*

**Structure:**

```
CONTRABAND: Record<Category, string[]>       Drugs(7) Weapons(5) Data(5) Counterfeit(4)
   └─► CONTRABAND_CATEGORY  reverse index built at load → categoryOf() is O(1)
HANDLES: 12                                  MP-flavoured (@nightowl_mp, @satna_source)
WALLETS: 8                                   ← DELIBERATELY SMALL so addresses recur
TEMPLATES: 7                                 each bound to a source AND a category
```

**Why only 8 wallets?** Because the Wallet Cluster Tracker's entire value proposition is
*"reuse links otherwise-separate sellers."* With a large pool every address would appear once
and the panel would be empty. The small pool guarantees visible clustering within ~30 seconds.
That's a demo affordance chosen with intent, and it's commented as such.

**Generation pipeline:**

```ts
// 1. City roll (or forced, for the demo guarantee)
roll < 0.32 → pick(ZONE_CITIES)      // ~32% in-zone
roll < 0.80 → pick(OTHER_CITIES)     // ~48% other MP
else        → null                   // ~20% no location

// 2. Template picks its own category, so text stays coherent
const template = pick(TEMPLATES);
const items = 1–2 distinct picks from CONTRABAND[template.category];

// 3. Optional entities
const handle = chance(0.72) ? pick(HANDLES) : null;
const wallet = chance(0.62) ? pick(WALLETS) : null;

// 4. Render, then DERIVE severity (never random)
```

The `loc()` helper swaps between a with-city and without-city phrasing so a location-less
listing still reads naturally (`"nationwide delivery"` instead of a dangling `"delivery across"`).

IDs are `INT-0042-K3F` — a monotonic `seq` plus a base-36 salt, so they are both ordered and
collision-resistant across a session.

### `lib/extractor.ts` — two-path NER

```
analyze(text)
  ├─ GROQ_API_KEY present and non-blank?
  │    └─ groqExtract() → llama-3.3-70b-versatile, temperature 0
  │         ├─ system prompt: minified JSON only, four keys, no prose
  │         ├─ res.ok check → throw on non-200
  │         ├─ content.match(/\{[\s\S]*\}/) — tolerates prose wrapping
  │         ├─ JSON.parse
  │         └─ asArr() coercion per field — a hallucinated shape can't crash the route
  │    └─ ANY throw → silently fall through
  └─ localExtract() — always available
```

**`analyze()` is total: it never throws.** Every failure mode (no key, network down, HTTP 500,
malformed JSON, wrong shape) lands in the same place — the local extractor. The UI then
honestly reports which engine actually ran via a badge. That honesty is a deliberate product
decision, not an implementation detail.

**The local extractor's cleverest line** is contraband substring suppression:

```ts
const contraband = dedupe(CONTRABAND_KEYWORDS.filter((kw) => lower.includes(kw)))
  .filter((kw, _i, all) =>
    !all.some((other) => other !== kw && other.includes(kw) && lower.includes(other)));
```

Given *"selling Aadhaar records"*, the keyword list matches both `"aadhaar"` and
`"aadhaar records"`. This filter drops any keyword that is a **substring of another matched
keyword that also appears in the text** — so only the most specific match survives. Without it
every listing would show redundant duplicate chips.

Locations use `\b`-anchored regex so *"Katni"* doesn't match inside a longer word. Wallets use
separate BTC (`bc1…` / `1…` / `3…` with Base58 character classes) and ETH (`0x` + 40 hex) patterns.

### `lib/analytics.ts` — pure selectors

Four side-effect-free functions over `Intercept[]`:

| Function | Returns | Complexity |
|----------|---------|------------|
| `walletClusters(intercepts, limit=7)` | `{wallet, count}[]` sorted desc | O(n·w + k log k) |
| `handleWatch(intercepts, limit=7)` | `{handle, count, lastCity}[]` | O(n·h + k log k) |
| `activityBuckets(intercepts, now, windowMs=90_000, n=24)` | `{t, v}[]` | O(n) |
| `spikeIndex(buckets)` | `number` (−1 if none) | O(n) |

`activityBuckets` maps each intercept's age into one of 24 slots (`n - 1 - floor(age / slot)`),
skipping anything outside the rolling window — so the sparkline always shows exactly the last
90 seconds regardless of how many intercepts are retained.

`handleWatch`'s `lastCity` logic is subtle: it records the **first** city seen for a handle, but
will **upgrade** a `null` to a real city if a later listing supplies one. So a handle first seen
in a location-less listing still gets attributed once a located listing appears.

### `lib/users.ts` — server-only auth store

```ts
import "server-only";   // ← compile-time guarantee, not a convention
```

- `DEMO_USER` is a module constant with `bcrypt.hashSync(DEMO_PASSWORD, 10)` — hashed **once
  per process**, so the demo account survives even if `data/users.json` is missing or corrupt.
- `getAllUsers()` returns `[DEMO_USER, ...fileUsers]` — the demo account can never be shadowed
  or deleted by a signup.
- `ensureFile()` does `mkdir -p data` then `fs.access`, writing `"[]"` if absent — so a fresh
  clone with no `data/` directory works on first signup.
- `readFileUsers()` swallows parse errors and returns `[]` — a corrupt users file degrades to
  "demo account only" rather than a 500.
- Validation: email regex `/^[^@\s]+@[^@\s]+\.[^@\s]+$/`, non-empty name, **≥ 6-char password**,
  duplicate-email rejection. Emails are normalised to lowercase on both write and lookup.
- IDs: `usr_<base36 timestamp>_<6 random chars>`.
- `verifyCredentials()` returns the user **without** `passwordHash` — the hash never leaves the
  module.

### `lib/sound.ts` — synthesized alerting

No audio asset ships, so the app stays fully offline. A lazily-created `AudioContext`
(with `webkitAudioContext` fallback and suspended-context `resume()`) plays a two-tone
**740 Hz → 1180 Hz** sine pair with an exponential gain envelope peaking at `0.14` over 0.5 s.
`playBreachPing(muted)` no-ops when muted or when WebAudio is unavailable. **Muted is the
default** (`muted: true` in the store) — correct behaviour for autoplay policies and for anyone
opening the dashboard in an office.

---

## 15. `store/` — the state engine

### `store/intel.ts` (417 lines) — the heart of the application

#### State shape

```ts
interface IntelState {
  // stream
  intercepts: Intercept[];        // capped at MAX_INTERCEPTS = 60
  running: boolean;
  demoMode: boolean;              // default true
  muted: boolean;                 // default true
  toastsEnabled: boolean;         // default true
  liveStatus: "idle" | "connecting" | "live" | "offline";
  focusTarget: FocusTarget | null;

  // cumulative counters (never decrease)
  totalIntercepts, geofenceBreaches, walletsTracked, handlesFlagged: number;

  // threat state machine
  threatLevel: "NOMINAL" | "ELEVATED" | "CRITICAL";
  lastBreachAt, lastMpAt: number | null;
  lastPulse: MapPulse | null;     // seq-keyed → drives map sirens
  lastBreach: BreachEvent | null; // seq-keyed → drives toasts + ping

  // derived views
  cityHeat: Record<string, number>;
  alertLog: AlertLogEntry[];      // capped at 200
}
```

#### Module-level (deliberately non-reactive) state

```ts
let streamTimer, threatTimer;          // the two clocks
let demoTimers: Timeout[] = [];        // the 6 s / 15 s breach guarantees
let pulseSeq = 0, breachSeq = 0, focusSeq = 0;
const walletSet = new Set<string>();   // cumulative DISTINCT wallets
const handleSet = new Set<string>();   // cumulative DISTINCT handles
const liveSeen  = new Set<string>();   // LIVE OSINT id dedup
```

**Why the `Set`s live outside zustand:** `intercepts` is capped at 60 and rolls over
continuously. If "wallets tracked" were derived from that array it would *decrease* as old
intercepts fell off — which is wrong for a cumulative counter. Keeping distinct values in
module-level `Set`s means the counters are **monotonic and distinct** while the visible feed
stays bounded. Putting them in the store instead would trigger a re-render on every `.add()`
for no visual benefit.

**Why the `seq` counters:** effects key on `lastPulse?.seq` and `lastBreach?.seq`, not on the
value. Two consecutive breaches in the same city produce identical payloads — a value-keyed
effect would not re-fire. A monotonic sequence guarantees every single event produces exactly
one siren and exactly one toast. The same trick makes `focusOnCity()` re-fly the map when you
click the same city twice.

#### The threat state machine

```ts
const CRITICAL_DECAY_MS = 30_000;   // CRITICAL persists ~30 s after the last breach
const ELEVATED_DECAY_MS = 15_000;   // ELEVATED persists ~15 s after the last MP mention

function computeThreat(lastBreachAt, lastMpAt) {
  const now = Date.now();
  if (lastBreachAt && now - lastBreachAt < CRITICAL_DECAY_MS) return "CRITICAL";
  if (lastMpAt    && now - lastMpAt    < ELEVATED_DECAY_MS)  return "ELEVATED";
  return "NOMINAL";
}
```

Called from **two** places: synchronously inside `ingest()`/`registerCities()` (so escalation is
instant), and from a **1 Hz `setInterval`** that only calls `set()` when the level actually
changes (so de-escalation happens on its own without re-rendering every second).

```
                  in-zone city named
   NOMINAL ──────────────────────────────► CRITICAL
      ▲  │                                    │
      │  │ other MP city named                │ 30 s with no breach
      │  ▼                                    ▼
      └── ELEVATED ◄───────────────────────────
           │  15 s with no MP mention
           ▼
        NOMINAL
```

#### `ingest(i)` — the core reducer

```ts
ingest: (i: Intercept) => {
  i.entities.wallets.forEach((w) => walletSet.add(w));
  i.entities.handles.forEach((h) => handleSet.add(h));

  for (const cityName of i.entities.locations) {
    const city = getAnyCity(cityName);          // plot-anywhere
    if (!city) continue;
    const breach = isInJabalpurZone(cityName);  // breach only for MP zone cities
    lastMpAt = i.timestamp;
    cityHeat[cityName] += breach ? 2 : 1;       // in-zone hits weigh double
    lastPulse = { seq: ++pulseSeq, …, breach, source: "feed" };

    if (breach) {
      breaches += 1;
      lastBreach = { seq: ++breachSeq, city, at };
      newAlerts.push({ …, distanceKm: Math.round(haversineKm(JABALPUR, city)), status: "New", read: false });
    } else if (i.live && getCity(cityName)) {
      // LIVE only: a real OSINT item naming a monitored MP city that ISN'T in-zone
      // → a "regional watch" alert at medium severity. Not a breach.
      newAlerts.push({ …, severity: "medium", … });
    }
  }

  set({ intercepts: [i, ...s.intercepts].slice(0, 60),
        alertLog:  [...newAlerts, ...s.alertLog].slice(0, 200),
        …counters, threatLevel: computeThreat(lastBreachAt, lastMpAt) });
}
```

The `else if (i.live && getCity(cityName))` branch is a thoughtful product touch: in LIVE mode,
genuine in-zone Jabalpur breaches are rare (real news rarely names Katni), so the alert centre
would sit empty. This branch surfaces *regional* MP mentions as medium-severity watch items —
useful signal, clearly distinguished from an actual jurisdiction breach.

All mutation happens through **one** `set()` call at the end, so React re-renders once per
intercept rather than once per field.

#### `registerCities(cities, source)` — the manual path

The NER analyzer, map popups, zone-monitor rows and alert "Locate" buttons all funnel through
this. It replays the same breach logic as `ingest()` but stamps `source: "NER"`, severity
`"high"`, and a synthetic `rawText`: *"Manual NER analysis flagged an in-zone mention of X."*
So an officer's manual analysis produces a first-class, auditable alert — not a second-class one.

#### `start()` — the two clocks

```ts
const tick = async () => {
  if (get().demoMode) get().ingest(generateIntercept());
  else                await fetchLiveBatch();
  const delay = demo ? 900 + Math.random() * 600      // 0.9–1.5 s
                     : 9000 + Math.random() * 4000;   // 9–13 s
  streamTimer = setTimeout(tick, delay);
};
streamTimer = setTimeout(tick, 500);                  // first item lands fast

threatTimer = setInterval(/* re-evaluate threat, set() only on change */, 1000);

if (demoMode) {
  demoTimers.push(setTimeout(() => ingest(generateIntercept({ forceCity: "Jabalpur" })), 6000));
  demoTimers.push(setTimeout(() => ingest(generateIntercept({ forceCity: "Katni"    })), 15000));
}
```

**The "breach within 20 seconds, every run" promise is literally these two `setTimeout`s.**
Self-rescheduling `setTimeout` (not `setInterval`) means jitter is possible and a slow LIVE
fetch can never stack overlapping requests.

`stop()` clears all three timer handles and resets them to `null` — and `ControlRoom`'s
`useEffect` cleanup calls it, so React 18 StrictMode's double-mount in development does not
leave orphaned streams running.

#### Case-management actions

```ts
setAlertStatus(id, status)  // also sets read: true — acting on an alert implies reading it
assignAlert(id, assignee)
noteAlert(id, note)
markAllAlertsRead()
```

All four are immutable `map()` updates over `alertLog`.

### `store/records.ts` (126 lines) — persisted case records

```ts
export const useRecords = create<RecordsState>()(
  persist((set) => ({ records: SEED, addRecord, updateRecord, deleteRecord, clearAll }),
          { name: "prahari-records-v1" })
);
```

Backed by `localStorage` under `prahari-records-v1`, so cases **survive a page reload** — while
the live intel stream deliberately does not. That split is correct: the stream is ephemeral
telemetry, the case file is a record.

Ships **3 seed cases** with relative timestamps (26 h / 12 h / 5 h ago) so the Records module is
never empty on first open. `addRecord()` returns the generated ID (`CASE-M3K9F-2A`) so callers
can toast it back to the user — which both `IntelDetailModal` and `NotificationCenter` do.

---

## 16. `app/api/` — the server routes

### `POST /api/analyze` (21 lines)

Thin, defensive wrapper over `lib/extractor.ts`:

```ts
try { body = await req.json() } catch { return 400 "Invalid request." }
if (!text.trim())                     return 400 "Empty text."
const result = await analyze(text.slice(0, 4000));   // ← input cap
return { ok: true, ...result };
```

The `.slice(0, 4000)` bounds both Groq token spend and local regex work. Because `analyze()`
cannot throw, this route has no 500 path.

### `POST /api/signup` (23 lines)

Delegates entirely to `createUser()`. Returns `400 { ok: false, error }` on any validation
failure, `201 { ok: true, user }` on success — where `user` is explicitly the hash-free
projection.

### `GET /api/live-intel` (221 lines) — the OSINT aggregator

`export const dynamic = "force-dynamic"` — never statically cached by Next.

**Resilience design, layer by layer:**

| Layer | Mechanism |
|-------|-----------|
| Per-request timeout | `AbortSignal.timeout(5500)` on every outbound fetch |
| Source isolation | `Promise.allSettled([hn, gnews, reddit])` — one dead source never kills the response |
| Query rotation | HN picks **2 random queries from 10**; Google News **1 of 6**; Reddit **1 of 2 subs** — variety across polls |
| Relevance gate | `isRelevant()` — an item must have ≥ 1 threat keyword **or** ≥ 1 location |
| Volume cap | sort newest-first, `slice(0, 40)` |
| Rate limiting | 20-second in-memory cache (`TTL = 20_000`) |
| Total failure | `{ ok: false, sources, items: [], note: "No live OSINT reachable (offline?)" }` at **HTTP 200** |

**Source adapters:**

```ts
fromHackerNews()  hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=20
                  → id: `hn-${objectID}`  · source "Forum"    · channel "Hacker News"

fromGoogleNews()  news.google.com/rss/search?hl=en-IN&gl=IN&ceid=IN:en
                  → regex-parsed XML, decodeEntities(), strips " - Publisher" suffix
                  → id: `gn-${base64(link).slice(0,18)}` · source "Paste" · channel "Google News"

fromReddit()      reddit.com/r/{cybersecurity|netsec}/new.json?limit=25
                  → custom User-Agent "PRAHARI-OSINT/1.0 (threat-intel demo)"
                  → id: `rd-${id}` · source "Bridge" · channel "r/<sub>"
```

Every adapter emits the identical `LiveItem` shape and runs the same `extract()` +
`severityFor()`, so downstream code cannot tell the sources apart. Adding a fourth source is
one function plus one entry in the `allSettled` array.

**The regex XML parse** (`xml.match(/<item>[\s\S]*?<\/item>/g)`) is pragmatic rather than
correct-by-construction — a real parser would be more robust. It is guarded by `if (!title)
continue` and the whole call is inside `allSettled`, so a parse miss degrades to fewer items,
never an error.

### `GET|POST /api/auth/[...nextauth]` (6 lines)

Stock NextAuth handler re-exported for both verbs.

---

## 17. `components/` — the UI layer

### `ui/TacticalPanel.tsx` — the primitive everything is built on

```tsx
<TacticalPanel title="Live Intel Feed" live tourId="feed" right={<Badge/>}>
  {children}
</TacticalPanel>
```

Props: `title`, `right` (header slot), `brackets` (default `true`), `className`,
`bodyClassName`, `live` (pulsing status dot), `tourId` (emits `data-tour` for the spotlight).
Structure: header row → `.red-rule` gradient → `min-h-0 flex-1` body. The `min-h-0` is load-
bearing — without it the flex body refuses to shrink and internal scroll areas overflow their
parent.

Every dashboard panel is one of these. The visual consistency of the whole console comes from
this single 45-line file.

### `MapView.tsx` — the map, in detail

**Basemaps** — 4 free layers, each carrying a `grade` that maps to a CSS filter:

```ts
{ id: "dark",      url: "…cartocdn.com/dark_all/…",       grade: "dark"      }
{ id: "light",     url: "…cartocdn.com/light_all/…",      grade: "none"      }
{ id: "streets",   url: "…cartocdn.com/rastertiles/voyager/…", grade: "none" }
{ id: "satellite", url: "…arcgisonline.com/…World_Imagery/…", grade: "satellite" }
```

Only the (very dark) dark basemap gets `brightness(1.18) saturate(0.9)`; satellite gets a mild
`saturate(1.05) contrast(1.03) brightness(0.95)`; light and streets are untouched. Applying one
blanket filter to all four would wash out three of them — this is a real correctness detail.

**Markers are hand-built `L.divIcon`s, not `L.marker`:**

```ts
const size  = Math.round(9 + Math.min(heat, 10) * 1.8);         // 9 → 27 px, clamped
const color = heat === 0 ? "#71717A" : isZone ? "#FF3B30" : "#C11030";
const glow  = heat > 0 ? `box-shadow: 0 0 ${6 + heat * 2}px ${color};` : "";
const alpha = heat > 0 ? 1 : 0.55;
```

Size, colour, glow radius and opacity all encode threat-heat simultaneously — a cold city is a
small dim grey dot; a hot in-zone city is a large glowing bright-red dot with a baked-in label.

**The label is baked into the icon HTML**, with an explicit comment explaining why:

> *Bake a readable label into the icon once a city is active (reliable, unlike react-leaflet's
> dynamic `permanent` tooltip).*

That is a workaround for a real react-leaflet limitation — toggling `permanent` on a `<Tooltip>`
after mount does not reliably update — documented at the call site.

**Sirens** are separate transient markers driven by `lastPulse.seq`, removed after **1800 ms**
to match the `sirenExpand` CSS animation duration exactly. Breach sirens render at 160 px,
non-breach at 110 px.

**Two helper map components:**

```tsx
<MapResizer/>   // ResizeObserver → map.invalidateSize() — the standard fix for
                // Leaflet inside a flex/grid panel that resizes after mount
<MapFocuser/>   // watches focusTarget.seq → map.flyTo([lat,lng], 8.5, {duration: 1.1})
```

**Ring labels** are `interactive={false}` markers positioned by offsetting latitude
(`JABALPUR.lat + km / 111`), using the ~111 km-per-degree approximation — accurate enough for a
caption, and far simpler than a projected label layer.

**Per-city popups** show in/out-of-zone status, km from Jabalpur, threat-heat, coordinates, and
a **"Ping this city"** button wired straight to `registerCities([name], "analysis")` — so the
map is an input device, not just a display.

**Extra-city rendering** — cities that became active via LIVE OSINT but aren't in the fixed MP
set get appended:

```ts
const extra = Object.keys(cityHeat)
  .filter((n) => !CITIES.some((c) => c.name.toLowerCase() === n.toLowerCase()))
  .map(getAnyCity).filter(Boolean);
const renderCities = [...CITIES, ...extra];
```

### `NotificationCenter.tsx` — the case-management surface

Portalled to `document.body`, with the reason commented:

> *Drawer — portalled to body so the header's `backdrop-blur` can't trap its `position: fixed`
> inside the header box.*

That is a genuine CSS trap: an ancestor with `backdrop-filter` creates a containing block for
`position: fixed` descendants. Without the portal the drawer would be clipped inside the header.

**Master view:** unread badge (`99+` cap), severity filter (All/High/Med), status `<select>`,
"Read all", and a virtualisable list where each row shows an unread dot, city, relative time,
truncated raw text, severity, status pill and source.

**Detail view:** crosshair headline, a 2×2 meta grid (time, **km from Jabalpur**, source,
coordinates), severity, the raw intercept, a 4-button status grid, an officer `<select>`, and a
note textarea that **saves on blur** (`onBlur={() => noteAlert(alert.id, note)}`) — no explicit
save button, no lost keystrokes.

Two actions close the loop: **Locate on Map** calls `registerCities` + `focusOnCity` **and then
closes the drawer** (`onLocate()`) so the fly-to animation is actually visible — a small
interaction detail that is easy to get wrong. **Create Case** writes into `useRecords` and
toasts the new case ID.

Clicking any row also calls `focusOnCity(a.city)` immediately, so the map is already flying
while you read the detail.

### `TourGuide.tsx` — the onboarding spotlight

**The spotlight technique** is a single CSS trick:

```tsx
style={{ top, left, width, height,
         boxShadow: "0 0 0 9999px rgba(0,0,0,0.74)" }}
```

A 9999 px spread shadow on a transparent, `pointer-events-none` box dims everything *except*
the target rectangle — no SVG mask, no four-div overlay, no clip-path.

**Targeting** is `data-tour` attributes measured with `getBoundingClientRect()`, recomputed on
`resize` and on `scroll` **with capture** (`true`) so scrolling inside a nested panel also
repositions the spotlight.

**Smart placement:** if there is less than 220 px below the target, the card flips above it;
horizontally it centres on the target and clamps to a 12 px viewport margin.

**Lifecycle:** auto-starts 900 ms after mount on first visit, gated by
`localStorage["prahari_tour_v1_done"]`; replayable via the `prahari:start-tour` window event
dispatched from `UserMenu`. 9 steps: welcome → feed → map → threat → NER → analytics → bell →
demo → finish. Clicking anywhere outside the card advances; there are also Back / Next /
Skip / Go controls and a segmented progress bar.

### `RecordsModal.tsx` — records, analytics, reports

**Records tab:** a search box matching across `title + city + assignee + handle + wallet + id`,
a status filter, a live count, and a table with inline Edit / Delete. `RecordEditor` is a
9-field form (title, city `<select>` from `CITIES`, category, severity, status, assignee,
wallet, handle, notes) that creates or updates depending on whether a record was passed.

**Analytics tab:** five recharts — severity donut with a custom legend, source bar chart,
top-6 mentioned cities by threat-heat, cases-by-status, and a full-width 90-second activity
area. All share one `tipStyle` constant for consistent theming.

**Reports tab:** six stat tiles (total/open/escalated/closed records, intercepts, breaches),
two JSON exports (records, alerts) via `Blob` + `URL.createObjectURL`, and a printable case
report. Closes with an honest footnote: *"All data is synthetic in this build."*

### `BreachToaster.tsx` — the alert bridge

44 lines that turn store state into sensory feedback:

```tsx
useEffect(() => {
  if (!lastBreach) return;
  playBreachPing(muted);             // fires even if toasts are off
  if (!toastsEnabled) return;        // user can silence pop-ups independently
  toast.custom(() => <BreachCard/>, { duration: 5000 });
}, [lastBreach?.seq]);               // seq-keyed — every breach fires exactly once
```

Note the ordering: the ping is independent of the toast setting, so an officer can run
"sound-only" mode. Returns `null` — it renders nothing, it is purely an effect bridge.

### `IntelCard.tsx` / `IntelDetailModal.tsx` — the two-tier disclosure

The card is deliberately compact: a severity rail, source-or-channel badge, **2-line clamped**
snippet, primary city and entity count. Full entities and raw text live in the modal. This
keeps 60 cards scannable instead of turning the feed into a wall of chips.

The card strips the `[OSINT]` prefix for display (`replace(/^\[OSINT\]\s*/, "")`) while the
modal shows the raw text verbatim — display polish without destroying provenance.

The modal's `createCase()` derives the case title from the entities
(`${contraband[0]} — ${locations[0]}`) and maps contraband to a category via `categoryOf()`,
falling back to `"Other"`.

---

## 18. `app/` — pages, layout, middleware

### `app/layout.tsx`

Wires four `next/font/google` families onto `<html>` as CSS variables, then stacks the
atmosphere:

```tsx
<body className="crt-lines">
  <div className="tactical-bg" />     {/* fixed grid + radial red glows, z-0 */}
  <Providers>{children}</Providers>
  <div className="scanline-overlay" />{/* sweeping red band, z-60 */}
</body>
```

All three atmosphere layers are `position: fixed` and `pointer-events: none`, so they never
intercept clicks. Every page's content sits at `relative z-10` above them.

### `app/providers.tsx`

Mounts `SessionProvider` and **exactly one** Sonner `<Toaster>`:

```tsx
<Toaster position="top-center" expand={false} visibleToasts={2} gap={8} offset={72}
         toastOptions={{ duration: 3200, style: { background:"#1E1E25", border:"1px solid #E10600" } }} />
```

`visibleToasts={2}` is the anti-overlap guarantee — a burst of breaches collapses into a neat
stacked pile instead of covering the map. `offset={72}` clears the dashboard header.

### `middleware.ts`

```ts
export default withAuth({ secret: AUTH_SECRET, pages: { signIn: SIGNIN_PAGE } });
export const config = { matcher: ["/dashboard/:path*"] };
```

Nine functional lines. The narrow matcher means public pages, static assets and API routes are
never touched by auth middleware — no unnecessary Edge invocations.

---
---

# PART V — REFERENCE

## 19. Data models & type reference

### `Intercept` — the unit of intelligence

```ts
interface Intercept {
  id: string;              // "INT-0042-K3F"
  source: "Marketplace" | "Forum" | "Paste" | "Bridge";
  timestamp: number;       // epoch ms
  rawText: string;         // the listing as published
  entities: Entities;
  severity: "low" | "medium" | "high";
  live?: boolean;          // true → ingested from real OSINT
  channel?: string;        // "Hacker News" | "Google News" | "r/netsec"
  url?: string;            // source article link (live only)
}

interface Entities {
  locations: string[];
  contraband: string[];
  wallets: string[];
  handles: string[];
}
```

The optional `live`/`channel`/`url` trio is what lets a single type carry both synthetic and
real items through one pipeline — the UI branches on `intercept.live` to swap a source badge
for a channel badge and to reveal the "Open Source Article" link.

### `AlertLogEntry` — the officer-facing record

```ts
interface AlertLogEntry {
  id: string;                 // `${interceptId}-${city}` or `ner-${ts}-${city}`
  city: string;
  source: IntelSource | "NER";
  severity: Severity;
  timestamp: number;
  lat: number; lng: number;
  distanceKm: number;         // PRE-COMPUTED from Jabalpur at creation time
  rawText: string;
  status: "New" | "Acknowledged" | "Investigating" | "Closed";
  assignee?: string;
  note?: string;
  read: boolean;
  live?: boolean; channel?: string; url?: string;
}
```

`distanceKm` is computed **once at creation** rather than on every render — the alert list can
hold 200 rows and re-renders on every intercept.

### `CaseRecord` — the investigation file

```ts
interface CaseRecord {
  id: string;                 // "CASE-M3K9F-2A"
  title: string; city: string; category: string;
  severity: "low" | "medium" | "high";
  status: "Open" | "In Progress" | "Escalated" | "Closed";
  assignee: string;
  wallet?: string; handle?: string;
  notes: string;
  sourceText?: string;        // provenance — the originating intercept
  createdAt: number; updatedAt: number;
}
```

### Supporting types

```ts
interface MapPulse   { seq: number; city: string; lat, lng: number; breach: boolean;
                       source: "feed" | "analysis" }
interface BreachEvent{ seq: number; city: string; at: number }
interface FocusTarget{ seq: number; city: string; lat, lng: number }
interface City       { name: string; lat: number; lng: number }
interface Extracted  { locations, contraband, crypto_wallets, handles: string[] }
type LiveStatus      = "idle" | "connecting" | "live" | "offline"
type ThreatLevel     = "NOMINAL" | "ELEVATED" | "CRITICAL"
```

Note that `Extracted` (NER API) uses `crypto_wallets` while `Entities` (intercepts) uses
`wallets` — the NER shape mirrors the JSON key names the LLM is prompted to emit.

### Session augmentation (`types/next-auth.d.ts`)

```ts
declare module "next-auth"      { interface Session { user: { id?, role?, name?, email?, image? } }
                                  interface User    { role?: string } }
declare module "next-auth/jwt"  { interface JWT     { id?: string; role?: string } }
```

### Tunable constants — one table, all the magic numbers

| Constant | Value | File | Effect |
|----------|-------|------|--------|
| `GEOFENCE_CORE_KM` | 60 | `cities.ts` | Solid jurisdiction ring |
| `GEOFENCE_ZONE_KM` | 95 | `cities.ts` | **Breach threshold** |
| `MAX_INTERCEPTS` | 60 | `intel.ts` | Feed retention |
| alert log cap | 200 | `intel.ts` | Alert retention |
| `CRITICAL_DECAY_MS` | 30 000 | `intel.ts` | CRITICAL hold time |
| `ELEVATED_DECAY_MS` | 15 000 | `intel.ts` | ELEVATED hold time |
| demo tick | 900–1500 ms | `intel.ts` | Synthetic intercept rate |
| live tick | 9000–13000 ms | `intel.ts` | OSINT poll rate |
| live batch size | 4 | `intel.ts` | Items ingested per poll |
| demo breach timers | 6 000 / 15 000 ms | `intel.ts` | The 20-second guarantee |
| siren lifetime | 1 800 ms | `MapView.tsx` | Matches `sirenExpand` |
| OSINT cache TTL | 20 000 ms | `live-intel/route.ts` | Upstream rate limiting |
| fetch timeout | 5 500 ms | `live-intel/route.ts` | Per-source abort |
| OSINT item cap | 40 | `live-intel/route.ts` | Response size |
| analyze input cap | 4 000 chars | `analyze/route.ts` | Token/CPU bound |
| activity window | 90 000 ms / 24 buckets | `analytics.ts` | Sparkline resolution |
| bcrypt cost | 10 | `users.ts` | Hash strength |
| min password | 6 chars | `users.ts` | Signup validation |
| `visibleToasts` | 2 | `providers.tsx` | Anti-overlap |
| toast duration | 3 200 / 5 000 ms | `providers.tsx` / `BreachToaster` | Default / breach |
| tour delay | 900 ms | `TourGuide.tsx` | Auto-start on first visit |

---

## 20. Algorithms explained

### 20.1 Haversine great-circle distance

```ts
const R = 6371;                                   // Earth radius, km
const h = sin²(Δφ/2) + cos(φ₁)·cos(φ₂)·sin²(Δλ/2);
return 2 · R · asin(√h);
```

Chosen over the equirectangular approximation because at ~85 km the error would be a
meaningful fraction of the 95 km threshold — and Katni (83 km) and Narsinghpur (85 km) sit
*within 12 km of the boundary*. An approximation could flip them out of the zone and silently
break the entire premise.

### 20.2 Threat-heat accumulation

```ts
cityHeat[city] += isInJabalpurZone(city) ? 2 : 1;
```

In-zone mentions weigh **double**. Heat drives marker size (`9 + min(heat,10)*1.8` px), colour,
glow radius and opacity, and the "Top Mentioned Cities" chart. The `min(heat, 10)` clamp stops
a long-running session from producing an absurd 200 px dot.

Heat is **reset** on a DEMO/LIVE mode switch but **not** decayed over time — it is a
session-cumulative measure, intentionally distinct from the time-decaying threat level.

### 20.3 Threat-level decay

See §15. Two thresholds, evaluated both synchronously on ingest and by a 1 Hz interval, with
the interval calling `set()` only on an actual change.

### 20.4 Wallet clustering

```
count occurrences per address across the live intercept window
  → sort desc → take top 7 → render with a proportional bar (count / max)
count > 1 is styled as a "cluster" (bright red) vs a single sighting (muted)
```

O(n·w) to count, O(k log k) to sort. Correlation strength is *frequency of reuse* — the
simplest signal that actually links separate listings to one operator.

### 20.5 Handle watch with city attribution

```ts
if (!(h in lastCity)) lastCity[h] = city;                    // first sighting wins
else if (lastCity[h] === null && city) lastCity[h] = city;   // but upgrade null → real
```

So a handle first seen in a location-less listing still gets a city once one becomes available.

### 20.6 Activity bucketing + spike detection

```ts
const slot = windowMs / n;                 // 90 000 / 24 = 3 750 ms per bucket
const idx  = n - 1 - Math.floor(age / slot);
// items outside [0, windowMs) are skipped entirely
```

Newest data lands in the rightmost bucket. `spikeIndex()` returns the index of the maximum
bucket when it stands out, `-1` otherwise; the UI renders a `ReferenceDot` and a `▲ SPIKE` label
only when the index is `>= 0`.

### 20.7 LIVE OSINT deduplication

Two independent layers:

1. **Server:** a `Set` inside `fromHackerNews()` dedupes across the two parallel queries.
2. **Client:** the module-level `liveSeen` `Set` in the store skips any previously-ingested id
   across polls — which matters because the 20-second server cache means consecutive polls
   often return an identical payload.

`liveSeen` is cleared on `setDemoMode()`, so toggling back to LIVE re-streams fresh.

### 20.8 Contraband substring suppression

See §14. Keeps only the most specific matched keyword when several overlap.

### 20.9 Sequence-keyed effects

```ts
useEffect(() => { /* fire siren */ }, [lastPulse?.seq]);
```

The pattern that guarantees repeated identical events each produce exactly one visual response.
Applied to pulses (sirens), breaches (toasts + ping) and focus targets (map fly-to).

---

## 21. HTTP API reference

### `POST /api/analyze`

Server-side NER. The Groq key never reaches the browser.

**Request**
```json
{ "text": "MDMA delivery in Jabalpur, contact @x, wallet bc1q7xk3f2m9v0" }
```

**200**
```json
{
  "ok": true,
  "entities": {
    "locations": ["Jabalpur"],
    "contraband": ["mdma"],
    "crypto_wallets": ["bc1q7xk3f2m9v0"],
    "handles": ["@x"]
  },
  "source": "local"
}
```

**400** — `{ "ok": false, "error": "Invalid request." | "Empty text." }`

| Note | |
|---|---|
| Input cap | 4 000 characters |
| `source` | `"groq"` when `GROQ_API_KEY` is set **and** the call succeeded; `"local"` otherwise |
| Failure mode | none — the route cannot 500; Groq failure silently degrades to local |

---

### `POST /api/signup`

**Request** — `{ "name": "Insp. A. Sharma", "email": "a@mp.gov.in", "password": "secret123" }`

**201** — `{ "ok": true, "user": { "id": "usr_…", "email": "…", "name": "…", "role": "officer" } }`

**400** — `{ "ok": false, "error": "…" }`

| Validation | Rule |
|---|---|
| email | `/^[^@\s]+@[^@\s]+\.[^@\s]+$/`, normalised to lowercase |
| name | non-empty after trim |
| password | ≥ 6 characters |
| uniqueness | `"An account with that email already exists."` |

The password hash is never returned.

---

### `GET /api/live-intel`

**200 (success)**
```json
{
  "ok": true,
  "sources": 3,
  "items": [{
    "id": "hn-38472913",
    "source": "Forum",
    "channel": "Hacker News",
    "url": "https://…",
    "timestamp": 1735820400000,
    "rawText": "[OSINT] ShinyHunters has leaked the data of multiple companies",
    "entities": { "locations": [], "contraband": ["leaked","data breach"], "wallets": [], "handles": [] },
    "severity": "low",
    "live": true
  }]
}
```

**200 (cached)** — adds `"cached": true`, skips all upstream calls.

**200 (all sources down)** — `{ "ok": false, "sources": 0, "items": [], "note": "No live OSINT reachable (offline?)." }`

> This route **never returns a non-200**. Failure is expressed in the payload so the client can
> degrade to an `○ OFFLINE` badge rather than surfacing an error.

---

### `GET|POST /api/auth/[...nextauth]`

Standard NextAuth v4 Credentials endpoints (`/signin`, `/callback/credentials`, `/session`,
`/csrf`, `/signout`). JWT strategy; `id` and `role` are threaded into both the token and the
session.

---

## 22. Design system reference

### Palette

| Token | Hex | Role |
|-------|-----|------|
| `black` | `#131318` | Page background |
| `panel` | `#1E1E25` | Panel surface |
| `panel-2` | `#2A2A32` | Raised surface / inputs |
| `border` | `#3A3A44` | Default border |
| `border-2` | `#4C4C58` | Emphasis border |
| `text` | `#F4F4F5` | Primary text |
| `muted` | `#B4B4BE` | Secondary text |
| `muted-2` | `#8A8A96` | Tertiary / labels |
| `red` | `#E10600` | Brand / primary action |
| `red-bright` | `#FF3B30` | Critical / in-zone |
| `red-deep` | `#C11030` | Elevated / out-of-zone |

**Semantic mapping** — colour carries meaning consistently across every surface:

```
red-bright  = high severity · in-zone · CRITICAL · active heat
red-deep    = medium severity · other MP · ELEVATED
muted-2     = low severity · no location · NOMINAL · cold
```

### Typography

| Family | Variable | Used for |
|--------|----------|----------|
| **Anton** | `--font-anton` | `.font-display` — the huge uppercase hero headlines |
| **Space Grotesk** | `--font-grotesk` | `font-heading` — section and card titles |
| **JetBrains Mono** | `--font-mono` | `.mono` — **almost all UI chrome**, with `tnum` figures |
| **Inter** | `--font-inter` | Body copy |

The monospace-dominant UI is what makes the console read as instrumentation. `font-feature-
settings: "tnum" 1` on `.mono` means counters don't jitter as digits change.

### Geometry

**Border radius is flattened globally** — even `lg` maps to `4px` in the Tailwind config.
Nothing in PRAHARI is round. Combined with the `.brackets` corner frames (`::before`/`::after`
pseudo-elements drawing 12 px `[ ]` corners in red), it produces the tactical HUD look.

### Animation vocabulary

| Keyframe | Duration | Where |
|----------|----------|-------|
| `scanline` | 9 s linear ∞ | Full-page red band sweep |
| `pulseDot` | 1.6 s ∞ | Panel "live" status dots |
| `pulseGlow` | 2 s ∞ | ThreatHUD at CRITICAL |
| `flicker` | 4 s ∞ | "SECURE UPLINK" text |
| `pulseRing` | 1.8 s ∞ | Reserved ring pulse |
| `tickerScroll` | 30 s ∞ | Horizontal tickers |
| `marqueeUp` | 20 s ∞ | Landing feed preview |
| `geofencePulse` | 2.4 s ∞ | The core ring's stroke (CSS, applied to the SVG path) |
| `sirenExpand` | 1.8 s once | Map breach siren |

### Atmosphere layers

```css
.tactical-bg      fixed · z-0  · 2 radial red glows + a 32px grid
.crt-lines::before fixed · z-55 · repeating scanlines @ 0.18 opacity
.scanline-overlay  fixed · z-60 · a 160px red band sweeping every 9s
```

All `pointer-events: none`. Content sits at `relative z-10`.

### Reusable CSS primitives

`.panel` · `.brackets` · `.label` · `.hairline` · `.red-rule` · `.mono` · `.font-display` ·
`.slim-scroll` · `.btn` / `.btn-primary` / `.btn-ghost` · `.field`

### Third-party theming

Leaflet is fully re-skinned in `globals.css`: dark container, square zoom controls, custom
`.prahari-tip` tooltips with the arrow suppressed, dark popup wrappers and tips, red close
button on hover. Sonner is themed via `[data-sonner-toast]` attribute selectors so custom
toasts and default toasts match.

---
---

# PART VI — NON-FUNCTIONAL CHARACTERISTICS

## 23. Non-functional: performance

### Bounded memory

| Structure | Bound | Mechanism |
|-----------|-------|-----------|
| `intercepts` | 60 | `.slice(0, MAX_INTERCEPTS)` on every ingest |
| `alertLog` | 200 | `.slice(0, 200)` on every ingest |
| OSINT response | 40 items | `.slice(0, 40)` before caching |
| `sirens` | self-pruning | each removed by `setTimeout` after 1800 ms |
| `cityHeat` | ≤ 56 keys | 10 MP + 46 national gazetteer entries |
| `walletSet` / `handleSet` | 8 / 12 in DEMO | unbounded in LIVE, but real wallets in headlines are rare |

At the demo tick rate (~1 intercept/second) the feed reaches steady state in about a minute and
stays there indefinitely. There is **no unbounded growth path** in a long-running session
except the two `Set`s in LIVE mode, which grow only when real posts contain wallet addresses.

### Render-cost management

- **Selector subscriptions.** Every component subscribes to exactly the slices it needs
  (`useIntel((s) => s.threatLevel)`), so a wallet-only change doesn't re-render the ThreatHUD.
- **One `set()` per ingest.** `ingest()` accumulates all mutations in locals and commits once.
- **Non-reactive module state.** The `Set`s and `seq` counters live outside the store, so
  `.add()` and `++` cause zero re-renders.
- **Threat interval short-circuits.** The 1 Hz timer calls `set()` only when the level changes.
- **Independent clock cadences** — 1 s (Clock, feed relative times), 2 s (analytics `now`),
  1 s (threat) — so the whole UI does not re-render in lockstep.
- **`useMemo`** on the notification filter, which runs over up to 200 alerts.
- **Pre-computed `distanceKm`** on alerts rather than per-render haversine.
- **`isAnimationActive={false}`** on the activity area charts — recharts animation on a chart
  that updates every 2 s would be a permanent animation loop.
- **`AnimatePresence` + `layout`** on feed cards for smooth insertion without manual FLIP.

### Network cost

| Path | Cost |
|------|------|
| DEMO mode | **zero** outbound requests |
| LIVE mode | ≤ 3 upstream fetches per 20 s (cache TTL), each ≤ 5.5 s |
| Map tiles | standard raster tiles, browser-cached |
| `/api/analyze` | one request per manual click; ≤ 4 000 chars |

The 20-second cache means 10 concurrent dashboard users generate the same upstream load as one.

### Bundle strategy

- Public pages are **Server Components** — the marketing copy ships no JS.
- Leaflet (~150 KB) is behind `dynamic({ ssr: false })` and only loads on `/dashboard`.
- `lucide-react` icons are individually imported (tree-shakeable).
- Fonts are self-hosted via `next/font/google` with `display: "swap"` — no render-blocking
  external font request, no FOIT.

---

## 24. Non-functional: security & privacy

### What is done well

| Control | Implementation |
|---------|----------------|
| Password storage | **bcrypt, cost 10**. Plaintext is never persisted |
| Hash exposure | `verifyCredentials()` and `createUser()` both return hash-free projections |
| Server-only isolation | `lib/users.ts` uses `import "server-only"` — a **build-time error** if it is ever imported into a client component |
| API key handling | `GROQ_API_KEY` is read only inside `lib/extractor.ts`, called only from a route handler. Not `NEXT_PUBLIC_`-prefixed, so it cannot be inlined into the client bundle |
| Session strategy | JWT, signed with `AUTH_SECRET` |
| Route protection | Edge middleware on `/dashboard/:path*` — enforced before any page code runs |
| Input validation | Email regex, password length, duplicate check, JSON parse guards, 4 000-char analyze cap |
| Email normalisation | Lowercased on both write and lookup — prevents duplicate accounts differing only by case |
| SSRF surface | Zero. All upstream URLs in `/api/live-intel` are **hard-coded constants**; only the query string is parameterised, and only from an internal fixed pool |
| Outbound link safety | Every external link uses `target="_blank" rel="noopener noreferrer"` |
| Secret in git | `data/users.json` and `.env*.local` are gitignored |

### What must change before production

| Risk | Detail | Fix |
|------|--------|-----|
| **Default auth secret** | `AUTH_SECRET` falls back to a hard-coded string committed to the repo. Anyone with the source can forge a session JWT | Set `NEXTAUTH_SECRET` — the app is only zero-config for local dev |
| **Published demo credentials** | `officer@mp.gov.in` / `prahari123` are printed on the login page and hard-coded in `lib/users.ts` | Gate behind `NODE_ENV !== "production"` |
| **Flat-file user store** | `data/users.json` has no locking; concurrent signups can interleave read-modify-write and lose a record | Move to a real database |
| **No rate limiting** | `/api/signup` and `/api/auth` accept unlimited attempts — brute-forceable | Add per-IP throttling |
| **No CSRF beyond NextAuth** | Custom routes rely on same-origin only | Add explicit CSRF tokens if cookies ever carry state |
| **`document.write` reports** | Print reports build HTML strings and `document.write` into a popup. Record titles/notes are interpolated **unescaped** — a stored-XSS vector if records ever become multi-user | Escape interpolated values, or render to a Blob URL |
| **No audit trail** | Status changes and assignments are not logged with actor + timestamp | Add an append-only audit log — an evidentiary requirement for real police use |
| **Single role** | `role` is threaded through but never enforced | Implement RBAC before multi-user deployment |
| **localStorage records** | Case records are per-browser, unencrypted, and clearable by the user | Server-side persistence |

### Privacy posture

The system's privacy position is structural, not procedural: it processes **public criminal
marketplace content**, never private citizen data. There is no interception, no
deanonymization, no PII collection beyond the officer's own name and email. Every lead traces
back to a public source — LIVE items even carry an "Open Exact Source" link to the original
article.

---

## 25. Non-functional: reliability & offline behaviour

**The core is fully offline-capable.** In DEMO mode, the feed, geofence, alerts, analytics,
NER (local engine), sound and case management all run with **no network at all**. Only the map
tiles require connectivity — and the map's rings, markers and sirens still render over a blank
dark background if tiles fail.

**Graceful-degradation ladder:**

| Failure | Behaviour |
|---------|-----------|
| No `GROQ_API_KEY` | Local extractor runs; UI badges `via local engine` |
| Groq HTTP error / malformed JSON | Silent fallback to local; same badge |
| One OSINT source down | `allSettled` — the other two still return |
| All OSINT sources down | `{ ok: false, note: "…offline?" }` at HTTP 200 → badge flips to `○ OFFLINE`; the app keeps running |
| `/api/live-intel` unreachable | `catch` → `liveStatus: "offline"` |
| Map tile CDN down | Rings, markers and sirens still render |
| Corrupt `data/users.json` | `readFileUsers()` returns `[]`; demo account still works |
| Missing `data/` directory | `ensureFile()` creates it on first write |
| WebAudio unavailable | `playBreachPing()` no-ops |
| Popup blocked | Print report silently skipped (guarded by `if (w)`) |
| Clipboard denied | Copy-wallet's rejection handler is a no-op |
| React StrictMode double-mount | `stop()` clears all timers in the effect cleanup |

**No unhandled rejection path exists in the streaming loop** — `fetchLiveBatch()` wraps
everything in try/catch and the self-rescheduling `setTimeout` continues regardless.

---

## 26. Non-functional: accessibility & responsiveness

### Responsive strategy

| Breakpoint | Layout |
|------------|--------|
| `< md` (768) | Single column. ThreatHUD + HeaderControls move into a dedicated mobile bar under the header. Sub-line and Clock hidden |
| `md – xl` | Single scrolling column; header regains ThreatHUD + controls |
| `≥ xl` (1280) | Full 3-column grid `[360px 1fr 392px]`, each column independently scrollable |

Panels carry `min-h-[520px]` / `min-h-[420px]` floors on small screens so they don't collapse,
and `min-w-0` throughout to let flex children actually truncate instead of overflowing. The
right column uses `shrink-0` on each panel so the **column scrolls** rather than flexbox
squashing panels into each other — a comment in `ControlRoom.tsx` calls this out explicitly.

The notification drawer is `w-full max-w-[420px]` — full-screen on mobile, a side panel on
desktop. The Records modal is `max-h-[92vh] max-w-[1200px]` with `p-2 sm:p-4`.

### Accessibility: current state

**Present:** semantic `<header>`/`<main>`/`<section>`/`<footer>`; `<h1>`/`<h2>`/`<h3>` hierarchy;
every interactive element is a real `<button>` or `<a>` (so keyboard-focusable and
Enter-activatable by default); `title` attributes on most icon-only controls; `aria-label` on
the tour close button; native `<select>` elements for status/assignee (full keyboard support);
form `<label>` elements on all auth inputs; `alt`-free decorative layers correctly marked
`pointer-events: none`.

**Gaps a formal audit would flag:**

- No focus trap in the modals or the drawer — Tab can escape behind the overlay.
- No `Escape`-to-close handler on modals (click-outside works; keyboard does not).
- No `role="dialog"` / `aria-modal="true"` on the portalled overlays.
- No `aria-live` region on the alert feed — a screen reader is not told a breach occurred.
- Icon-only buttons rely on `title` rather than `aria-label` in most places.
- Small type (`text-[8px]`–`text-[10px]`) is used heavily for the tactical aesthetic; some
  muted-on-panel combinations sit below WCAG AA 4.5:1.
- No `prefers-reduced-motion` guard — the scanline, CRT lines, flicker and pulse animations run
  unconditionally, which is a real problem for motion-sensitive users.

These are tractable: a focus-trap hook, an Escape listener, `role`/`aria-modal` attributes, one
`aria-live="polite"` region, and a `@media (prefers-reduced-motion: reduce)` block would close
most of the list.

### Browser support

Requires: CSS Grid, `backdrop-filter`, `ResizeObserver`, `AbortSignal.timeout` (Node 17.3+ /
modern browsers), WebAudio (optional, degrades), `navigator.clipboard` (optional, degrades),
`localStorage`. Effectively: current Chrome, Edge, Firefox and Safari.

---

## 27. Non-functional: cost & scalability

### Cost: ₹0

| Component | Cost |
|-----------|------|
| Next.js, React, Tailwind, zustand, recharts, framer-motion, Leaflet, sonner, lucide | Open source |
| CartoDB + ArcGIS tiles | Free, no key |
| HN Algolia · Google News RSS · Reddit JSON | Free, no key |
| Groq `llama-3.3-70b-versatile` | **Optional**, free tier |
| Auth + user store | Local `fs` + bcrypt |
| Fonts | Self-hosted via `next/font` |

A district cyber cell can stand this up today with **no budget approval and no procurement**.

### Scaling axes

| Axis | Current | Path forward |
|------|---------|--------------|
| **Geographic** | 1 district, 10 MP cities, 46 national | `CITIES` + 2 radii are config — a new district is a data change |
| **Volume** | ~1 intercept/s, 60 retained | Move ingestion server-side; stream over SSE/WebSocket; page the feed |
| **Users** | Single-node, flat-file, per-browser records | Postgres + server-side records + RBAC |
| **Sources** | 3 OSINT adapters + 1 synthetic | Each adapter is ~30 lines emitting a `LiveItem`; add to the `allSettled` array |
| **NER quality** | Gazetteer + regex, or Groq | Swap in a fine-tuned NER model behind the same `analyze()` contract |
| **Retention** | In-memory, session-scoped | Time-series store for historical trend analysis |

**The multi-district story is the strongest scaling argument:** because `ZONE_CITIES` is
*derived* from haversine rather than hard-coded, pointing PRAHARI at Indore means editing three
constants. Nothing in the store, the map, the panels or the API knows the word "Jabalpur"
outside of `lib/cities.ts` and some display copy.

---
---

# PART VII — OPERATIONS

## 28. Setup & configuration

```bash
npm install
npm run dev
# open http://localhost:3000
```

**Log in (one click):** go to **Launch Console → Use Demo Account**. Or type the seeded creds:

```
email:    officer@mp.gov.in
password: prahari123
```

**Build for production:**

```bash
npm run build && npm start
```

That's it — **no accounts, no API keys, no paid services** required.

### Environment variables (both optional)

Copy `.env.local.example` → `.env.local`:

```bash
# Enables the LIVE NER ANALYZER to use Groq instead of the built-in local extractor.
# Server-side only (NOT prefixed NEXT_PUBLIC) so the key never reaches the browser.
# Free key: https://console.groq.com/keys
GROQ_API_KEY=

# NextAuth session-signing secret. A safe default is baked in for local dev,
# so this is only needed for a real deployment.  openssl rand -base64 32
NEXTAUTH_SECRET=
```

**Optional: live NER via Groq (still free)**

1. Get a free key at <https://console.groq.com/keys>.
2. Set `GROQ_API_KEY=gsk_...` in `.env.local`.
3. Restart. The analyzer shows a **"via Groq"** tag; on any failure it silently falls back to
   **"via local engine"**. Model: `llama-3.3-70b-versatile`.

### Runtime configuration surfaces

| Surface | Storage | Scope |
|---------|---------|-------|
| DEMO / LIVE mode | zustand (in-memory) | Session |
| Mute, toasts | zustand (in-memory) | Session |
| Basemap layer | React `useState` in `MapView` | Component |
| Case records | `localStorage["prahari-records-v1"]` | Browser, persistent |
| Tour completion | `localStorage["prahari_tour_v1_done"]` | Browser, persistent |
| User accounts | `data/users.json` | Server, persistent |

### Reset procedures

```
Clear case records   → localStorage.removeItem("prahari-records-v1")   (or Records → clearAll)
Replay the tutorial  → User menu → Replay Tutorial
Reset accounts       → delete data/users.json (the demo account is code-resident, so it survives)
Reset the stream     → reload the page, or toggle DEMO mode
```

---

## 29. Deployment

The app is a standard Next.js 14 App Router application with one important caveat.

**Vercel / serverless:** everything works **except** `data/users.json` persistence — serverless
filesystems are ephemeral and per-instance. The demo account (code-resident) still works, and
so does every other feature, but signups will not survive. Also note the 20-second OSINT cache
is per-instance in-memory, so upstream load scales with instance count.

**Node server / container / VM (recommended):** `npm run build && npm start`. Mount a
persistent volume at `data/` so signups survive restarts.

**Required for any real deployment:**

```bash
NEXTAUTH_SECRET=$(openssl rand -base64 32)   # do NOT ship the baked-in default
NEXTAUTH_URL=https://your-domain             # NextAuth callback resolution
```

**Recommended hardening before a real deployment:** disable the demo account outside
development, add rate limiting on `/api/signup` and `/api/auth`, move users to a database, add
an audit log, and escape interpolated values in the printable reports.

---

## 30. Testing & QA status

**Automated tests: none.** This is stated plainly because it matters.

`playwright ^1.61.1` is present in `devDependencies`, but there is **no test directory, no spec
files, and no test script** in `package.json`. The four scripts are `dev`, `build`, `start`,
`lint` — and `lint` has no ESLint config file, so it would run Next's interactive setup.

**What quality assurance does exist:**

- **TypeScript `strict: true`** across the whole codebase — the primary correctness net.
- **`import "server-only"`** on `lib/users.ts` — a build-time guarantee against client leakage.
- **`HACKATHON_QA.md`** — a 25 KB, 16-section, 140+ question manual QA / demo battle card
  covering the concept, the data-source question, the pipeline, NER, geofencing, glossary,
  features, stack, legality, USP, business model, impact, trick questions, roadmap and live-data
  features.
- **The DEMO-mode determinism guarantee** — the forced 6 s / 15 s breaches make the primary
  user journey reproducible on every single run, which is itself a form of manual test fixture.

**The highest-value tests to write first**, in order:

1. `lib/cities.ts` — assert `ZONE_CITIES` is exactly `["Jabalpur","Katni","Narsinghpur"]`, and
   assert known distances (Sagar > 95, Katni < 95). This is the single most load-bearing
   invariant in the product.
2. `lib/extractor.ts::localExtract` — the substring-suppression filter, wallet regexes, and
   word-boundary city matching.
3. `lib/analytics.ts` — bucket index arithmetic and the `lastCity` null-upgrade rule.
4. `store/intel.ts::ingest` — breach counting, heat weighting (+2/+1), the caps, and the
   `computeThreat` transitions with a mocked clock.
5. A Playwright end-to-end run of Journey A (login → breach within 20 s → CRITICAL) — the
   dependency is already installed.

---

## 31. Known limitations & technical debt

Stated honestly, because a reviewer will find these anyway.

### Product limitations (by design)

- **DEMO data is synthetic.** Deliberate: legal, reproducible, and unbreakable on stage.
- **No Tor access.** Deliberate and permanent — see §5.
- **The geofence is one district.** Deliberate: last-mile focus is the thesis.
- **Case records are per-browser.** `localStorage`, not shared across officers.
- **The intel stream does not persist.** A reload restarts the feed. Cases and users do persist.

### Technical debt

| # | Issue | Impact |
|---|-------|--------|
| 1 | **Two divergent status vocabularies** — alerts use `New/Acknowledged/Investigating/Closed`, cases use `Open/In Progress/Escalated/Closed` | Conceptually defensible (event vs investigation) but undocumented in the UI and easy to confuse |
| 2 | **`OFFICERS` duplicated** in `NotificationCenter.tsx` and `store/records.ts` | Two lists to keep in sync |
| 3 | **Demo credentials in 3 places** — `lib/users.ts`, `LoginForm.tsx`, README | `LoginForm` re-declares them because it's a client component and can't import the `server-only` module. Should live in a shared non-server constants file |
| 4 | **Comment/config drift** — `BreachToaster`'s comment says "capped at 4" but `providers.tsx` sets `visibleToasts={2}` | Stale comment |
| 5 | **`confirm()` for record deletion** | A native browser modal in an otherwise fully custom-modal UI |
| 6 | **Print reports use `document.write` + `window.open`** with unescaped interpolation | Popup-blockable with no user feedback; a latent XSS vector if records become multi-user |
| 7 | **Inconsistent print themes** — `AlertLog`'s report prints dark-on-black; `RecordsModal`'s prints dark-on-white | The former wastes toner and uses off-palette colours (`#0A0A0B`, `#FF2A1F`) |
| 8 | **Google News RSS parsed by regex** | Fragile to markup changes; guarded but not robust |
| 9 | **`activityBuckets(intercepts, Date.now())` called inline in `RecordsModal` render** | Recomputes on every render instead of on a tick |
| 10 | **`isInCore()` is exported but unused** | Dead code, or an unfinished core/neighbour severity distinction |
| 11 | **`EntityChips.tsx` is defined but unused** by the current feed | `IntelCard` renders a compact summary and the modal has its own inline `Chip` |
| 12 | **`playwright` installed with zero tests** | Misleading dependency |
| 13 | **`tsconfig.tsbuildinfo` and `.DS_Store` are committed** despite matching `.gitignore` patterns | Added before the ignore rules took effect; needs `git rm --cached` |
| 14 | **No `prefers-reduced-motion` support** | Accessibility |
| 15 | **No focus trap / Escape handling in modals** | Accessibility |
| 16 | **`role` threaded but never enforced** | RBAC scaffolding only |
| 17 | **Off-palette hex values in print stylesheets** | `#FF2A1F`, `#A1A1AA`, `#0A0A0B` appear in `AlertLog` and chart configs but are not design tokens |

---

## 32. Extending PRAHARI

### Add a new district (the flagship extension)

Edit **one file**, `lib/cities.ts`:

```ts
export const JABALPUR = { name: "Indore", lat: 22.7196, lng: 75.8577 };  // rename + recentre
export const GEOFENCE_CORE_KM = 45;
export const GEOFENCE_ZONE_KM = 80;
export const CITIES: City[] = [ /* the new district's cities */ ];
```

`ZONE_CITIES` and `OTHER_CITIES` recompute automatically from haversine. The store, the map,
every panel and the OSINT route all pick up the new geofence with no further changes. Only
display copy ("JABALPUR JURISDICTION" labels, the zone-monitor title, `NEIGHBOURS`) needs a
find-and-replace.

### Swap the synthetic feed for a licensed dark-web feed

The entire integration surface is one function:

```ts
// store/intel.ts, inside tick()
if (demo) get().ingest(generateIntercept());
else      await fetchLiveBatch();          // ← replace this
```

Any source that produces objects conforming to the `Intercept` interface drops straight in.
NER, geofencing, severity, alerting, correlation, case management and export are all downstream
and unaware of the source. **This is the architectural claim the whole pitch rests on, and it
holds.**

### Add a fourth OSINT source

In `app/api/live-intel/route.ts`, write one adapter emitting `LiveItem[]` and add it to the
`allSettled` array:

```ts
async function fromNewSource(): Promise<LiveItem[]> {
  const data = await fetchJSON("https://…");        // gets the 5.5 s timeout for free
  return data.items.map((d) => {
    const entities = extract(d.title);
    return { id: `ns-${d.id}`, source: "Bridge", channel: "New Source", url: d.link,
             timestamp: d.ts, rawText: `[OSINT] ${d.title}`,
             entities, severity: severityFor(entities.locations), live: true };
  }).filter((it) => isRelevant(it.entities));
}

const settled = await Promise.allSettled([fromHackerNews(), fromGoogleNews(), fromReddit(), fromNewSource()]);
```

### Upgrade the NER engine

Replace `groqExtract()` in `lib/extractor.ts` with any provider or a self-hosted model. Keep
the `Extracted` return shape and the try/catch fall-through, and every consumer keeps working —
the UI badge is driven by the `source` field, so it will report honestly whichever engine ran.

### Add a new dashboard panel

```tsx
<TacticalPanel title="My Panel" live tourId="mypanel">
  <div className="p-3">…</div>
</TacticalPanel>
```

Drop it into the right column in `ControlRoom.tsx` wrapped in `<div className="shrink-0">`,
subscribe to what you need via `useIntel((s) => s.something)`, and add a `TourGuide` step keyed
on the same `tourId` if it deserves onboarding.

### Add a persistent backend

`store/records.ts` already uses zustand's `persist` middleware — swapping the storage engine for
an API-backed one is a middleware config change, not a rewrite. `lib/users.ts` isolates all
persistence behind `getAllUsers` / `findUserByEmail` / `createUser` / `verifyCredentials`, so a
database swap touches one file.

---

## 33. The 30-second demo script

> Open the dashboard in **DEMO MODE** (default). The breach fires within 20 seconds, every run.

1. *"This is PRAHARI — the MP Cyber Cell's dark-web control room. Live intercepts stream in on
   the left, auto-tagged for location, contraband, wallets and handles."*
2. *(~6s: red siren over Jabalpur, toast, threat goes CRITICAL)* *"There — a listing just named a
   city inside our jurisdiction. The map sirens, the threat level goes critical, the breach
   counter ticks."*
3. *"Analytics on the right prove it: contraband mix, activity spikes, recurring wallet
   clusters, a handle watchlist."*
4. *"And the kicker —"* paste a sentence into **Live NER Analyzer**, hit Analyze *"— type anything
   with a city and watch it geolocate live."*
5. *(open the bell)* *"Every breach lands here. Set a status, assign an officer, add a note,
   create a case — this is how a cyber cell actually works a lead."*
6. *(toggle DEMO off)* *"And this isn't a canned animation — turn demo off and the same pipeline
   runs on live public threat intelligence from Hacker News, Google News and Reddit, right now."*
7. *"All synthetic where it needs to be, all free, all honest — we geofence what criminals say,
   we don't deanonymize Tor."*

**How to use it, step by step**

1. **Log in** with the demo account (one click).
2. **Watch the Live Intel Feed** (left) stream intercepts and auto-tag entities.
3. **Watch the map** (center). Within ~20 seconds a **Jabalpur breach** fires.
4. **Try the Live NER Analyzer**: paste `"LSD delivery in Jabalpur, contact @x, wallet bc1q..."`
   and hit **Analyze** — it extracts the entities and drops a marker on Jabalpur live.
5. **Read the analytics** (right): counters, contraband mix, zone monitor, wallet clusters.
6. **Handle alerts**: toasts stack neatly; the **Alert Log** and **bell** keep them all. Hit
   **JSON** or **REPORT** to export a lead.
7. **Open Records** (folder icon) for full case CRUD, five analytics charts, and reports.

---

## 34. FAQ

**"Can you geolocate Tor?"**
No — and we never claim to. We geofence *stated* locations in listing content, corroborated by
wallet reuse and handle repetition. See §5.

**"Is the data real?"**
DEMO mode: no, synthetic on purpose — legal, reproducible, unbreakable on stage. LIVE mode:
yes, genuine public OSINT from three free APIs, running through the identical pipeline.

**"So the dark-web part is fake?"**
The *source* is simulated; the *pipeline* is real and demonstrably runs on live internet data.
Production swaps in a licensed dark-web content feed at the ingestion layer — one function.

**"What if a listing has no location?"**
Low severity, no breach — but we still keep its wallet and handle for correlation.

**"Why 95 km and not 60?"**
The 60 km core is Jabalpur's own district. The 95 km neighbour ring captures Katni (~83 km) and
Narsinghpur (~85 km), which are operationally part of the same trafficking corridor. Both are
constants in one file.

**"Does it really run free?"**
Yes — `npm install && npm run dev`, zero accounts, zero keys. Groq is optional and free-tier.

**"How does it scale beyond Jabalpur?"**
The geofence and gazetteer are *config, not code* — a new district is a data change. See §32.

**"What happens if the internet drops mid-demo?"**
DEMO mode never touches the network. LIVE mode degrades to an `○ OFFLINE` badge and keeps
running. See §25.

**"Is there an audit trail?"**
Not yet — alerts carry status, assignee and notes, but no actor+timestamp history. That's the
first thing to build for real evidentiary use. See §24.

**"Are there tests?"**
No automated tests today. `HACKATHON_QA.md` is a 140-question manual QA card, and TypeScript
strict mode plus `server-only` provide compile-time guarantees. §30 lists what to write first.

---

## 35. Glossary

| Term | Meaning |
|------|---------|
| **PRAHARI / प्रहरी** | "Sentinel" or "watchman" in Hindi |
| **NER** | Named Entity Recognition — pulling structured entities (place, thing, ID) out of free text |
| **OSINT** | Open-Source Intelligence — intelligence from publicly available sources |
| **Geofence** | A virtual boundary; crossing it triggers an action |
| **In-zone / breach** | A listing naming a city within 95 km of Jabalpur |
| **Threat-heat** | Cumulative per-city mention weight (+2 in-zone, +1 otherwise) |
| **Intercept** | One ingested listing/post, with its extracted entities |
| **Wallet cluster** | A crypto address appearing across multiple listings — a correlation signal |
| **Handle watchlist** | Recurring `@handles` ranked by frequency, with last-seen city |
| **Haversine** | The great-circle distance formula used for all geofence math |
| **Content-based geospatial intelligence** | Geolocating on locations *stated in the content*, not on network metadata — PRAHARI's thesis |
| **Deanonymization** | Unmasking a Tor user's real identity/IP. **PRAHARI does not do this** |
| **CCTNS** | Crime and Criminal Tracking Network & Systems — India's national police record system |
| **MP** | Madhya Pradesh |

---

## 36. Guardrails (baked in, non-negotiable)

Synthetic demo data only · no real dark-web access · no Tor · no scraping of private content ·
no illegal or how-to content (category-level listings only) · API keys stay server-side ·
passwords bcrypt-hashed, never stored or returned in plaintext · every LIVE lead links back to
its public source · runs entirely free.

These are enforced in code, not just in policy: the generator's header comment states the
category-level rule; `lib/users.ts` is `server-only`; `GROQ_API_KEY` is never
`NEXT_PUBLIC_`-prefixed; all upstream OSINT URLs are hard-coded constants with no user-supplied
input; and `isInJabalpurZone()` deliberately consults only the MP gazetteer so the geofence can
never silently widen.

---

## Project structure

```
app/
  page.tsx                 Home (landing)
  about/ docs/             Public pages
  login/ signup/           Auth pages
  dashboard/               Control room (protected by middleware)
  api/
    auth/[...nextauth]/    NextAuth handler
    signup/                Create account (fs + bcrypt)
    analyze/               NER (Groq or local) — server-side
    live-intel/            Real OSINT aggregator (HN + Google News + Reddit, cached 20s)
  layout.tsx providers.tsx globals.css fonts.ts icon.svg
components/
  public/  docs/  home/    Public UI
  auth/                    Login / signup forms + AuthShell
  ui/                      TacticalPanel, Logo (shared primitives)
  dashboard/               Header, map, modals, tour, notifications, records
    panels/                Feed, analytics, zone monitor, wallets, alerts, NER
lib/
  cities.ts                MP gazetteer + geofence (haversine, two rings)
  indiaCities.ts           46-city national gazetteer for LIVE plotting
  mockIntel.ts             Synthetic intercept generator
  extractor.ts             NER: Groq + local fallback
  analytics.ts             Wallet clusters, handle watch, activity buckets, spike
  users.ts  auth.ts  authConfig.ts    Auth (server-only store + Edge-safe constants)
  time.ts  sound.ts        Formatting + WebAudio alert ping
store/
  intel.ts                 The engine: streamer, counters, threat, heat, alert log
  records.ts               Persisted case-record CRUD (localStorage)
types/next-auth.d.ts       Session/JWT augmentation (id, role)
middleware.ts              Edge auth guard on /dashboard/*
data/users.json            Local user store (gitignored, created on first signup)
HACKATHON_QA.md            140+ question demo/QA battle card
```

---

*Built for the Madhya Pradesh Police Cyber Cell, Jabalpur. प्रहरी — the sentinel that never sleeps.*
