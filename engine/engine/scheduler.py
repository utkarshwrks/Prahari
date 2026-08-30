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


_last_graph_reload: datetime | None = None
_graph_reloads = 0


def _heartbeat() -> None:
    global _last_heartbeat, _tick_count
    _last_heartbeat = datetime.now(timezone.utc)
    _tick_count += 1
    log.debug("scheduler heartbeat", extra={"tick": _tick_count})


def _reload_graph() -> None:
    """Autonomous mode: keep the identity graph current.

    Neo4j being down is a normal state, not a job failure -- the workbench
    keeps running and /sources reports the graph as stale.
    """
    global _last_graph_reload, _graph_reloads
    try:
        from .engines import graph as G

        ok, err = G.ping()
        if not ok:
            log.info("graph reload skipped", extra={"reason": err})
            return
        from .engines.loader import load_testbed

        res = load_testbed()
        _last_graph_reload = datetime.now(timezone.utc)
        _graph_reloads += 1
        log.info("graph reloaded", extra=res)
    except Exception:  # noqa: BLE001 - a scheduled job must never kill the app
        log.exception("graph reload failed")


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
    _scheduler.add_job(
        _reload_graph,
        "interval",
        minutes=10,
        id="graph_reload",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
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
        "last_graph_reload": _last_graph_reload.isoformat() if _last_graph_reload else None,
        "graph_reloads": _graph_reloads,
    }
