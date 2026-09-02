#!/usr/bin/env python3
"""The keep-alive budget guard (DEC-065).

Runs inside the GitHub Actions workflow, before any ping. It decides whether
pinging is allowed and writes the decision to $GITHUB_OUTPUT.

IT FAILS CLOSED. If the state file is unreadable, the arithmetic cannot be done,
or anything else goes wrong, the answer is NO. A guard that cannot see the
budget and keeps pinging anyway is not a guard -- and the cost of being wrong in
that direction is a suspended service on demo morning.

Deliberately stdlib-only: it runs before any dependency install, and a guard
that needs `pip install` to decide whether to ping is a guard that can fail for
reasons entirely unrelated to the budget.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
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
        return {"month": None, "pings": []}
    try:
        data = json.loads(path.read_text())
    except Exception as exc:  # noqa: BLE001
        raise Unreadable(f"{path} is not valid JSON") from exc
    if not isinstance(data, dict):
        raise Unreadable(f"{path} does not contain an object")
    pings = data.get("pings")
    if pings is not None and not isinstance(pings, list):
        raise Unreadable(f"{path} has a malformed pings field")
    return data


def in_window(hour: int, start: int, end: int) -> bool:
    if start == end:
        return False
    return start <= hour < end if start < end else (hour >= start or hour < end)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", required=True)
    ap.add_argument("--pool", type=int, required=True)
    ap.add_argument("--services", type=int, required=True)
    ap.add_argument("--window-start", type=int, required=True)
    ap.add_argument("--window-end", type=int, required=True)
    ap.add_argument("--record", action="store_true",
                    help="append a ping to the artifact instead of deciding")
    a = ap.parse_args()

    path = Path(a.state)
    now = time.time()
    state = load(path)
    key = month_key()

    # Render's grant is per CALENDAR MONTH, so a new month starts clean.
    if state.get("month") != key:
        state = {"month": key, "pings": []}

    raw = state.get("pings", [])
    numeric = [p for p in raw if isinstance(p, (int, float))]
    if len(numeric) != len(raw):
        # Silently dropping entries would UNDERSTATE usage, which is the wrong
        # direction: it would let us ping past the budget.
        raise Unreadable("the pings list contains non-numeric entries")
    pings = sorted(float(p) for p in numeric)

    if a.record:
        pings.append(now)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"month": key, "pings": pings}, indent=0))
        return 0

    # Estimated awake time: each ping is credited with the interval it covers,
    # capped at the spin-down window -- a longer gap means the service slept and
    # consumed nothing.
    awake_s = 0.0
    for i, p in enumerate(pings):
        nxt = pings[i + 1] if i + 1 < len(pings) else now
        awake_s += min(nxt - p, SPIN_DOWN_MINUTES * 60)

    share_h = a.pool / max(1, a.services)
    used_pct = round((awake_s / 3600) / share_h * 100, 1) if share_h else 100.0
    hour = datetime.now(timezone.utc).hour

    if used_pct >= 100:
        ok, reason = False, f"budget exhausted: {used_pct}% of a {share_h:.0f}h share"
    elif not in_window(hour, a.window_start, a.window_end):
        ok, reason = False, f"outside the window ({a.window_start:02d}:00-{a.window_end:02d}:00 UTC)"
    elif used_pct >= GUARD_THRESHOLD * 100:
        # Narrow rather than stop: the services stay reachable, just colder.
        minute = datetime.now(timezone.utc).minute
        halved = minute % (PING_INTERVAL_MINUTES * 2) < PING_INTERVAL_MINUTES
        ok = halved
        reason = (
            f"narrowed to half rate at {used_pct}% of share"
            if halved else
            f"skipped this slot: narrowed at {used_pct}% of share"
        )
    else:
        ok, reason = True, f"in window, {used_pct}% of a {share_h:.0f}h share used"

    print(f"should_ping={'true' if ok else 'false'}")
    print(f"reason={reason}")
    print(f"used_pct={used_pct}")
    print(f"share_hours={share_h:.0f}")
    print(f"daily_budget_hours={(a.pool * GUARD_THRESHOLD) / max(1, a.services) / DAYS_PER_MONTH:.2f}")
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
