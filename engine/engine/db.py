"""Database session management.

The engine must boot with Postgres down. Connection is lazy and pooled with
pre-ping so a restarted container heals without restarting the engine -- the
Phase 11 failure drill requires exactly that.
"""

from __future__ import annotations

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from .settings import get_settings


@lru_cache
def get_engine() -> Engine:
    s = get_settings()
    return create_engine(
        s.database_url,
        pool_pre_ping=True,   # a dropped connection is retried, not raised
        pool_size=5,
        max_overflow=5,
        future=True,
    )


@lru_cache
def get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False, future=True)


def get_session() -> Iterator[Session]:
    """FastAPI dependency."""
    with get_sessionmaker()() as session:
        yield session


def ping() -> tuple[bool, str | None]:
    """Is Postgres reachable? Returns (ok, error). Never raises."""
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        return True, None
    except Exception as exc:  # noqa: BLE001 - degradation must be total
        return False, f"{type(exc).__name__}: {exc}"[:200]
