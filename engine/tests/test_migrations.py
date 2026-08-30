"""Migration reversibility.

Regression guard for a real bug found in Phase 2: Postgres ENUMs are schema
objects, not table-scoped, so `drop_table` leaves `signal_root` behind and the
next upgrade dies with DuplicateObject. up/down/up must be clean.

Skipped when Postgres is unreachable so the suite still runs without Docker.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest
from sqlalchemy import text

from engine.db import get_engine, ping

ENGINE_DIR = Path(__file__).resolve().parents[1]

pytestmark = pytest.mark.skipif(not ping()[0], reason="Postgres unreachable")


def alembic(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["uv", "run", "alembic", *args],
        cwd=ENGINE_DIR, capture_output=True, text=True, timeout=180,
    )


def table_names() -> set[str]:
    with get_engine().connect() as c:
        rows = c.execute(text(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' "
            "AND tablename NOT LIKE 'alembic%'"
        ))
        return {r[0] for r in rows}


def enum_names() -> set[str]:
    with get_engine().connect() as c:
        return {r[0] for r in c.execute(text("SELECT typname FROM pg_type WHERE typtype='e'"))}


EXPECTED = {
    "sources", "personas", "posts", "entities", "signals",
    "pair_scores", "cases", "audit_records", "seals", "users",
}


def test_upgrade_creates_every_table():
    assert alembic("upgrade", "head").returncode == 0
    assert EXPECTED <= table_names()


def test_upgrade_seeds_the_source_inventory():
    alembic("upgrade", "head")
    with get_engine().connect() as c:
        assert c.execute(text("SELECT count(*) FROM sources")).scalar_one() == 9


def test_pgvector_extension_is_available():
    alembic("upgrade", "head")
    with get_engine().connect() as c:
        assert c.execute(text("SELECT '[1,2,3]'::vector <-> '[1,2,4]'::vector")).scalar_one() == 1


def test_downgrade_removes_tables_and_the_enum():
    alembic("upgrade", "head")
    assert alembic("downgrade", "base").returncode == 0
    assert table_names() == set()
    # The actual bug: this was left behind and broke the next upgrade.
    assert "signal_root" not in enum_names()
    alembic("upgrade", "head")


def test_up_down_up_is_clean():
    assert alembic("upgrade", "head").returncode == 0
    assert alembic("downgrade", "base").returncode == 0
    second = alembic("upgrade", "head")
    assert second.returncode == 0, second.stderr[-800:]
    assert EXPECTED <= table_names()
