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

### What the arithmetic does NOT allow, stated plainly

Even two services awake around the clock need 2 × 730 = **1,460 hours** against
a pool of 750. **No schedule keeps these services up 24/7 on the free tier** —
not a shorter ping interval, not a cleverer cron. Anything claiming otherwise is
either burning someone else's budget or lying. Ten hours a day is the honest
maximum, and outside the window the UI says a cold start is coming rather than
pretending the service is warm.

### The divisor is the lever, not the interval

The single most useful thing to understand here: **Render bills hours awake, not
requests.** Pinging every 5 minutes and pinging every 10 minutes keep a service
awake for exactly the same number of hours and therefore cost exactly the same.
The interval only decides how reliably the service *stays* awake.

What actually costs budget is `window length × services kept warm`. So the way
to buy a longer window is to keep fewer services warm:

```
  3 services (engine + web + v1):  637.5 ÷ 3 ÷ 30.44 =  6.98 h/day each
  2 services (engine + web):       637.5 ÷ 2 ÷ 30.44 = 10.47 h/day each
```

v1 is a standalone demo that nobody is mid-investigation on, so it is **opt-in**
(`PING_V1=0`). That single change buys engine and web a ten-hour window instead
of a seven-hour one. Set `PING_V1=1` **and** `KEPT_WARM=3`, and narrow the cron
to match, to put it back.

### The window

**03:00–13:00 UTC — ten hours a day.**

- Ten hours fits inside the 10.47 h guarded two-service budget.
- 03:00–13:00 UTC is **08:30–18:30 IST**: a full Indian working day, and any
  plausible demo or judging slot.
- Outside it the services sleep and consume nothing. The UI says so rather than
  pretending they are warm.

### The interval

**Five minutes**, against a fifteen-minute timeout.

The interval is free (see above), so it is chosen purely for reliability. At ten
minutes, one skipped run leaves a 20-minute gap and the service sleeps; GitHub's
scheduled workflows are explicitly best-effort and are routinely delayed by
several minutes under load. At five minutes, **two** consecutive runs can be
missed entirely and the service still stays up.

---

## 2b. Why a woken service can still feel slow

Waking the process is not the same as making it fast, and conflating the two is
why "it works locally but the deployed one is slow" persists after a keep-alive
is added. There are **three** distinct delays:

| Delay | Duration | Fixed by |
|---|---|---|
| **Cold start** — the instance is asleep and must boot | 30–60 s | the ping window |
| **Cold caches** — the instance is up but `build_signals()`, the calibrator and the actors index are unbuilt | ~20 s on the first real call | `POST /health/warm` |
| **A dependency is down** — Neo4j or an upstream is unreachable | varies | `GET /health/diagnostics` names which |

The keep-alive ping deliberately fixes only the first. `GET /health/ping` must
stay under 50 ms and touch nothing, so it cannot warm anything — a ping that
rebuilt caches every five minutes would burn CPU continuously for no benefit.

So the workflow calls `POST /health/warm` **once, at the top of the window**.
That builds all three caches before any human arrives, which is what makes the
first request of the day as fast as a local run.

`GET /health/diagnostics` reports which of the three is currently true, and it
found a real bug when it was written: the engine's startup routine warmed
`build_signals()` and the calibrator but **not the actors index**, so every cold
start rebuilt that index on the first `/actors` call — the first call the
workbench, the actor list and SANGAM all make. The engine reported itself warm
while the product felt slow. See DEC-066.

---

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
