"""PRAHARI v2 engine - FastAPI entry point.

    uvicorn engine.main:app --reload --port 8000

Boots with no .env, with Postgres down, and with every optional key absent.
Anything it cannot do, it reports through /version capabilities rather than
failing at import. See docs/ARCHITECTURE.md section 7.
"""

from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.requests import Request

from .logging_config import configure_logging
from .routers import (actors, audit, extract, feed, fusion, geo, graph, health, infra,
                      sources, style, tor)
from .routers import admin as admin_router
from .routers import chainflow as chainflow_router
from .scheduler import start_scheduler, stop_scheduler
from .settings import get_settings

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    configure_logging(s.log_level)
    log.info(
        "engine starting",
        extra={"version": s.version, "environment": s.environment},
    )
    for name, cap in s.capabilities().items():
        if not cap["enabled"]:
            # Degradation is announced at boot, never discovered at demo time.
            log.warning("capability disabled", extra={"capability": name, "reason": cap["detail"]})
    start_scheduler()

    # Warm the expensive caches in the background.
    #
    # The first request that touches fusion or the audit ledger triggers Splink
    # training and profile building -- about 20 seconds on a cold process. The
    # Phase 11 judge-simulation run caught this: the first click on the Audit
    # panel exceeded the proxy timeout and rendered as "engine offline" on a
    # perfectly healthy engine. The development machine never saw it because it
    # was always warm.
    #
    # Warming in a thread keeps boot fast while making the first real request
    # fast too.
    def _warm() -> None:
        try:
            from .fusion import eval as _eval

            _eval.build_signals()
            _eval.ensure_calibrated()
            log.info("caches warmed")
        except Exception:  # noqa: BLE001 - warming is an optimisation, never fatal
            log.warning("cache warm failed; first request will be slow")

    threading.Thread(target=_warm, name="warm", daemon=True).start()

    try:
        yield
    finally:
        stop_scheduler()
        log.info("engine stopped")


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(
        title="PRAHARI Engine",
        version=s.version,
        description="Attribution engine for PRAHARI v2. Passive sources only.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception) -> JSONResponse:
        # The workbench must never see an HTML error page from the engine.
        log.exception("unhandled error", extra={"path": request.url.path})
        return JSONResponse(
            status_code=500,
            content={"ok": False, "error": type(exc).__name__, "path": request.url.path},
        )

    app.include_router(health.router)
    app.include_router(feed.router)
    app.include_router(sources.router)
    app.include_router(extract.router)
    app.include_router(graph.router)
    app.include_router(style.router)
    app.include_router(infra.router)
    app.include_router(geo.router)
    app.include_router(fusion.router)
    app.include_router(audit.router)
    app.include_router(actors.router)
    app.include_router(tor.router)
    app.include_router(chainflow_router.router)
    # The admin scope authorises INDEPENDENTLY of the web proxy (DEC-060):
    # every handler verifies a signed service token and checks the role against
    # the engine's own table. It is mounted last so it is visibly separate.
    app.include_router(admin_router.router)
    return app


app = create_app()
