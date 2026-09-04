#!/usr/bin/env python3
"""The keep-alive RUNNER (DEC-075).

WHY THIS EXISTS, AND WHY THE CRON DID NOT WORK.

The first design was a `*/5` cron that woke, pinged once and exited. It was
correct arithmetic on a trigger that does not fire. Measured on this repo over
2026-09-03..04: the schedule asked for ~120 runs a day and GitHub delivered
FOUR IN TWO DAYS -- 07:39, 12:15 and 16:29 on the 3rd, 07:37 on the 4th. That
is not a bug in the workflow; GitHub documents `schedule` as best-effort and
drops high-frequency crons under load, and a run every four to nine hours is
useless against Render's fifteen-minute idle timer. The service was asleep for
essentially the whole "warm window", which is exactly what a user sees as the
project being down.

So the fix is to stop needing a frequent trigger. ONE run holds the runner for
a long SEGMENT, ticking every few minutes from inside a single job, and then
dispatches its own successor. A chain needs the scheduler to work once, not a
hundred and twenty times a day -- and `workflow_dispatch` fired with
GITHUB_TOKEN is one of the two events GitHub explicitly permits to start a new
run, so the chain is self-sustaining.

This is affordable only because the repo is PUBLIC: standard runners are free
and unmetered there, so the runner's wall-clock costs nothing. The scarce
resource is unchanged -- Render's 750 free instance hours per workspace per
month -- and every tick still asks the budget guard for permission.

The runner is not the authority on the budget. `keepalive_budget.py` is, and it
fails closed; this module imports it rather than re-deriving the arithmetic,
because two implementations of one budget is how a budget gets exceeded.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from keepalive_budget import (  # noqa: E402
    SPIN_DOWN_MINUTES,
    decide,
    in_window,
    load,
    normalise,
    seconds_until_window,
    settle,
)

#: Consecutive failures against one target before it is called broken. A cold
#: start can time out once; three in a row is a real fault worth an issue.
FAILURE_STREAK = 3


def http_get(url: str, timeout: float, method: str = "GET") -> tuple[int, str]:
    """Fetch, returning (status, brief body). Never raises.

    A cold start is a SLOW 200, not a failure, so the timeout has to exceed
    Render's ~60 s spin-up with room to spare. An HTTPError still carries a
    status and is a real answer from the service; only a URLError or a socket
    failure means nothing answered at all.
    """
    req = urllib.request.Request(url, method=method, headers={"User-Agent": "prahari-keepalive"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read(400).decode("utf-8", "replace")
    except urllib.error.HTTPError as e:  # answered, just not 2xx
        return e.code, e.reason or ""
    except Exception as exc:  # noqa: BLE001 - a ping never crashes the runner
        return 0, f"{exc.__class__.__name__}: {exc}"


def emit(outputs: dict[str, str]) -> None:
    """Write step outputs for the workflow, and echo them for the run log."""
    path = os.environ.get("GITHUB_OUTPUT")
    for k, v in outputs.items():
        print(f"::notice::{k}={v}" if k == "failures" and v else f"{k}={v}")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            for k, v in outputs.items():
                fh.write(f"{k}={v}\n")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", required=True)
    ap.add_argument("--pool", type=int, required=True)
    ap.add_argument("--services", type=int, required=True)
    ap.add_argument("--window-start", type=int, required=True)
    ap.add_argument("--window-end", type=int, required=True)
    ap.add_argument("--minutes", type=float, required=True,
                    help="how long this segment runs; must stay under the job timeout")
    ap.add_argument("--tick-seconds", type=float, default=300.0)
    ap.add_argument("--timeout", type=float, default=90.0)
    ap.add_argument("--target", action="append", default=[], metavar="NAME=URL")
    ap.add_argument("--warm-url", default="",
                    help="POSTed once per segment, on the first in-window tick")
    ap.add_argument("--lead-seconds", type=float, default=1800.0,
                    help="keep holding this long before the window reopens")
    ap.add_argument("--reservation", default="",
                    help="id of the budget reservation this segment settles")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    targets: list[tuple[str, str]] = []
    for spec in a.target:
        name, _, url = spec.partition("=")
        if url:
            targets.append((name.strip(), url.strip()))
    if not targets:
        emit({"failures": "", "ticks": "0", "reason": "no targets configured"})
        return 0

    state_path = Path(a.state)
    start = time.time()
    deadline = start + a.minutes * 60
    ws, we = a.window_start, a.window_end

    print(f"segment: {a.minutes:.0f} min, tick {a.tick_seconds:.0f}s, "
          f"window {ws:02d}:00-{we:02d}:00 UTC, {len(targets)} target(s)")

    # The reservation was made and PUSHED by the workflow before this step, so
    # that a runner reclaimed mid-segment leaves an unsettled claim behind
    # rather than no record at all. Unsettled overstates usage, which is the
    # safe direction: the next segment narrows instead of sailing past the pool.
    reservation: float | None = None
    if a.reservation:
        try:
            reservation = float(a.reservation)
        except ValueError:
            print(f"::warning::unparseable reservation {a.reservation!r}; nothing to settle")

    streaks: dict[str, int] = {n: 0 for n, _ in targets}
    first_ping: float | None = None
    last_ping: float | None = None
    warmed = False
    ticks = 0
    last_reason = "segment did not tick"

    while True:
        now = time.time()
        if now >= deadline:
            break

        # END WHEN THE WINDOW DOES. A 5.5-hour segment starting mid-window
        # outlives it, and idling on a GitHub runner until the deadline buys
        # nothing -- the budget is already spent and no ping is permitted. Stop
        # instead, on the same lead rule the workflow engages by, so the run
        # that starts at the close exits in seconds rather than sleeping.
        opens_in = seconds_until_window(now, ws, we)
        if opens_in > a.lead_seconds:
            print(f"window closed; ending the segment "
                  f"({opens_in / 3600:.1f} h until it reopens)")
            break

        # Re-read the state each tick: the budget is shared with whatever else
        # touches the artifact, and a decision made once at segment start would
        # be five hours stale by the end of it.
        try:
            state = normalise(load(state_path), now)
            d = decide(state, now, a.pool, a.services, ws, we)
        except Exception as exc:  # noqa: BLE001
            # FAIL CLOSED, exactly as the guard does.
            d = {"ok": False, "reason": f"guard failed ({exc.__class__.__name__})",
                 "used_pct": "unknown"}
        last_reason = d["reason"]

        if d["ok"] and not a.dry_run:
            ticks += 1
            stamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
            for name, url in targets:
                code, body = http_get(url, a.timeout)
                ok = 200 <= code < 400
                streaks[name] = 0 if ok else streaks[name] + 1
                print(f"{stamp} {name}: HTTP {code}"
                      + ("" if ok else f"  [{streaks[name]}x] {body[:120]}"))
                if ok:
                    first_ping = now if first_ping is None else first_ping
                    last_ping = now

            # Warm ONCE per segment, on the first tick that actually pinged.
            # /health/ping deliberately touches nothing and must stay under
            # 50 ms; warming builds the fusion signals, the calibrator and the
            # actors index (~20 s cold) so the first real request of the day is
            # fast rather than merely successful.
            if a.warm_url and not warmed and last_ping is not None:
                code, body = http_get(a.warm_url, 180.0, method="POST")
                warmed = 200 <= code < 400
                print(f"{stamp} warm: HTTP {code} {body[:160]}")
        else:
            print(f"{datetime.now(timezone.utc).strftime('%H:%M:%S')} hold: {d['reason']}")

        # Sleep to the next tick -- or straight through to the window opening,
        # whichever is sooner, never past the segment deadline.
        now = time.time()
        gap = a.tick_seconds
        if not in_window(datetime.fromtimestamp(now, timezone.utc).hour, ws, we):
            gap = max(a.tick_seconds, seconds_until_window(now, ws, we))
        gap = min(gap, deadline - now)
        if gap <= 0:
            break
        time.sleep(gap)

    # SETTLE with what actually happened. A ping keeps the service awake for
    # the spin-down window that follows it, so the segment's real cost runs to
    # the last ping plus that tail -- not to the runner's own exit.
    if reservation is not None:
        if last_ping is None:
            s_from, s_to = start, start  # never pinged: cost nothing
        else:
            s_from, s_to = first_ping, last_ping + SPIN_DOWN_MINUTES * 60
        if settle(state_path, reservation, s_from, s_to):
            print(f"settled {(s_to - s_from) / 3600:.2f} h of awake time")
        else:
            print(f"::warning::reservation {reservation} was not open to settle")

    broken = sorted(n for n, c in streaks.items() if c >= FAILURE_STREAK)
    emit({
        "failures": " ".join(broken),
        "ticks": str(ticks),
        "reason": last_reason,
        "warmed": "true" if warmed else "false",
    })
    return 0


if __name__ == "__main__":
    sys.exit(main())
