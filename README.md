# PRAHARI · प्रहरी — "The Sentinel That Never Sleeps"

**A Dark-Web Threat Intelligence & Geofencing Control Room for the Madhya Pradesh Police Cyber Cell, Jabalpur.**

> Runs 100% free. `npm install && npm run dev`, log in with one click, and watch a live
> threat map light up. All data is synthetic and safe.

---

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
5. **Hands the officer a lead** — everything is logged and can be exported as a report.

That's the whole idea: **turn openly-published dark-web crime into a local, actionable map.**

---

## 2. The Model — how one message becomes an alert (worked example)

Say this listing appears in the feed:

```
Marketplace listing: MDMA & LSD, delivery across Jabalpur and Katni.
Contact @nightowl_mp. BTC bc1q7xk3f2m9v0…
```

Here is exactly what PRAHARI does with it:

| Stage | What happens | Result for this example |
|-------|--------------|--------------------------|
| **1. Ingest** | A new intercept arrives in the Live Intel Feed | Card appears, newest on top |
| **2. Extract** | NER tags the entities | 📍 `Jabalpur`, `Katni` · ⚑ `MDMA`, `LSD` · ₿ `bc1q7x…` · @ `nightowl_mp` |
| **3. Geofence** | Each city is measured against Jabalpur | `Jabalpur` = **in-zone** ✅ · `Katni` = **in-zone** ✅ |
| **4. Alert** | In-zone hit → breach | 🔴 Map sirens over Jabalpur + Katni · toast **"GEOFENCE BREACH: JABALPUR"** · Threat Level → **CRITICAL** · breach counter +1 · row added to Alert Log |
| **5. Report** | Correlate + export | `bc1q7x…` seen before → wallet cluster · Alert Log exportable as JSON/printable report |

If the listing had named **Bhopal** instead (an MP city *outside* Jabalpur), it would still
show on the map — but as a **dim red** marker at **medium** severity, with **no breach**. If it
named **no city at all**, it's **low** severity and just feeds the wallet/handle correlation.

### The geofence, precisely

Jabalpur's jurisdiction is drawn as **two rings** on the map:

- **Core (60 km, solid):** the city itself — labelled **"JABALPUR JURISDICTION"**.
- **Neighbour ring (95 km, dashed):** covers the neighbour towns **Katni (~83 km)** and
  **Narsinghpur (~85 km)** — labelled **"NEIGHBOUR RING"**.

A city triggers a **breach** if it falls inside the neighbour ring. Using real distance
(the haversine formula) the in-zone set comes out to exactly **Jabalpur, Katni, Narsinghpur** —
while Sagar (~147 km) and the rest of MP stay outside.

---

## 2b. Demo mode vs LIVE mode — is the data real?

The header **DEMO** toggle switches the data source:

- **DEMO ON (default):** a synthetic engine generates realistic marketplace-style intercepts and
  *guarantees* a Jabalpur breach within 20 seconds — perfect, unbreakable for a pitch.
- **DEMO OFF (LIVE OSINT):** the app fetches **real, live public cyber-threat intelligence** from
  **free, no-key APIs** (Hacker News + Reddit security feeds) through a server route
  (`/api/live-intel`), runs the **same NER → geofence pipeline**, and streams real headlines
  (e.g. *"ShinyHunters has leaked the data of multiple companies"*), badged **LIVE OSINT**.

**We never scrape the Tor dark web** — that's illegal and impossible to do honestly. LIVE mode
proves the pipeline runs on real internet data; in production you swap in a *licensed* dark-web
content feed at the ingestion layer. Nothing else changes.

## 3. The Honest Thesis (read this — it's the whole point)

> **We do NOT deanonymize the Tor network. We cannot, and we never pretend to.**

The dark web is anonymous *by design* — you cannot geolocate a Tor user's IP. Any tool that
claims to is lying or breaking the law.

PRAHARI does something **honest and legal** instead: it reads the **public content** of criminal
listings and geofences on the **locations the criminals state themselves**. A marketplace
*must* advertise where it ships, so the location leaks in the text. That's
**content-based geospatial intelligence — not network deanonymization.**

- **Is the data real?** No. Every intercept is **synthetic**, generated locally at the
  *category* level (a contraband type + a city + a handle + a wallet). No real dark-web access,
  no Tor, no scraping, no illegal content. Going live in production is a single "source swap."
- **Is it legal / private?** Yes. It reads public criminal-market content, not private citizens.
  No interception, no deanonymization. Every lead is auditable to its public source.

---

## 4. Why it matters

- Narcotics, weapon parts, stolen Aadhaar/PAN dumps and counterfeit currency are advertised
  openly on Tor, **naming Indian cities** as delivery points.
- National threat feeds don't zoom into a single district; local cyber cells have never had a
  console built for that **last mile**.
- PRAHARI is **local** (built for Jabalpur), **honest** (no fake deanonymization), **actionable**
  (exports real leads) and **free** (₹0 to run).

---

## 5. Features (every panel, explained simply)

**Public site**
- **Home** — the pitch: hero, the problem, the honest insight, 6 capabilities, the 5-stage pipeline.
- **About** — mission and the honest approach.
- **Docs** — Overview, How It Works, **How To Use**, Features, Tech Stack, FAQ.
- **Login / Signup** — one-click demo login, or create a real (locally-stored) account.

**The Control Room (`/dashboard`, login required)**
1. **Live Intel Feed** — streaming synthetic intercepts; each shows source, severity, and
   extracted entity chips after a quick *ANALYZING → EXTRACTED* animation.
2. **Geospatial Command** — the map. MP with 10 city markers, the Jabalpur geofence rings,
   red siren pulses on mentions, and a growing "threat-heat" glow on repeat hits.
3. **Threat Analytics** — live counters, a contraband category breakdown chart, and a 90-second
   activity sparkline with a spike marker.
4. **Jabalpur Zone Monitor** — zone threat level, in-zone hit count, neighbour-ring status,
   latest in-zone breaches, and a handle watchlist.
5. **Live NER Analyzer** — paste *any* sentence, hit **Analyze**, and watch entities extract and
   the mentioned MP cities plot on the map. Powered by Groq if a key is set, a local engine
   otherwise (it tells you honestly which one ran).
6. **Wallet Cluster Tracker** — recurring wallet addresses ranked by how many listings they
   appear in; reuse links separate sellers.
7. **Alert Log** — every breach in one list, with **Export → JSON** and a **printable Report**.
8. **Notification Center** — a header **bell with an unread badge** opens an alert inbox. Filter by
   severity/status and open any alert for its full detail (city, coords, distance from Jabalpur,
   source, the raw intercept text).
9. **Case Management** — on each alert, set a **status** (New → Acknowledged → Investigating →
   Closed), **assign an officer**, add a **case note**, and re-ping it on the map. Built for how a
   cyber cell actually works a lead.
10. **Guided Tutorial** — a first-use walkthrough spotlights every feature with **Next / Skip**;
    replay it anytime from the user menu.

**Alerts never overlap:** breach toasts use Sonner (bottom-right, capped visible count) so they
stack neatly — and everything also lands in the Alert Log and Notification Center, so nothing is
lost.

---

## 6. Getting started

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

Build for production:

```bash
npm run build && npm start
```

That's it — **no accounts, no API keys, no paid services** required.

### Optional: live NER via Groq (still free)

The Live NER Analyzer uses a built-in **local extractor** by default. To upgrade it to a real
LLM (Groq's free tier):

1. Get a free key at <https://console.groq.com/keys>.
2. Copy `.env.local.example` → `.env.local`.
3. Set `GROQ_API_KEY=gsk_...` (server-side only — it never reaches the browser).
4. Restart. The analyzer will show a **"via Groq"** tag; on any failure it silently falls back
   to **"via local engine"**. Model: `llama-3.3-70b-versatile`.

---

## 7. How to use it (step by step)

1. **Log in** with the demo account (one click).
2. **Watch the Live Intel Feed** (left) stream intercepts and auto-tag entities.
3. **Watch the map** (center). Within ~20 seconds a **Jabalpur breach** fires — red siren, toast,
   threat level jumps to **CRITICAL**.
4. **Try the Live NER Analyzer** (below the map): paste
   `"LSD delivery in Jabalpur, contact @x, wallet bc1q..."` and hit **Analyze** — it extracts the
   entities and drops a marker on Jabalpur live.
5. **Read the analytics** (right): counters, contraband mix, zone monitor, wallet clusters.
6. **Handle alerts**: toasts stack neatly; the **Alert Log** keeps them all. Hit **JSON** or
   **REPORT** to export a lead.
7. **DEMO MODE** (header, ON by default) raises the intercept rate and *guarantees* a Jabalpur
   breach within 20 seconds — perfect for a live pitch.

---

## 8. The 30-second demo script

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
5. *"Every alert is logged and exportable as a lead. All synthetic, all free, all honest — we
   geofence what criminals say, we don't deanonymize Tor."*

---

## 9. Tech stack (all free / open-source)

| Area | Tool |
|------|------|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS (red/white/black tactical design system, 8px grid) |
| Auth | NextAuth.js (Credentials) + bcryptjs + local `data/users.json` |
| Map | react-leaflet + Leaflet + free CartoDB dark_matter tiles |
| Alerts | Sonner (stacked, non-overlapping) |
| State | zustand |
| Charts | recharts |
| Animation / Icons | framer-motion · lucide-react |
| Fonts | Anton · Space Grotesk · JetBrains Mono · Inter (Google Fonts via `next/font`) |
| NER (optional) | Groq `llama-3.3-70b-versatile` — with a local regex/gazetteer fallback |

---

## 10. Project structure

```
app/
  page.tsx                 Home (landing)
  about/ docs/             Public pages
  login/ signup/           Auth pages
  dashboard/               Control room (protected)
  api/
    auth/[...nextauth]/    NextAuth handler
    signup/                Create account (fs + bcrypt)
    analyze/               NER (Groq or local) — server-side
  layout.tsx providers.tsx globals.css fonts.ts
components/
  public/  docs/  home/    Public UI
  auth/                    Login / signup forms
  ui/                      TacticalPanel, Logo (shared primitives)
  dashboard/               Header, map, feed, and panels/
lib/
  cities.ts                MP cities + geofence (haversine, two rings)
  mockIntel.ts             Synthetic intercept generator
  extractor.ts             NER: Groq + local fallback
  analytics.ts             Wallet clusters, handle watch, activity buckets
  users.ts  auth.ts        Auth + local user store
  time.ts  sound.ts
store/intel.ts             Global state: streamer, counters, threat, alert log
middleware.ts              Protects /dashboard
```

---

## 11. FAQ

- **"Can you geolocate Tor?"** No — and we never claim to. We geofence *stated* locations in
  listing content, corroborated by wallet reuse and handle repetition.
- **"Is the data real?"** No — synthetic on purpose. Legal, reproducible, unbreakable on stage.
- **"What if a listing has no location?"** It's low severity and doesn't breach — we still keep
  its wallet/handle for correlation.
- **"Does it really run free?"** Yes — `npm install && npm run dev`, zero accounts. Groq is
  optional and has a free tier.
- **"How does it scale beyond Jabalpur?"** The geofence and gazetteer are *config, not code* —
  a new district is a data change.

---

## 12. Guardrails (baked in, non-negotiable)

Synthetic data only · no real dark-web access · no Tor · no scraping · no illegal / how-to
content (category-level listings only) · API keys stay server-side · runs entirely free.

---

*Built for the Madhya Pradesh Police Cyber Cell, Jabalpur. प्रहरी — the sentinel that never sleeps.*
