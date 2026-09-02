# UPGRADE v2.1 — living log

The v2.1 upgrade turns the single-page workbench into a routed analyst workspace, adds a graph
intelligence lab, a hardened Command Panel, SANGAM Pro, a footer, and a budgeted keep-alive.

**Prime directive: additive only. Nothing that works today may stop working.**

Executed one phase per session, on branch `feat/v2.1-workspace` off `v2-rebuild` @ `800d9ae`.
No phase starts until the previous phase's gate is green. This file records what changed, why, and
what to revert if a phase fails.

---

## Phase 0 — Baseline lock

**Status: BLOCKED. The baseline is red, and Phase 1 does not start against it.**

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
