"""Health and version. Must answer with no .env and with Postgres down."""

from __future__ import annotations

from fastapi import APIRouter

from ..db import ping
from ..scheduler import scheduler_status
from ..settings import get_settings

router = APIRouter(tags=["meta"])


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


@router.get("/version")
def version() -> dict[str, object]:
    s = get_settings()
    return {
        "service": s.app_name,
        "version": s.version,
        "environment": s.environment,
        "capabilities": s.capabilities(),
    }
