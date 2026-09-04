#!/usr/bin/env python3
"""The keep-alive budget guard (DEC-065, DEC-075).

Runs inside the GitHub Actions workflow. It decides whether pinging is allowed
and accounts for the awake time the pinging causes.

IT FAILS CLOSED. If the state file is unreadable, the arithmetic cannot be done,
or anything else goes wrong, the answer is NO. A guard that cannot see the
budget and keeps pinging anyway is not a guard -- and the cost of being wrong in
that direction is a suspended service on demo morning.

Deliberately stdlib-only: it runs before any dependency install, and a guard
that needs `pip install` to decide whether to ping is a guard that can fail for
reasons entirely unrelated to the budget.

ACCOUNTING (DEC-075). The original schema recorded one timestamp per ping and
credited each with the interval it covered. That was right for a workflow that
woke, pinged once and exited. The runner now holds a service awake across a
whole SEGMENT, so it records the segment as an interval instead:

    {"month": "...", "pings": [...legacy...], "awake": [{"from":.., "to":..}]}

Both are counted, merged as a union so an overlap is never billed twice.

A segment RESERVES its interval up front and settles it to the real value when
it finishes. If the runner is cancelled mid-segment -- which happens, GitHub
reclaims runners -- the reservation stands unsettled and OVERSTATES usage. That
is the correct direction to be wrong in.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

SPIN_DOWN_MINUTES = 15
PING_INTERVAL_MINUTES = 10
DAYS_PER_MONTH = 30.44
GUARD_THRESHOLD = 0.85


def month_key(at: datetime | None = None) -> str:
    d = at or datetime.now(timezone.utc)
    return f"{d.year:04d}-{d.month:02d}"


class Unreadable(Exception):
    """The state exists but cannot be understood."""


def load(path: Path) -> dict:
    """Read the budget artifact.

    A MISSING file and a CORRUPT one are different, and the difference decides
    whether we ping. Missing means a first run: the budget genuinely is zero.
    Corrupt means we cannot compute the budget at all -- and the first version
    of this function returned `{}` for both, so an unreadable artifact made the
    guard believe nothing had been spent and ping freely. That is failing OPEN,
    which is the one direction this guard must never fail in.
    """
    if not path.exists():
        return {"month": None, "pings": [], "awake": []}
    try:
        data = json.loads(path.read_text())
    except Exception as exc:  # noqa: BLE001
        raise Unreadable(f"{path} is not valid JSON") from exc
    if not isinstance(data, dict):
        raise Unreadable(f"{path} does not contain an object")
    pings = data.get("pings")
    if pings is not None and not isinstance(pings, list):
        raise Unreadable(f"{path} has a malformed pings field")
    awake = data.get("awake")
    if awake is not None and not isinstance(awake, list):
        raise Unreadable(f"{path} has a malformed awake field")
    return data


def save(path: Path, state: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=0) + "\n")


def in_window(hour: int, start: int, end: int) -> bool:
    if start == end:
        return False
    return start <= hour < end if start < end else (hour >= start or hour < end)


def normalise(state: dict, now: float) -> dict:
    """Return the state for the CURRENT month, with both lists validated.

    Render's grant is per CALENDAR MONTH, so a new month starts clean.
    """
    key = month_key()
    if state.get("month") != key:
        return {"month": key, "pings": [], "awake": []}

    raw = state.get("pings") or []
    numeric = [p for p in raw if isinstance(p, (int, float))]
    if len(numeric) != len(raw):
        # Silently dropping entries would UNDERSTATE usage, which is the wrong
        # direction: it would let us ping past the budget.
        raise Unreadable("the pings list contains non-numeric entries")

    spans = []
    for item in state.get("awake") or []:
        if not isinstance(item, dict):
            raise Unreadable("the awake list contains a non-object entry")
        a, b = item.get("from"), item.get("to")
        if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
            raise Unreadable("an awake entry has a malformed from/to")
        spans.append({
            "from": float(a),
            "to": float(b),
            "provisional": bool(item.get("provisional")),
        })

    return {
        "month": key,
        "pings": sorted(float(p) for p in numeric),
        "awake": sorted(spans, key=lambda s: s["from"]),
    }


def awake_seconds(state: dict, now: float) -> float:
    """Total awake time this month, as a UNION of every recorded source.

    A legacy ping is credited with the interval it covers, capped at the
    spin-down window -- a longer gap means the service slept and consumed
    nothing. Segments contribute their span directly. Merging the two as a
    union matters because a month can contain both, and billing an overlap
    twice would narrow the window for no reason.
    """
    spans: list[tuple[float, float]] = []

    pings = state["pings"]
    for i, p in enumerate(pings):
        nxt = pings[i + 1] if i + 1 < len(pings) else now
        spans.append((p, p + min(nxt - p, SPIN_DOWN_MINUTES * 60)))

    for s in state["awake"]:
        # An unsettled reservation may point into the future; that is the
        # intended pessimism, but never credit past `now` plus the spin-down
        # tail, or a stale reservation would bill the rest of the month.
        spans.append((s["from"], min(s["to"], now + SPIN_DOWN_MINUTES * 60)))

    total = 0.0
    cur_a = cur_b = None
    for a, b in sorted(spans):
        if b <= a:
            continue
        if cur_b is None or a > cur_b:
            if cur_b is not None:
                total += cur_b - cur_a
            cur_a, cur_b = a, b
        else:
            cur_b = max(cur_b, b)
    if cur_b is not None:
        total += cur_b - cur_a
    return total


def planned_awake_seconds(start: float, deadline: float, ws: int, we: int) -> float:
    """How much of [start, deadline] falls inside the warm window.

    This is what a segment RESERVES up front. Minute-by-minute rather than
    clever: a segment is a few hundred minutes, the loop is free, and an
    off-by-one in a hand-rolled interval intersection would silently misstate
    the budget.
    """
    total = 0.0
    t = start
    while t < deadline:
        if in_window(datetime.fromtimestamp(t, timezone.utc).hour, ws, we):
            total += min(60.0, deadline - t)
        t += 60.0
    return total


def seconds_until_window(now: float, ws: int, we: int) -> float:
    """Time until the window next opens. Zero if it is open already.

    The runner uses this twice: to decide whether it is worth engaging at all,
    and to sleep straight through to the opening in one go rather than waking
    every five minutes to re-learn that the window is shut.
    """
    at = datetime.fromtimestamp(now, timezone.utc)
    if in_window(at.hour, ws, we):
        return 0.0
    for ahead in range(0, 49):
        t = (at + timedelta(hours=ahead)).replace(minute=0, second=0, microsecond=0)
        if t.timestamp() > now and in_window(t.hour, ws, we):
            return t.timestamp() - now
    return 3600.0


def reserve(path: Path, minutes: float, ws: int, we: int,
            now: float | None = None) -> tuple[float, float]:
    """Claim the in-window share of the next `minutes` up front.

    Returns (id, seconds). The id is the reservation's start timestamp, which is
    also its key -- there is at most one open reservation at a time because the
    workflow's concurrency group permits at most one runner.
    """
    now = time.time() if now is None else now
    state = normalise(load(path), now)
    seconds = planned_awake_seconds(now, now + minutes * 60, ws, we)
    state["awake"].append({"from": now, "to": now + seconds, "provisional": True})
    save(path, state)
    return now, seconds


def settle(path: Path, res_id: float, s_from: float | None, s_to: float) -> bool:
    """Close a reservation with what the segment actually consumed."""
    state = normalise(load(path), time.time())
    for s in state["awake"]:
        # Float equality is safe: the id IS the stored value, round-tripped
        # through the same decimal repr.
        if s["from"] == res_id and s["provisional"]:
            # A segment that began outside the window reserved from its own
            # start, but only caused awake time from its FIRST ping. Settling
            # both ends turns the pessimistic claim into the real one.
            if s_from is not None:
                s["from"] = s_from
            s["to"] = max(s["from"], s_to)
            s["provisional"] = False
            save(path, state)
            return True
    # No matching reservation. Do NOT invent one: an unmatched settle means the
    # reserve never landed, and adding the span here would be indistinguishable
    # from double-billing a settled one.
    save(path, state)
    return False


def decide(state: dict, now: float, pool: int, services: int,
           window_start: int, window_end: int) -> dict:
    share_h = pool / max(1, services)
    used_pct = round((awake_seconds(state, now) / 3600) / share_h * 100, 1) if share_h else 100.0
    at = datetime.fromtimestamp(now, timezone.utc)

    if used_pct >= 100:
        ok, reason = False, f"budget exhausted: {used_pct}% of a {share_h:.0f}h share"
    elif not in_window(at.hour, window_start, window_end):
        ok, reason = False, f"outside the window ({window_start:02d}:00-{window_end:02d}:00 UTC)"
    elif used_pct >= GUARD_THRESHOLD * 100:
        # Narrow rather than stop: the services stay reachable, just colder.
        halved = at.minute % (PING_INTERVAL_MINUTES * 2) < PING_INTERVAL_MINUTES
        ok = halved
        reason = (
            f"narrowed to half rate at {used_pct}% of share"
            if halved else
            f"skipped this slot: narrowed at {used_pct}% of share"
        )
    else:
        ok, reason = True, f"in window, {used_pct}% of a {share_h:.0f}h share used"

    return {"ok": ok, "reason": reason, "used_pct": used_pct, "share_h": share_h}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", required=True)
    ap.add_argument("--pool", type=int, required=True)
    ap.add_argument("--services", type=int, required=True)
    ap.add_argument("--window-start", type=int, required=True)
    ap.add_argument("--window-end", type=int, required=True)
    ap.add_argument("--lead-seconds", type=float, default=1800.0,
                    help="engage this long before the window opens, to hand over on time")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--record", action="store_true",
                      help="append a single legacy ping timestamp")
    mode.add_argument("--reserve-minutes", type=float, metavar="MINUTES",
                      help="claim the in-window share of the next MINUTES; prints its id")
    mode.add_argument("--settle", type=float, metavar="ID",
                      help="close the reservation with id ID")
    ap.add_argument("--settle-to", type=float, default=None,
                    help="the real end of the segment (default: now)")
    ap.add_argument("--settle-from", type=float, default=None,
                    help="the real start of the segment (default: unchanged)")
    a = ap.parse_args()

    path = Path(a.state)
    now = time.time()

    if a.record:
        state = normalise(load(path), now)
        state["pings"].append(now)
        save(path, state)
        return 0

    if a.reserve_minutes is not None:
        rid, seconds = reserve(path, a.reserve_minutes, a.window_start, a.window_end, now)
        # str(float) is the shortest round-tripping form in Python 3, so the id
        # parses back to the identical double the settle step compares against.
        print(f"reservation={rid}")
        print(f"reserved_hours={seconds / 3600:.2f}")
        return 0

    if a.settle is not None:
        ok = settle(path, a.settle, a.settle_from,
                    a.settle_to if a.settle_to is not None else now)
        if not ok:
            print(f"::warning::no open reservation {a.settle} to settle", file=sys.stderr)
        return 0

    state = normalise(load(path), now)
    d = decide(state, now, a.pool, a.services, a.window_start, a.window_end)
    print(f"should_ping={'true' if d['ok'] else 'false'}")
    print(f"reason={d['reason']}")
    print(f"used_pct={d['used_pct']}")
    print(f"share_hours={d['share_h']:.0f}")
    print(f"daily_budget_hours={(a.pool * GUARD_THRESHOLD) / max(1, a.services) / DAYS_PER_MONTH:.2f}")

    # ENGAGE decides whether holding a runner is worth it at all.
    #
    # A segment that starts outside the window would otherwise sit on a GitHub
    # runner for hours doing nothing, which is both wasteful and the part of
    # this design least defensible under Actions' acceptable use. So a run that
    # lands outside the window exits in seconds and does NOT chain -- if it did,
    # its successor would start immediately, exit immediately, and dispatch
    # again in a tight loop. The hourly cron is the way back in, and outside the
    # window a delay of minutes costs nothing.
    #
    # The lead time is what makes the handover punctual: a run landing shortly
    # before the window engages, sleeps to the opening and starts ticking on it.
    opens_in = seconds_until_window(now, a.window_start, a.window_end)
    engage = opens_in <= a.lead_seconds and d["used_pct"] < 100
    print(f"in_window={'true' if opens_in == 0 else 'false'}")
    print(f"opens_in_s={opens_in:.0f}")
    print(f"engage={'true' if engage else 'false'}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001
        # FAIL CLOSED. Any failure at all means we do not ping.
        print("should_ping=false")
        print(f"reason=guard failed ({exc.__class__.__name__}) — refusing to ping")
        print("used_pct=unknown")
        sys.exit(0)
