"""PRAHARI v2 engine - FastAPI entry point.

    uvicorn engine.main:app --reload --port 8000

Boots with no .env, with Postgres down, and with every optional key absent.
Anything it cannot do, it reports through /version capabilities rather than
failing at import. See docs/ARCHITECTURE.md section 7.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.requests import Request

from .logging_config import configure_logging
from .routers import extract, feed, graph, health, infra, sources, style
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
    return app


app = create_app()
