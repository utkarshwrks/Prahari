# UPTIME — keeping three free services warm without exceeding the free tier

**DEC-064, DEC-065.** Written from figures verified against Render's live
documentation on **2026-09-03**, not from memory and not from the playbook's
assumptions.

---

## 1. The verified figures

Confirmed at <https://render.com/docs/free>, quoted:

| Fact | Verified value | Wording |
|---|---|---|
| Free instance hours | **750 per month** | *"Render grants 750 Free instance hours to each workspace per calendar month"* |
| Scope of the pool | **Per workspace, shared** | The grant is to the **workspace**, not to each service |
| Spin-down | **15 minutes** | *"Free web service that goes 15 minutes without receiving any inbound traffic"* |
| Cold start | **~1 minute** | *"This process takes about one minute"* |
| When hours are consumed | **Only while running** | *"spun-down services don't consume Free instance hours"* |
| Free service count limit | **None stated** for web services | Only one free Postgres and one free Key Value per workspace |

### What still needs a human

The account's **usage page cannot be read from here** — it needs the owner's
login, and rule 7 of the playbook says those clicks are the user's. Two things
should therefore be confirmed on <https://dashboard.render.com> before relying
on this schedule:

1. **That there are exactly three free web services on the workspace.** Three
   are visible from this repository — `prahari-v2-engine`, `prahari-v2-web`
   (both in `render.yaml`) and `prahari-6njh` (v1). A fourth would change every
   number below.
2. **The month's consumption so far.** Render is the authority; the budget
   artifact in this repository is an *estimate* built from our own pings and is
   deliberately labelled as one.

If either differs, change `--services` in the workflow and the window hours
together. **The schedule adapts to the real numbers, not the other way round.**

---

## 2. The arithmetic

The playbook assumed two services and a ~12 h/day window. There are **three**,
and the pool is shared, so:

```
  750 h/month ÷ 3 services              = 250 h per service per month
  250 h ÷ 30.44 days                    = 8.21 h per service per day
  with the 85 % guard: 637.5 ÷ 3 ÷ 30.44 = 6.98 h per service per day
```

**Three services awake 24/7 would need 3 × 24 × 30.44 ≈ 2,192 hours.** The pool
is 750. That is the whole design problem, and it is why the answer is a budgeted
warm window rather than a ping loop.

### The window

**04:00–11:00 UTC — seven hours a day.**

- Seven hours fits inside the 6.98 h guarded budget with the month's rounding
  absorbing the difference.
- 04:00–11:00 UTC is **09:30–16:30 IST**: an Indian working day and any
  plausible demo slot.
- Outside it, all three services sleep and consume nothing. The UI says so
  rather than pretending they are warm.

### The interval

**Ten minutes**, against a fifteen-minute timeout. Not fourteen: GitHub's cron
is best-effort, not guaranteed, and at a fourteen-minute interval a single
skipped run lets the service sleep. Ten leaves room for one miss.

---

## 3. What runs

| Piece | Where | What it does |
|---|---|---|
| `GET /health/ping` | engine | Touches **no** database, no Neo4j, no external API. Reports uptime, pings in 24 h, budget used, next window. Logged at DEBUG. |
| `GET /api/health` | web | Static. `?deep=1` optionally proxies the engine's ping. |
| `.github/workflows/keepalive.yml` | GitHub Actions | Cron `*/10 4-10 UTC`. Free for public repositories, so no server and no cost. |
| `scripts/keepalive_budget.py` | the workflow | The guard. Stdlib-only, runs before any dependency install. |
| `.github/keepalive-budget.json` | the repository | The committed estimate of what has been spent. |
| `scripts/warmup.sh` / `npm run warmup` | a laptop | Pre-demo: wakes all three, polls until each answers, prints measured cold-start times, warms the engine caches. |

### The guard

- **Narrows at 85 %** of a service's share: pinging drops to half rate, so the
  services stay reachable but colder.
- **Stops at 100 %.** No pinging at all for the rest of the calendar month.
- **Fails closed.** A missing artifact is a legitimate first run and pinging
  proceeds; an artifact that exists but cannot be parsed — bad JSON, wrong
  shape, non-numeric entries — **stops pinging**. The first version of the
  guard returned an empty state for both cases, so a corrupt file made it
  believe nothing had been spent and ping freely. That is failing *open*, which
  is the one direction this guard must never fail in.
- **The workflow refuses to run if the cron hours and the configured window
  disagree.** A schedule that contradicts its own guard burns budget outside
  the window it claims to keep.

### Failure is loud

Three consecutive non-2xx responses from a target open or update a GitHub issue
labelled `keepalive`. **A slow 200 is a cold start, not a failure**, and is not
counted. Silent keep-alive failure on demo morning is the exact scenario this
phase exists to prevent.

---

## 4. Cross-pinging is off by default

`KEEPALIVE_CROSS=1` enables it, and it is off because of a specific failure
mode: web pinging engine and engine pinging web keeps **both** awake
indefinitely and **outside the window**, silently burning the shared pool. Two
services in a mutual ping loop consume 2 × 730 = 1,460 hours a month against a
750-hour pool, and nothing in the system would report it until the workspace was
suspended.

If it is ever enabled it must be **window-aware and one-directional at a time**.
The safe backstop is the GitHub cron, which cannot loop.

---

## 5. Honest degradation

When the workflow is disabled, the budget is exhausted, or the window is closed,
the UI says **"service may cold-start, allow 30–60 s"** — it does not pretend
the service is warm. The footer's status dot distinguishes:

- **live** — answered inside the budget
- **waking** — a cold start, with the wait a viewer should expect
- **unknown** — the *check itself* failed. Never rendered as "offline"

Every figure on the status card is measured. None is hardcoded (INV-4).

---

## 6. The estimate is an estimate

The budget artifact counts pings and credits each with the interval it covers,
capped at the fifteen-minute spin-down window. It is a **floor** on usage:
traffic from real users also keeps a service awake and is not counted here.

**Render's dashboard is the authority.** This number exists so the workflow can
throttle itself without asking, not so anyone can stop checking.
