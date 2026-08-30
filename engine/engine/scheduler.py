"""APScheduler - the seed of autonomous mode.

Phase 2 ships one no-op job so the wiring, lifecycle and shutdown are proven
before Phase 4 hangs a graph reload on it. The job records a heartbeat so
/sources can report that the scheduler is genuinely running, not just created.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler

log = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None
_last_heartbeat: datetime | None = None
_tick_count = 0


def _heartbeat() -> None:
    """No-op job. Phase 4 replaces the body with a graph reload."""
    global _last_heartbeat, _tick_count
    _last_heartbeat = datetime.now(timezone.utc)
    _tick_count += 1
    log.debug("scheduler heartbeat", extra={"tick": _tick_count})


def start_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler and _scheduler.running:
        return _scheduler
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(
        _heartbeat,
        "interval",
        seconds=30,
        id="heartbeat",
        replace_existing=True,
        next_run_time=datetime.now(timezone.utc),  # fire once immediately
    )
    _scheduler.start()
    log.info("scheduler started", extra={"jobs": [j.id for j in _scheduler.get_jobs()]})
    return _scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        log.info("scheduler stopped")
    _scheduler = None


def scheduler_status() -> dict[str, object]:
    return {
        "running": bool(_scheduler and _scheduler.running),
        "jobs": [j.id for j in _scheduler.get_jobs()] if _scheduler else [],
        "last_heartbeat": _last_heartbeat.isoformat() if _last_heartbeat else None,
        "ticks": _tick_count,
    }
