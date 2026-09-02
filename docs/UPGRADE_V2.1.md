# UPGRADE v2.1 — living log

The v2.1 upgrade turns the single-page workbench into a routed analyst workspace, adds a graph
intelligence lab, a hardened Command Panel, SANGAM Pro, a footer, and a budgeted keep-alive.

**Prime directive: additive only. Nothing that works today may stop working.**

Executed one phase per session, on branch `feat/v2.1-workspace` off `v2-rebuild` @ `800d9ae`.
No phase starts until the previous phase's gate is green. This file records what changed, why, and
what to revert if a phase fails.

---

## Phase 0 — Baseline lock

**Status: COMPLETE, after Phase 0b closed the red baseline it found.**

The baseline was red when first measured. Phase 0b (below) restored the safety net; the gate is now
green and Phase 1 may start. The findings below are left as written — the record of what the tree
actually looked like is the point.

### What was done

| # | Step | Result |
|---|---|---|
| 1 | Branch `feat/v2.1-workspace` created off `v2-rebuild` | done |
| 2 | Full gate run and recorded verbatim in `docs/TESTLOG.md` § `v2.1 baseline` | done — **3 red, 1 not run** |
| 3 | `web/lib/features.ts` — four flags, all default OFF | done |
| 4 | This file | done |
| 5 | Baseline screenshots in `web/e2e/__baseline__/` | done — 4 routes, real renders |

An unrelated uncommitted edit to `web/.env.production.example` (a leading `#` deleted from line 1,
which would have made `Set these in the Vercel project...` parse as an env assignment) was reverted
before branching. It was not part of this work.

### The gate is not met

| Check | Result |
|---|---|
| `uv run pytest -q` | **PASS** — 239 passed, 17 skipped |
| `npm run build` | **PASS** — clean, `tsc --noEmit` clean |
| `npm test` | **FAIL** — 0 test files, exit 1 |
| `npm run lint` | **FAIL** — ESLint unconfigured, interactive prompt |
| `node web/e2e/journey.mjs` | **FAIL** — drives `/dashboard`, a route v2 removed |
| `forge test` | **NOT RUN** — `forge` not installed on this machine |

The playbook's expected 371 was true at the Phase 11 release gate. It is not true now, and the gap is
not a regression from this branch:

- **`aa8789e` deleted `web/__tests__/` entirely** (6 files, 891 lines, 98 tests) when it removed the v1
  console. Nothing replaced them. Three of those files covered code that **survived** the rebuild and
  still ships — `lib/report.ts` (FINDING-02 / INV-6), `lib/a11y.ts` (DEC-042), and the security
  assertions. Those invariants are currently asserted by nothing.
- **`web/e2e/journey.mjs` was never updated for v2.** It waits for `**/dashboard`; `LoginForm.tsx:26`
  navigates to `/workbench`. The harness dies before check 1, so the `BANNED` emoji regex enforcing
  INV-7/DEC-002 has not run since the rebuild.
- **`npm run lint` has never been configured.** No `.eslintrc*`, no `eslintConfig` block.

### Why this blocks rather than being worked around

The upgrade's safety net *is* the test suite. Every phase in the playbook closes with "`npm test` and
`node web/e2e/journey.mjs` green, or the phase is rolled back". Both of those commands currently exit
non-zero for reasons unrelated to any change a phase makes, so neither can signal a regression. Phase 1
in particular is asked to prove that six skins keep their semantic colour tokens identical and that a
storage exception cannot break first paint — assertions with nowhere to live.

Building on this baseline would mean each later phase reporting green against a gate that cannot fail.
That is the exact failure mode `aa8789e` demonstrated: it reported the engine green and shipped a
silently empty web suite.

### The proposed unblock — Phase 0b

Restore the safety net before Phase 1, additively. No product code changes.

1. **Rebuild `web/__tests__/` against v2's actual surface.** Not a restore of the v1 files — most of
   what they covered is gone. New coverage for what ships today, starting with the three invariant
   holes: `report.test.ts` (the FINDING-02 XSS payload set through `lib/report.ts` and
   `lib/reportPdf.ts`), `a11y.test.ts` (the DEC-042 `getClientRects()` focus trap), `security.test.ts`
   (the INV-6 no-`innerHTML`/`document.write` static assertion, and the INV-2 assertion that the proxy
   is an allowlist and `ENGINE_URL` never gains a `NEXT_PUBLIC_` prefix). Then `skins.ts`, `api.ts`,
   `geoderive.ts`, `rateLimit.ts`, `time.ts`, `authConfig.ts`.
2. **Fix `web/vitest.config.ts`** — its two `environmentMatchGlobs` name files that no longer exist.
3. **Repoint `journey.mjs` at v2's routes** — `/workbench`, not `/dashboard`. Keep all 25 checks;
   only the navigation targets change. This is the check that has caught a real bug in three phases.
4. **Configure ESLint** — `eslint-config-next`, non-interactive, so `npm run lint` lints.
5. **Record `forge test`** as a stated environment condition, or install Foundry.

Only then is the Phase 0 gate real, and Phase 1 can start.

### Rollback

Phase 0 touches no product code. To revert entirely:

```bash
git checkout v2-rebuild && git branch -D feat/v2.1-workspace
```

Files added: `web/lib/features.ts`, `web/e2e/baseline-shots.mjs`, `web/e2e/__baseline__/*.png`,
`docs/UPGRADE_V2.1.md`. Files changed: `docs/TESTLOG.md` (append only). Files removed: **NONE**.

---

## Phase 0b — The safety net, restored

**Status: COMPLETE. The Phase 0 gate is green.**

Not in the original playbook. Phase 0 measured a red baseline and this phase closes it, because every
later phase's gate is "`npm test` and `journey.mjs` green or roll back" and neither command could fail
for any reason a phase change would cause.

**No product code changed.** The only edit outside tests, config and docs is a comment block plus one
`eslint-disable-next-line` in `app/layout.tsx`. Build output is byte-identical to the Phase 0 baseline.

| Check | Phase 0 | Phase 0b |
|---|---|---|
| `npm test` | 0 test files, exit 1 | **144 passed**, 10 files |
| `npm run lint` | interactive prompt, exit 1 | **clean** |
| `npm run build` | clean | clean, identical route sizes |
| `uv run pytest -q` | 239 passed, 17 skipped | 239 passed, 17 skipped |
| `node web/e2e/journey.mjs` | harness error at check 1 | **35/35 passed** |
| `forge test` | not run | not run — stated condition |

**418 green** (144 web · 239 engine · 35 e2e). Full breakdown in `docs/TESTLOG.md`.

### What was built

1. **`web/__tests__/` rebuilt** — ten files, weighted towards the invariants that had no assertion at
   all: INV-1, INV-2, INV-5, INV-6, INV-7, INV-8, DEC-042, DEC-046, DEC-051. Not a restore of the
   deleted v1 files; new coverage for what ships today.
2. **`web/vitest.config.ts` fixed** — its two `environmentMatchGlobs` named v1 files that no longer
   existed.
3. **`web/e2e/journey.mjs` rewritten for v2** — 35 checks green, up from 25 of which none ran. The
   four v1 checks with no v2 equivalent print as GAPS on every run rather than being dropped.
4. **ESLint configured** (`.eslintrc.js`) — `eslint-config-next`, plus INV-6 rules that ban
   `innerHTML`, `outerHTML`, `document.write` and `dangerouslySetInnerHTML` at the linter layer too.
   The one legitimate exception (the pre-paint skin picker) is disabled at its own line with a written
   justification, so the exception stays greppable instead of being blanket-allowed.

### Two findings, from a suite that was one hour old

- **FINDING-06 (INV-5, live).** `lib/geoderive.ts` emits a Binance off-ramp marker for *every* actor —
  `Math.max(1, p.infrastructure.length)` guarantees it — stamped `inferred: false` and captioned as a
  known fact. A fabricated cash-out claim rendered like a measurement. Pinned as `it.fails` so the
  suite stays green and the tests flip the moment it is fixed. **Phase 5 owns it.**
- **FINDING-07 (dormant).** `trapFocus`/`focusableWithin` are called from nowhere — v2 removed every
  dialog, so the DEC-042 fix guards nothing. Harmless today, a trap for Phases 2 and 3, which both add
  drawers and modals. Printed as a journey GAP every run.

### Rollback

```bash
git revert <phase-0b-sha>     # tests, config and docs only; no product behaviour
```

Files added: `web/__tests__/*.test.ts` (10), `web/.eslintrc.js`.
Files changed: `web/vitest.config.ts`, `web/e2e/journey.mjs`, `web/app/layout.tsx` (comments +
one lint-disable), `web/package.json` (two devDependencies), `docs/TESTLOG.md`.
Files removed: **NONE**.

### Next

**Phase 1 — the skin bug: draw once per visit.**

---

## Phase 1 — The skin bug: draw once per visit

**Status: COMPLETE. DEC-055.**

| Check | Phase 0b | Phase 1 |
|---|---|---|
| `npm test` | 144 | **220 passed** |
| `node web/e2e/journey.mjs` | 35/35 | **48/48** |
| `uv run pytest -q` | 239 / 17 skipped | unchanged |
| `npm run lint` / `build` | clean | clean, `/workbench` unchanged at 131 kB / 239 kB |
| `forge test` | not run | not run — same stated condition |

**507 green.**

### What changed

1. **`lib/skins.ts`** — a four-tier resolution (`?skin=` → lock → session → fresh draw), resolved
   synchronously pre-paint. The visit's draw is a versioned `{skin, layout, fontPair, drawnAt, v:2}`
   record in `sessionStorage`; an older or corrupt shape is discarded and redrawn, never crashed on.
   Every storage access is individually guarded and falls back to an in-memory singleton.
2. **`lib/signals.ts`** (new) — the single source of truth for colour that carries meaning, mirrored
   into `:root` as `--sig-*` / `--ent-*`, which no skin block may redefine.
3. **`globals.css`** — semantic tokens in `:root`; `html[data-font="0|1|2"]` blocks after the skin
   blocks, so the type pair is drawn independently of the palette.
4. **`ThemeControl`** — Reshuffle / Lock / Unlock are now three distinct labelled behaviours, with a
   caption stating which tier is in force. Unlock keeps the current draw.
5. **`EvidenceTrail`, `ActorGraphPanel`, `ActorGraph3D`** — read the shared registry instead of
   hand-copied literals.

### The bug underneath the bug

Every signal root on the evidence trail was drawn with
`linear-gradient(var(--accent-dim), var(--accent))`: all six in one colour, and that colour
skin-dependent. Bar length was the only encoding. That — not the palette re-roll — was the
evidence-integrity problem, and it is what DEC-055 actually fixes.

### Rollback

```bash
git revert <phase-1-sha>
```

Files added: `web/lib/signals.ts`, `web/__tests__/skinSession.test.ts`,
`web/__tests__/signals.test.ts`, `web/e2e/__phase1__/workbench-abyss.png`.
Files changed: `web/lib/skins.ts`, `web/app/globals.css`,
`web/components/system/ThemeControl.tsx`, `web/components/workbench/EvidenceTrail.tsx`,
`web/components/workbench/ActorGraphPanel.tsx`, `web/components/three/ActorGraph3D.tsx`,
`web/e2e/journey.mjs`, `web/__tests__/{skins,security}.test.ts`, `web/tsconfig.json`,
`docs/{DECISIONS,TESTLOG,UPGRADE_V2.1}.md`.
Files removed: **NONE**.

### Next

**Phase 2 — the analyst workspace.**

---

## Phase 2 — The analyst workspace

**Status: COMPLETE. DEC-056.**

| Check | Phase 1 | Phase 2 |
|---|---|---|
| `npm test` | 220 | **280 passed** |
| `journey.mjs` (flag ON) | 48/48 | **71/71** |
| `journey.mjs` (flag OFF) | n/a | **51/51** |
| `uv run pytest -q` | 239 / 17 skipped | unchanged |
| `npm run lint` / `build` | clean | clean; `/workbench` 103 kB, cockpit 243 kB at `/classic` |
| `forge test` | not run | not run — same stated condition |

**590 green.**

### What changed

1. **Ten routed surfaces** under `app/workbench/`, plus `/workbench/classic`. Every route mounts the
   **existing** panel component — nothing was rewritten, and `routes.test.ts` asserts each import so
   Phase 3 starts from the same `ActorGraphPanel` rather than a fork.
2. **`lib/workspace.ts`** — one zustand store, one cache keyed by actor id. Measured: two network
   calls per actor across five route visits, and one confidence on every route.
3. **`WorkspaceShell`** — persistent navigator rail, context bar carrying the actor, its confidence
   and band, and the two engine-sourced facts (refreshing every 30 s, never from constants).
4. **`CommandPalette`** (Cmd/Ctrl-K) — **closes FINDING-07** by wiring `lib/a11y` `trapFocus` back in.
5. **`CompareView`** — the one new surface. Shows shared identifiers, hosts, markets and signal roots,
   and computes no score of its own.
6. **The flag-off path is a rewrite**, not a branch: a branch put both components in one bundle
   (256 kB against 103 kB).

### Three defects found by walking the routes in a browser

- **`limit=500` → 422.** The engine caps at 200.
- **A 422's `detail` is an array of objects.** Rendering it threw React #31 and blanked the route.
- **The rewrite never fired.** A bare `rewrites()` array is `afterFiles`, which only applies when no
  page matched — and `app/workbench/page.tsx` always matches, so the **flag-off build served the
  Overview**. Fixed with `beforeFiles`. The flag-on gate could not have caught it; `journey.mjs` now
  detects the flag and runs in both builds.

### Rollback

```bash
git revert <phase-2-sha>
```

Files added: `web/lib/workspace.ts`, `web/components/workspace/*` (6),
`web/app/workbench/**` (11 route files + layout), `web/__tests__/{workspace,routes}.test.ts`,
`web/e2e/__phase2__/*.png`.
Files changed: `web/lib/api.ts` (`detailOf`), `web/app/globals.css` (`.hairline-r`),
`web/next.config.mjs`, `web/e2e/journey.mjs`, `docs/{DECISIONS,TESTLOG,UPGRADE_V2.1}.md`.
Files removed: **NONE**.

### Flag state

`NEXT_PUBLIC_FF_WORKSPACE=1` in `web/.env.local` — **on**, its gate having passed. It is not set in
any committed env file, so a fresh clone still gets the legacy cockpit until it is switched on
deliberately.

### Next

**Phase 3 — the graph intelligence lab.**

---

## Phase 3 — The graph intelligence lab

**Status: COMPLETE. DEC-057.**

| Check | Phase 2 | Phase 3 |
|---|---|---|
| `npm test` | 280 | **373 passed** |
| `journey.mjs` | 71/71 | **90/90** |
| `uv run pytest -q` | 239 / 17 skipped | unchanged |
| `npm run lint` / `build` | clean | clean; graph route 123 kB |
| `forge test` | not run | not run — same stated condition |

**702 green.**

### What changed

1. **`lib/graphModel.ts`** — one model, eleven renderers, plus a hand-rolled **deterministic** force
   solver (d3-force seeds from `Math.random` with no way to inject a generator).
2. **`components/graph/views.tsx`** — ten view renderers, each exporting a caption that states what
   its layout means.
3. **`components/graph/NodeInspector.tsx`** — every edge with its signal root, strength and
   reliability exponent, and **what root-cause collapse discarded**.
4. **`lib/graphExport.ts`** — PNG / SVG / JSON / GraphML, each stamped with actor, filter state, view,
   timestamp and engine version.
5. **`components/graph/GraphLab.tsx`** — the shell. The 3D view is `ActorGraphPanel`, mounted
   unchanged.

### Three defects found by running the code

- `createDocument` under happy-dom returns an **HTML** document, and `setAttribute("xmlns")` emitted a
  duplicate namespace — malformed XML.
- happy-dom's `DOMParser` **rejects `attr.name`**, which GraphML mandates, so re-parsing valid output
  failed. Well-formedness moved to the e2e.
- The 2D layout **settled into a thumbnail** in the middle of the stage. No test caught it; found by
  screenshotting the page. Fixed with a uniform fit-to-stage scale.

Plus one pre-existing: Phase 2's spy annotations failed `tsc --noEmit` while `next build` passed.

### Rollback

```bash
git revert <phase-3-sha>
```

Files added: `web/lib/{graphModel,graphExport}.ts`, `web/components/graph/*` (4),
`web/__tests__/{graphModel,graphViews,graphExport}.test.ts`, `web/e2e/__phase3__/*.png`.
Files changed: `web/app/workbench/actor/[id]/graph/page.tsx`, `web/e2e/journey.mjs`,
`web/vitest.config.ts`, `web/__tests__/workspace.test.ts`, `docs/*`.
Files removed: **NONE**.

### Flag state

`NEXT_PUBLIC_FF_GRAPH_LAB=1` in `web/.env.local` — **on**, its gate having passed. Not set in any
committed env file, so a fresh clone still gets the Phase 2 full-viewport panel.

### Next

**Phase 4 — the Command Panel.**

---

## Phase 4 — The Command Panel

**Status: COMPLETE, with the user-management surface explicitly unbuilt. DEC-058, DEC-059, DEC-060.**

| Check | Phase 3 | Phase 4 |
|---|---|---|
| `npm test` | 373 | **885 passed** |
| `uv run pytest -q` | 239 / 17 skipped | **401 passed** / 17 skipped |
| `journey.mjs` | 90/90 | **108/108** |
| `npm run lint` / `build` | clean | clean; `/command` 106 kB |
| `forge test` | not run | not run — same stated condition |

**1,394 green.**

### What changed

**Security first — the phase's own rule is that a half-secured panel is worse than none.**

1. **`lib/rbac.ts`** — five roles as a strict hierarchy, `analyst`/`officer` unchanged, and ONE
   authorisation table walked exhaustively by a 351-assertion generated matrix.
2. **`lib/totp.ts`** — RFC 6238 step-up with single-use codes, ±1 drift, hashed single-use recovery
   codes, and a server-side token store. Destructive actions need a **fresh** (120 s) step-up.
3. **`lib/sessions.ts`** — absolute 8-hour cap, a registry where an unknown session is treated as
   revoked, revoke-all on role change, and session-bound CSRF.
4. **`lib/passwords.ts`** — bcrypt cost 12 + pepper, legacy hashes still accepted, offline breach list.
5. **`lib/adminGuard.ts`** — the control. IP allowlist → session → CSRF → role → step-up → rate limit.
6. **`app/api/admin/[...path]`** — a SECOND proxy, separate by design; `/admin` never enters the read
   proxy's allowlist.
7. **`engine/admin/`** — the engine verifies a request-bound signed token and re-checks the role
   against its own table.
8. **CRUD** — soft-delete only, optimistic concurrency, every mutation returns its diff and lands in
   the signed ledger. Dry-run-first bulk import and retention purge, the latter with a two-person rule.
9. **Reports and analytics** — four new reports on the existing `createElement` path, signal
   contribution, and honest "not measured" everywhere.

### Four defects found while building

- **FINDING-08:** `users/../retention/purge` authorised as `users` — privilege escalation by
  traversal, found by the generated matrix.
- The step-up's **injected clock never reached the crypto**, so a two-window-old code verified.
- **`Secure` keyed to `NODE_ENV` broke login entirely** on any production build served over HTTP.
- A missing `ENGINE_SERVICE_SECRET` surfaced as a bare 500 rather than a named 503.

### What is NOT built

- **User CRUD is read-only.** Invite/disable/reset-TOTP/revoke-sessions are declared in the
  authorisation table but have no handlers, so **last-admin protection and self-role-change refusal
  are not implemented** and their tests are absent rather than vacuously passing.
- **Persona merge/split** are not implemented; their ledger actions are reserved.
- **Scheduled reports** belong with Phase 7's GitHub Actions work.

### Rollback

```bash
git revert <phase-4-sha>
```

### Flag state

`NEXT_PUBLIC_FF_COMMAND=1` in `web/.env.local` — **on**, its gate having passed. Not set in any
committed env file. The panel additionally needs `ENGINE_SERVICE_SECRET` (matching on both services)
and `PASSWORD_PEPPER`; without them it refuses with a 503 naming the variable.

### Next

**Phase 5 — SANGAM Pro.**

---

## Phase 5 — SANGAM Pro

**Status: COMPLETE, with six of ten layers unbuilt. DEC-061, DEC-062.**

| Check | Phase 4 | Phase 5 |
|---|---|---|
| `npm test` | 885 | **916 passed** |
| `uv run pytest -q` | 401 | **452 passed** / 17 skipped |
| `journey.mjs` | 108/108 | **123/123** |
| `npm run lint` / `build` | clean | clean; `/sangam` 121 kB |
| `forge test` | not run | not run — same stated condition |

**1,491 green.**

### Two findings closed

- **FINDING-09 (new, INV-1, Critical).** `routers/geo.py` handed **any** host to
  `socket.gethostbyname()`, including a `.onion`. Proven with a spy before fixing: the query *was*
  issued. The existing spy test patched a different function and never covered the geo router. Five
  spies now do, including one against the original code path.
- **FINDING-06 (from Phase 0b).** The fabricated Binance off-ramp is gone; its three `it.fails` tests
  are now ordinary assertions.

### What changed

1. **`engine/geo/classify.py`** — the three classes, the derivation rules, 1-dp rounding, freshness.
2. **`engine/geo/resolve.py`** — the onion guard **first**, a timestamped resolution chain, ASN and
   reverse DNS, and a disk cache whose age is shown rather than hidden.
3. **`routers/geo.py`** — extended, not rewritten: the old fields still return, four endpoints added.
4. **`lib/sangamClass.ts`** — shape-not-colour, comparison refusal, class-preserving GeoJSON/CSV.
5. **`components/sangam/SangamPro.tsx`** — legend, marker list, unplaced panel, resolution chain,
   re-resolve, host lookup.

### What is NOT built

- Six of the ten layers: certificate reuse, persona overlay, ASN clustering and jurisdiction render
  their toggles but draw nothing; the temporal scrubber, movement trails and density heat map are
  absent entirely.
- `/geo/asn` returns a null ASN (Cymru's interface is DNS TXT; `dnspython` is not a dependency). The
  ASN shown in the UI comes from `ipwho.is`.
- UNAVAILABLE does not appear in any actor's footprint, because no actor in this dataset carries a
  `.onion`. It is demonstrated through the host-lookup box instead.

### Rollback

```bash
git revert <phase-5-sha>
```

### Flag state

`NEXT_PUBLIC_FF_SANGAM_PRO=1` in `web/.env.local` — **on**, its gate having passed.

### Next

**Phase 6 — footer and cross-version linking.**

---

## Phase 6 — Footer and cross-version linking

**Status: COMPLETE. DEC-063.**

| Check | Phase 5 | Phase 6 |
|---|---|---|
| `npm test` | 916 | **950 passed** |
| `journey.mjs` | 123/123 | **137/137** |
| `uv run pytest -q` | 452 | unchanged |
| `npm run lint` / `build` | clean | clean |
| `forge test` | not run | not run — same stated condition |

**1,539 green.**

### What changed

1. **`components/system/Footer.tsx`** — full and slim variants, mounted once at the root so it is on
   every page by construction.
2. **`lib/serviceStatus.ts`** — four states, and **"unknown" is never rendered as "offline"**. A
   failed check is a fact about our knowledge, not about the service.
3. **`lib/buildInfo.ts`** — version, SHA and environment from build-time env, with Render and Vercel
   fallbacks and "not reported" where genuinely absent. Deliberately not keyed to `NODE_ENV`.

### Two missing footers, found by walking every route

`/workbench/classic` and `/command` had none — the root instance stands down for those prefixes and
neither shell rendered its own. Nothing in the unit suite could have caught it. Both fixed.

### Rollback

```bash
git revert <phase-6-sha>
```

### Next

**Phase 7 — always-on within the free tier.**

---

## Phase 7 — Always-on within the free tier

**Status: CONDITIONAL PASS. DEC-064, DEC-065.**

| Check | Phase 6 | Phase 7 |
|---|---|---|
| `npm test` | 950 | **986 passed** |
| `uv run pytest -q` | 452 | **482 passed** / 17 skipped |
| `journey.mjs` | 137/137 | **147/147** |
| `npm run warmup` | n/a | 3/3 awake, 4 caches warmed |
| `forge test` | not run | not run — same stated condition |

**1,615 green.**

### The figures were verified, and they changed the design

<https://render.com/docs/free>, 2026-09-03: **750 hours per workspace per calendar month, shared**;
15-minute spin-down; ~1-minute cold start; hours consumed only while running.

The playbook assumed two services and ~12 h/day. There are **three** sharing one pool, so the honest
window is **seven hours** — `750 × 0.85 ÷ 3 ÷ 30.44 = 6.98 h/service/day`. The schedule followed the
numbers, as the playbook itself instructed.

### Three defects found by running the code

- **The guard failed OPEN**: a corrupt artifact was indistinguishable from a missing one, so it
  believed nothing had been spent and pinged freely.
- **`date +%s%3N` is GNU-only** and BSD `date` *succeeds* with a literal `3N`, so every cache-warm
  timing on macOS was garbage.
- **`ENGINE_URL` gained a third reader**, caught by the pinned INV-2 test exactly as designed.

### Why CONDITIONAL

The gate's wording — *"both services warm through the whole configured window, measured monthly usage
inside the free allowance"* — needs a month of real running and the **account owner's usage page**,
which cannot be read from here (rule 7). Two facts are recorded in `docs/UPTIME.md` as conditions
rather than assumed: that the workspace holds exactly three free web services, and the month's actual
consumption. Everything mechanically verifiable is green.

### Rollback

```bash
git revert <phase-7-sha>
```

### Next

**Phase 8 — harden, measure, document, release.** The final gate: security pass over everything added,
Lighthouse and bundle analysis, an axe pass on every new route, ≥ 450 tests (already far exceeded),
docs complete, and a **fresh-clone run with no local state**.
