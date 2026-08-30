# AUDIT — PRAHARI v1

Phase 1 deliverable. Every file in `lib/`, `store/`, `app/api/` and `components/dashboard/`, with its
line count, responsibility, and v2 disposition (**keep** / **modify** / **retire**).

Audited 30 August 2026 against commit `37bfddc` on `main`. Line counts are real (`wc -l`), not estimates.

**Scale of v1:** 65 modules, 6,544 lines across `app/ components/ lib/ store/ types/`.
(Part A of the playbook states "~6,130 lines, 58 modules" — that was accurate at an earlier commit;
the delta is documentation and public-page growth. Recorded here so the number is not re-litigated.)

---

## 1. `lib/` — pure logic, no React

| File | Lines | Responsibility | v2 | Why |
|---|---|---|---|---|
| `lib/cities.ts` | 85 | MP gazetteer (10 cities), haversine, `GEOFENCE_CORE_KM=60`, `GEOFENCE_ZONE_KM=95`, `isInJabalpurZone`, `isInCore`, `ZONE_CITIES`/`OTHER_CITIES` computed at load | **keep** | The breach predicate. Load-bearing and correct. Frozen by `__tests__/cities.test.ts`. |
| `lib/indiaCities.ts` | 68 | 46-city national gazetteer + `INDIA_CITY_NAMES`, plotting only | **keep** | Cannot trigger a breach by construction (`isInJabalpurZone` never consults it). |
| `lib/mockIntel.ts` | 215 | Synthetic feed: 7 templates x 4 categories, 12 handles, 8 wallets, `categoryOf`, severity from city, `generateIntercept({forceCity})` | **keep** | Remains DEMO mode in v2. DATASET mode is additive, not a replacement. |
| `lib/extractor.ts` | 108 | `localExtract` (regex + gazetteer), `groqExtract`, `analyze()` with honest `source: "groq" \| "local"` | **modify** | Phase 3 ports this to Python and extends it. The TS version stays as the engine-offline fallback. See DEC-011. |
| `lib/analytics.ts` | 78 | `walletClusters`, `handleWatch`, `activityBuckets(90s/24)`, `spikeIndex` | **keep** | Pure selectors over the intercept window. No v2 dependency. |
| `lib/users.ts` | 120 | Server-only user store, bcrypt cost 10, `data/users.json`, seeded demo officer | **modify** | Phase 2 moves persistence behind the same signatures. See DEC-009. |
| `lib/auth.ts` | 51 | NextAuth `authOptions`, credentials provider, jwt/session callbacks carrying `id` + `role` | **modify** | `role` already threaded through — Phase 10 RBAC builds on it, no schema change needed. |
| `lib/authConfig.ts` | 9 | Edge-safe `AUTH_SECRET` + `SIGNIN_PAGE`, no Node imports | **modify** | Hardcoded dev-secret fallback must be gated in production. See FINDING-04. |
| `lib/time.ts` | — | Timestamp formatting helpers | **keep** | — |
| `lib/sound.ts` | 37 | WebAudio two-tone breach siren | **modify** | Phase 9 gates it behind `prefers-reduced-motion`. |

## 2. `store/` — zustand

| File | Lines | Responsibility | v2 | Why |
|---|---|---|---|---|
| `store/intel.ts` | 417 | The streamer. Two clocks (`streamTimer` variable-delay, `threatTimer` 1 s), cumulative counters in module-level `Set`s, seq-keyed `lastPulse`/`lastBreach`/`focusTarget`, threat machine NOMINAL→ELEVATED→CRITICAL (15 s / 30 s decay), city heat (+2 in-zone / +1 other), alert log capped 200, feed capped 60, alert case actions | **modify** | Phase 2 adds a third `tick()` branch for DATASET mode. Everything else is frozen. |
| `store/records.ts` | 126 | `CaseRecord` type, zustand `persist` to `localStorage["prahari-records-v1"]`, 3 seed cases, CRUD | **modify** | Phase 9 adds `actorId, personas[], confidence, sealRoot, sealTx`. Storage key must bump to `-v2` on shape change. |

## 3. `app/api/` — server routes

| File | Lines | Responsibility | v2 | Why |
|---|---|---|---|---|
| `app/api/live-intel/route.ts` | 221 | HN Algolia + Google News RSS + Reddit, `Promise.allSettled`, 5.5 s `AbortSignal.timeout`, 20 s in-process cache, `force-dynamic`, always HTTP 200 | **keep** | Phase 3 ports the same three adapters to Python; this route stays as the no-engine path. |
| `app/api/analyze/route.ts` | 21 | POST, 4,000-char cap, 400 only on malformed/empty input, otherwise always 200 with `{ok, entities, source}` | **modify** | Phase 3 proxies to `/extract` when the engine is up, falls back to `analyze()` when it is not. |
| `app/api/signup/route.ts` | 23 | POST → `createUser`, 201 on success, 400 on validation failure | **modify** | Phase 10 adds rate limiting. |
| `app/api/auth/[...nextauth]/route.ts` | — | NextAuth handler | **keep** | — |

## 4. `components/dashboard/` — the control room

| File | Lines | Responsibility | v2 | Why |
|---|---|---|---|---|
| `RecordsModal.tsx` | 433 | Records table / 5 recharts / report tab, JSON export, print | **modify** | Largest component. `document.write` at :400 must go (FINDING-02); Phase 9 adds CSV + PDF via the engine. |
| `NotificationCenter.tsx` | 423 | Alert drawer, per-alert status/assign/note, case creation, mark-all-read | **modify** | Phase 9 adds focus trap, Escape, `aria-live`. Symbol stripped in Phase 1. |
| `TourGuide.tsx` | 249 | Guided tour, spotlight via 9999 px box-shadow | **keep** | Clever and self-contained. Phase 9 gates its motion. |
| `MapView.tsx` | 235 | Leaflet, 4 basemaps, divIcon markers sized by heat, 1800 ms sirens, fly-to on `focusTarget.seq` | **retire** | Phase 9 replaces with MapLibre GL. `MapResizer`/`MapFocuser` semantics must survive the swap. |
| `ThreatAnalytics.tsx` | 152 | Recharts panels over `lib/analytics.ts` | **keep** | — |
| `LiveNERAnalyzer.tsx` | 143 | Textarea → `/api/analyze` → chips + `registerCities` | **modify** | Phase 3 shows the engine badge (`muril`/`spacy`/`regex`/`groq`/`local`). |
| `IntelDetailModal.tsx` | 142 | Per-intercept detail, create-case action | **modify** | Phase 9 adds "Find linked personas". |
| `JabalpurZoneMonitor.tsx` | 138 | Zone city list, distances, in-zone status | **keep** | — |
| `AlertLog.tsx` | 116 | Alert table + print | **modify** | Second `document.write` at :62 (FINDING-02) — the playbook only names `RecordsModal`. |
| `ControlRoom.tsx` | 115 | Dashboard grid shell `xl:grid-cols-[360px_1fr_392px]` | **modify** | Phase 9 responsive contract (three-column ≥1280, two ≥768, stacked below). |
| `IntelCard.tsx` | 93 | Feed card: source badge, text, entity chips, severity | **keep** | Already lucide-only. |
| `WalletTracker.tsx` | 71 | Wallet cluster list + copy | **modify** | Symbol stripped in Phase 1. Phase 9 adds one-hop tx graph. |
| `EntityChips.tsx` | 68 | Location/contraband/wallet/handle chips | **keep** | **Already lucide-only** (`MapPin`, `Flag`, `Bitcoin`, `AtSign`) — the playbook's "emojis in entity chips" debt item is stale. See FINDING-01. |
| `DashboardHeader.tsx` | 64 | Header bar composition | **modify** | Phase 2 hosts the three-way mode toggle. |
| `UserMenu.tsx` | 62 | Session menu, sign out | **keep** | — |
| `HeaderControls.tsx` | 62 | DEMO toggle, toast toggle, mute | **modify** | Phase 2 replaces the boolean DEMO toggle with `DEMO · DATASET · LIVE`. |
| `ThreatHUD.tsx` | 53 | Threat level + counters | **keep** | — |
| `BreachToaster.tsx` | 44 | Store breach events → Sonner toasts, capped 4 | **modify** | Symbol stripped in Phase 1. |
| `LiveIntelFeed.tsx` | 44 | Feed list rendering | **keep** | — |
| `RecordsButton.tsx` | 33 | Opens `RecordsModal` | **keep** | — |
| `MapPanel.tsx` | 26 | `dynamic({ssr:false})` wrapper around `MapView` | **keep** | Pattern carries over to MapLibre. |
| `AnimatedNumber.tsx` | 20 | Count-up animation | **modify** | Phase 9 gates behind `prefers-reduced-motion`. |
| `Clock.tsx` | 19 | Live IST clock | **keep** | — |
| `SourceBadge.tsx` | 18 | Marketplace/Forum/Paste/Bridge badge | **keep** | — |

---

## 5. Load-bearing invariants — verified, not assumed

Each was checked against the source this phase. All six hold.

| # | Invariant | Status | Evidence |
|---|---|---|---|
| INV-1 | `ZONE_CITIES == ["Jabalpur","Katni","Narsinghpur"]` | **VERIFIED** | Computed haversine from `JABALPUR`: Jabalpur 0.0, Katni 83.4, Narsinghpur 85.3 km — all ≤ 95. Next nearest is Sagar at 146.8 km. Frozen by `__tests__/cities.test.ts`. |
| INV-2 | `isInJabalpurZone` uses `getCity`, never `getAnyCity` | **VERIFIED** | `lib/cities.ts:66`. A national-gazetteer city can never breach. |
| INV-3 | `analyze()` never throws | **VERIFIED** | `lib/extractor.ts:96-107` — Groq call wrapped in try/catch with a bare `catch {}` falling through to `localExtract`, which is pure regex over a string. |
| INV-4 | `/api/live-intel` never returns non-200 | **VERIFIED** | `route.ts:213` (zero sources) and `:220` (success) both `status: 200`. `Promise.allSettled` cannot reject. |
| INV-5 | Dedup `Set`s live outside zustand | **VERIFIED** | `store/intel.ts:110-112` — `walletSet`, `handleSet`, `liveSeen` are module-level, so counters are cumulative across mode switches while the feed clears. |
| INV-6 | Effects are seq-keyed | **VERIFIED** | `pulseSeq`/`breachSeq`/`focusSeq` at `store/intel.ts:107-109`, monotonic. Consumers fire on `.seq` change, so an identical repeat event still triggers. |

### Margin note on INV-1

The zone boundary has **9.7 km of headroom** (Narsinghpur at 85.3 km vs the 95 km ring). The playbook's
suggested test asserts only "Katni < 95, Sagar > 95" — true but slack, since Sagar is 146.8 km out.
`cities.test.ts` therefore asserts the **exact set equality** plus both boundary distances, so any
gazetteer edit that would silently add or drop a zone city fails the test rather than the demo.

---

## 6. Findings — v1 debt, corrected against real code

The playbook's Part A debt list is mostly right. Two items are wrong and one is incomplete; recorded
here so Phase 1 does not chase work that is already done, or miss work the playbook under-scoped.

| ID | Severity | Finding |
|---|---|---|
| **FINDING-01** | Minor | **The "emojis in entity chips and feed cards" debt item is stale.** `EntityChips.tsx` and `IntelCard.tsx` already use lucide icons exclusively. Real emoji exist only in `README.md` and `HACKATHON_QA.md`. Source instead carries typographic symbols (`✓ ⚠ ↳`) in six rendered strings, which the playbook's own grep range `[\x{1F300}-\x{1FAFF}]` does not match. Resolved by DEC-002. |
| **FINDING-02** | Major | **Two `document.write` call sites, not one.** `RecordsModal.tsx:400` (named in the playbook) and `AlertLog.tsx:62` (not named). Both build HTML by interpolating unescaped `CaseRecord`/`AlertLogEntry` fields — including analyst-authored `notes` and `rawText` — into a new window. Phase 9 obj 6 must cover both. |
| **FINDING-03** | Minor | **`lastMpAt` is set for any Indian city, not just MP.** `store/intel.ts:165` assigns `lastMpAt` after `getAnyCity()` resolves, so a LIVE item naming Mumbai raises the threat level to ELEVATED. The docs describe this as "last **MP** mention". Behaviour is defensible for a national OSINT feed, but the name and the docs disagree. Do not change v1 behaviour in this phase — recorded for Phase 9 copy. |
| **FINDING-04** | Major | **`AUTH_SECRET` has a hardcoded production-capable fallback.** `lib/authConfig.ts:7-9`. Correctly scoped to Phase 10 obj 7, which must make the app refuse to boot in production without `NEXTAUTH_SECRET`. |
| **FINDING-05** | Minor | **No `prefers-reduced-motion` anywhere.** Zero matches across `app/` and `components/`. Confirms the playbook's debt item. Scoped to Phase 9 obj 7. |
| **FINDING-06** | Minor | **No CI configuration exists**, yet Phase 8 requires an end-to-end Anvil test "in CI" and Phase 11 requires a "link to CI run". No phase creates it. Scoped into Phase 2 by DEC-010. |

Confirmed-as-stated debt, no correction needed: no tests (now fixed by this phase), flat-file users
(Phase 2), localStorage records (Phase 9), no RBAC (Phase 10), no audit trail (Phase 8), no focus trap
(Phase 9).

---

## 7. What Phase 1 changed

Nothing behavioural. Two documentation files and six source strings had emoji or symbols replaced with
lucide icons, per DEC-002. No logic, no dependency beyond `vitest`, no v1 semantics touched.
