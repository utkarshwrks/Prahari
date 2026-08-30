"""Source inventory and freshness - GET /sources."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_session, ping
from ..models import Source
from ..scheduler import scheduler_status
from ..settings import get_settings

router = APIRouter(tags=["sources"])

# The sources PRAHARI is designed to draw on. Seeded into Postgres by the
# Phase 2 migration; this list is the fallback when the DB is unreachable so
# /sources still answers honestly instead of 500-ing.
KNOWN_SOURCES = [
    {"name": "hackernews", "kind": "osint", "requires_key": False},
    {"name": "google_news", "kind": "osint", "requires_key": False},
    {"name": "reddit", "kind": "osint", "requires_key": False},
    {"name": "crtsh", "kind": "infra", "requires_key": False},
    {"name": "shodan", "kind": "infra", "requires_key": True},
    {"name": "mempool_space", "kind": "chain", "requires_key": False},
    {"name": "etherscan", "kind": "chain", "requires_key": True},
    {"name": "dnm_archives", "kind": "dataset", "requires_key": False},
    {"name": "kaggle_agora", "kind": "dataset", "requires_key": False},
]


def _freshness_s(last_scan: datetime | None) -> float | None:
    if last_scan is None:
        return None
    if last_scan.tzinfo is None:
        last_scan = last_scan.replace(tzinfo=timezone.utc)
    return round((datetime.now(timezone.utc) - last_scan).total_seconds(), 1)


@router.get("/sources")
def list_sources(session: Session = Depends(get_session)) -> dict[str, object]:
    s = get_settings()
    caps = s.capabilities()
    key_for = {"shodan": "infra_shodan", "etherscan": "chain_eth"}

    db_ok, _ = ping()
    rows: list[dict[str, object]] = []

    if db_ok:
        try:
            for src in session.scalars(select(Source).order_by(Source.name)):
                rows.append(
                    {
                        "name": src.name,
                        "kind": src.kind,
                        "enabled": src.enabled,
                        "requires_key": src.requires_key,
                        "last_scan": src.last_scan.isoformat() if src.last_scan else None,
                        "freshness_s": _freshness_s(src.last_scan),
                        "items_24h": src.items_24h,
                        "last_error": src.last_error,
                    }
                )
        except Exception:  # noqa: BLE001
            rows = []

    if not rows:
        # DB unreachable or unseeded - still answer, and say why the data is thin.
        rows = [
            {
                "name": k["name"],
                "kind": k["kind"],
                "enabled": True,
                "requires_key": k["requires_key"],
                "last_scan": None,
                "freshness_s": None,
                "items_24h": 0,
                "last_error": None,
            }
            for k in KNOWN_SOURCES
        ]

    # Annotate each source with whether its key is actually present.
    for r in rows:
        cap = key_for.get(str(r["name"]))
        r["key_present"] = caps[cap]["enabled"] if cap else True

    return {
        "ok": True,
        "database": db_ok,
        "scheduler": scheduler_status(),
        "count": len(rows),
        "sources": rows,
    }
