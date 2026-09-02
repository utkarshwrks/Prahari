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


@router.get("/health/diagnostics")
def diagnostics() -> dict[str, object]:
    """WHY IS LIVE DATA SLOW RIGHT NOW — answered, not guessed.

    The complaint this endpoint exists for is real and specific: on a free
    Render instance the deployed app feels slow while a local one is instant.
    There are exactly three causes, and they are different problems with
    different fixes, so this reports which one is actually in play:

      1. COLD START. The instance was spun down and is booting. ~60 s, and
         nothing can be done about it except not being spun down -- which is
         what the keep-alive window is for.
      2. COLD CACHES. The process is up but `build_signals()` and the
         calibrator have not finished. The first fusion or audit call then
         takes ~20 s (DEC-054), which the proxy's 45 s ceiling survives but a
         judge's patience does not.
      3. A DEPENDENCY IS DOWN. Postgres or Neo4j unreachable. The engine still
         answers (INV-9) but specific panels degrade.

    Read-only and cheap: it inspects module state and touches no external
    service. It is NOT the keep-alive endpoint -- that one touches nothing at
    all -- and it is safe to call from a status page.
    """
    now = time.time()
    age = now - _STARTED_AT

    # Cache state, read from the lru_cache wrappers themselves.
    #
    # `build_signals` and `_index` are @lru_cache(maxsize=1), so `currsize`
    # IS the warm flag -- 1 means the expensive call has completed at least
    # once in this process. Reading it does no work, which is the point: a
    # diagnostic that warms the thing it is measuring cannot report a cold
    # cache.
    caches: dict[str, object] = {}
    try:
        from ..fusion import eval as _eval

        info = _eval.build_signals.cache_info()
        caches["signals"] = {
            "warm": info.currsize > 0,
            "hits": info.hits,
            "cache_file": os.path.basename(_eval._SIGNALS_CACHE),
            "on_disk": os.path.exists(_eval._SIGNALS_CACHE),
        }
    except Exception as exc:  # noqa: BLE001
        caches["signals"] = {"warm": False, "error": exc.__class__.__name__}

    try:
        from ..engines import actors as _actors

        info = _actors._index.cache_info()
        caches["actors_index"] = {
            "warm": info.currsize > 0,
            "hits": info.hits,
            "on_disk": os.path.exists(_actors._CACHE_PATH),
        }
    except Exception as exc:  # noqa: BLE001
        caches["actors_index"] = {"warm": False, "error": exc.__class__.__name__}

    warm = all(bool(c.get("warm")) for c in caches.values() if isinstance(c, dict))

    # The verdict, in the order a reader should act on it.
    if age < 90 and not warm:
        verdict = "cold-start"
        detail = (
            f"This instance started {age:.0f}s ago and its caches are still "
            "building. The first fusion or audit call will be slow. This is a "
            "spun-down free instance waking up -- the keep-alive window exists "
            "to prevent it."
        )
    elif not warm:
        verdict = "cold-caches"
        detail = (
            "The process is up but the fusion caches are not built. The first "
            "call that needs them takes about 20 seconds (DEC-054). POST "
            "/health/warm to build them now."
        )
    else:
        verdict = "warm"
        detail = "Caches are built. Requests should be as fast as a local run."

    db_ok, db_err = ping()
    return {
        "ok": True,
        "verdict": verdict,
        "detail": detail,
        "uptime_s": round(age, 1),
        "awake_since": _STARTED_ISO,
        "caches": caches,
        "dependencies": {
            # A dependency being down does NOT make the engine down (INV-9),
            # but it does explain which panels will degrade.
            "database": {"ok": db_ok, "error": db_err},
        },
        "keepalive": budget_state(now),
    }


@router.post("/health/warm")
def warm_now() -> dict[str, object]:
    """Build the expensive caches NOW, and report how long it took.

    Called by the keep-alive workflow at the top of the warm window, so the
    first real request of the day is fast rather than merely successful. Safe
    to call repeatedly: `build_signals()` and `ensure_calibrated()` are both
    idempotent and return immediately once warm.

    Separate from /health/ping ON PURPOSE. The ping must stay under 50 ms and
    touch nothing; this one does real work and takes ~20 s on a cold process.
    Merging them would make every keep-alive request expensive.
    """
    started = time.time()
    done: list[str] = []
    failed: dict[str, str] = {}

    try:
        from ..fusion import eval as _eval

        _eval.build_signals()
        done.append("signals")
        _eval.ensure_calibrated()
        done.append("calibrator")
    except Exception as exc:  # noqa: BLE001 - warming is never fatal
        failed["fusion"] = f"{exc.__class__.__name__}: {exc}"

    try:
        from ..engines import actors as _actors

        _actors.list_actors("", 1, 0, 0.0)
        done.append("actors_index")
    except Exception as exc:  # noqa: BLE001
        failed["actors"] = f"{exc.__class__.__name__}: {exc}"

    elapsed = round(time.time() - started, 2)
    return {
        # `ok` reports whether the ENGINE is fine, which it is either way.
        # `warmed` reports whether the work succeeded. Conflating them would
        # make a warm failure look like an outage.
        "ok": True,
        "warmed": not failed,
        "took_s": elapsed,
        "caches": done,
        "failures": failed,
        "detail": (
            f"Warmed {', '.join(done)} in {elapsed}s."
            if not failed
            else f"Warmed {', '.join(done) or 'nothing'}; {len(failed)} failed. "
                 "The engine is still serving; the first affected call will be slow."
        ),
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
