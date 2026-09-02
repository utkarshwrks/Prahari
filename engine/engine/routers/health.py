"""Health and version. Must answer with no .env and with Postgres down."""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone

from fastapi import APIRouter

from ..db import ping
from ..scheduler import scheduler_status
from ..settings import get_settings
from ..uptime import budget_state, record_ping

router = APIRouter(tags=["meta"])

log = logging.getLogger(__name__)

#: Process start, captured at import. Uptime is measured, not guessed.
_STARTED_AT = time.time()
_STARTED_ISO = datetime.now(timezone.utc).isoformat()


@router.get("/health")
def health() -> dict[str, object]:
    s = get_settings()
    db_ok, db_err = ping()
    # Deliberately still 200 when Postgres is down: the engine IS up, and the
    # workbench needs to distinguish "engine offline" from "database offline"
    # to degrade honestly. The body carries the truth.
    return {
        "ok": True,
        "service": s.app_name,
        "version": s.version,
        "environment": s.environment,
        "checks": {"database": {"ok": db_ok, "error": db_err}},
        "scheduler": scheduler_status(),
    }


@router.get("/health/ping")
def ping_endpoint() -> dict[str, object]:
    """The keep-alive endpoint (DEC-064).

    TOUCHES NOTHING. No Postgres, no Neo4j, no external API, no disk read on
    the hot path. A keep-alive that runs a database query is a keep-alive that
    consumes the thing it is protecting -- and on a 512 MB free instance, a
    query every ten minutes forever is a real cost for no benefit. The whole
    job here is to be an inbound request that resets Render's 15-minute idle
    timer, and that requires nothing but answering.

    Logged at DEBUG. At one ping per ten minutes inside the warm window this
    would otherwise add ~40 lines a day of pure noise to a log stream someone
    has to read during an incident.
    """
    log.debug("keep-alive ping")
    now = time.time()
    state = record_ping(now)
    return {
        "ok": True,
        "uptime_s": round(now - _STARTED_AT, 1),
        "awake_since": _STARTED_ISO,
        "pings_24h": state["pings_24h"],
        "budget_used_pct": state["budget_used_pct"],
        "next_window": state["next_window"],
    }


@router.get("/version")
def version() -> dict[str, object]:
    s = get_settings()
    return {
        "service": s.app_name,
        "version": s.version,
        "environment": s.environment,
        "capabilities": s.capabilities(),
    }
