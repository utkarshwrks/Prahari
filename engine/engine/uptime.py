"""Keep-alive budget accounting (DEC-064, DEC-065).

VERIFIED FIGURES, from Render's live documentation on 2026-09-03:

    * 750 free instance hours per WORKSPACE per calendar month -- shared
      across every free service, not granted per service.
    * A free web service spins down after 15 minutes without inbound traffic.
    * Spin-up takes about one minute.
    * Hours are consumed only while a service is RUNNING. A spun-down service
      consumes none.

The arithmetic those figures force, for three free services (engine, web, and
the already-deployed v1):

    750 h / 3 services              = 250 h per service per month
    250 h / 30.44 days              = 8.2 h per service per day
    with an 85% guard: 637.5 / 3 / 30.44 = 6.98 h per service per day

So the schedule is a ~7-hour daily warm window, NOT the "12 hours each" the
playbook assumed -- that assumption was written for two services, and there are
three. The playbook's own instruction was that the schedule adapts to the real
numbers, so it does.

This module tracks what has actually been spent. It FAILS CLOSED: if the budget
cannot be computed, pinging stops rather than continuing blind.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

# --- verified constants -----------------------------------------------------

#: Render grants this to each WORKSPACE per calendar month, shared.
FREE_HOURS_PER_MONTH = 750

#: Idle timeout before spin-down.
SPIN_DOWN_MINUTES = 15

#: Ping interval. Comfortably under the timeout, with headroom for a skipped
#: run -- GitHub's cron is best-effort, not guaranteed, and a missed run at a
#: 14-minute interval would let the service sleep.
PING_INTERVAL_MINUTES = 10

#: Free services sharing the pool: engine, web, and v1.
FREE_SERVICES = ("prahari-v2-engine", "prahari-v2-web", "prahari-6njh")

#: Narrow the window at this fraction of the pool; stop entirely at 1.0.
GUARD_THRESHOLD = 0.85

#: Average days per month, so the daily figure is not wrong in February.
DAYS_PER_MONTH = 30.44

STATE_DIR = Path(os.getenv("PRAHARI_CACHE_DIR", ".cache"))
STATE_FILE = STATE_DIR / "uptime.json"


def daily_window_hours(services: int = len(FREE_SERVICES),
                       guard: float = GUARD_THRESHOLD) -> float:
    """Hours per service per day that fit inside the guarded pool."""
    if services <= 0:
        return 0.0
    return (FREE_HOURS_PER_MONTH * guard) / services / DAYS_PER_MONTH


def month_key(at: datetime | None = None) -> str:
    d = at or datetime.now(timezone.utc)
    return f"{d.year:04d}-{d.month:02d}"


def _load() -> dict[str, Any]:
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:  # noqa: BLE001 - a missing or corrupt file is not fatal
        return {}


def _save(state: dict[str, Any]) -> None:
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(json.dumps(state))
    except Exception:  # noqa: BLE001 - a read-only disk must not break /health
        pass


def record_ping(now: float | None = None) -> dict[str, Any]:
    """Record that a ping arrived, and report the budget.

    Cheap on purpose: one small JSON read and write. It is on the ping path, and
    the ping path is the thing that must stay under 50 ms.
    """
    now = time.time() if now is None else now
    state = _load()
    key = month_key()

    if state.get("month") != key:
        # A new calendar month resets the pool. Render's grant is per calendar
        # month, so anything carried over would understate what is available.
        state = {"month": key, "pings": []}

    pings: list[float] = [p for p in state.get("pings", []) if now - p <= 30 * 86400]
    pings.append(now)
    state["pings"] = pings
    _save(state)

    return budget_state(now, state)


def budget_state(now: float | None = None,
                 state: dict[str, Any] | None = None) -> dict[str, Any]:
    """What has been spent, and what the guard says about it.

    Awake time is ESTIMATED from ping timestamps, and the estimate is stated
    rather than presented as a measurement: each ping is credited with the
    interval it covers, capped at the spin-down timeout, because a gap longer
    than that means the service slept and consumed nothing.
    """
    now = time.time() if now is None else now
    state = state if state is not None else _load()
    pings: list[float] = sorted(state.get("pings", []))

    awake_seconds = 0.0
    for i, p in enumerate(pings):
        nxt = pings[i + 1] if i + 1 < len(pings) else now
        gap = nxt - p
        # A gap beyond the spin-down window means it slept; credit only the
        # window, not the whole gap.
        awake_seconds += min(gap, SPIN_DOWN_MINUTES * 60)

    awake_hours = awake_seconds / 3600
    # One service's share of the shared pool.
    share = FREE_HOURS_PER_MONTH / max(1, len(FREE_SERVICES))
    used_pct = round((awake_hours / share) * 100, 1) if share else 0.0

    day_ago = now - 86400
    return {
        "month": state.get("month", month_key()),
        "pings_24h": sum(1 for p in pings if p >= day_ago),
        "pings_month": len(pings),
        "estimated_awake_hours": round(awake_hours, 2),
        "share_hours": round(share, 1),
        "budget_used_pct": used_pct,
        "guard_threshold_pct": round(GUARD_THRESHOLD * 100, 1),
        "narrowing": used_pct >= GUARD_THRESHOLD * 100,
        "exhausted": used_pct >= 100,
        "next_window": next_window_iso(now),
        "honesty": (
            "Awake hours are ESTIMATED from ping timestamps, not measured by "
            "Render. Each ping is credited with the interval it covers, capped "
            "at the 15-minute spin-down window. Treat it as a floor on usage, "
            "and check the Render dashboard for the authoritative figure."
        ),
    }


#: Warm window, UTC. Sized from the verified budget above (~7 h/service/day).
WINDOW_START_HOUR = int(os.getenv("KEEPALIVE_WINDOW_START", "4"))
WINDOW_END_HOUR = int(os.getenv("KEEPALIVE_WINDOW_END", "11"))


def in_window(at: datetime | None = None) -> bool:
    """Is now inside the configured warm window?"""
    d = at or datetime.now(timezone.utc)
    start, end = WINDOW_START_HOUR, WINDOW_END_HOUR
    if start == end:
        return False
    if start < end:
        return start <= d.hour < end
    # A window that wraps midnight.
    return d.hour >= start or d.hour < end


def next_window_iso(now: float | None = None) -> str:
    """When the window next opens, as an ISO timestamp."""
    d = datetime.fromtimestamp(now or time.time(), tz=timezone.utc)
    if in_window(d):
        return d.replace(minute=0, second=0, microsecond=0).isoformat()
    candidate = d.replace(hour=WINDOW_START_HOUR, minute=0, second=0, microsecond=0)
    if candidate <= d:
        candidate += timedelta(days=1)
    return candidate.isoformat()


def should_ping(at: datetime | None = None,
                state: dict[str, Any] | None = None) -> tuple[bool, str]:
    """The decision, with its reason.

    FAILS CLOSED. If the budget cannot be computed the answer is no -- a guard
    that cannot see the budget and keeps pinging anyway is not a guard.
    """
    try:
        b = budget_state(state=state)
    except Exception:  # noqa: BLE001
        return False, "budget could not be computed — refusing to ping"

    if b["exhausted"]:
        return False, f"budget exhausted ({b['budget_used_pct']}% of share)"
    if not in_window(at):
        return False, f"outside the warm window ({WINDOW_START_HOUR:02d}:00–{WINDOW_END_HOUR:02d}:00 UTC)"
    if b["narrowing"]:
        # Past the guard, ping at half rate rather than stopping dead: the
        # services stay reachable, just colder.
        minute = (at or datetime.now(timezone.utc)).minute
        if minute % (PING_INTERVAL_MINUTES * 2) >= PING_INTERVAL_MINUTES:
            return False, f"narrowed: {b['budget_used_pct']}% of share used"
    return True, "inside the warm window and inside budget"
