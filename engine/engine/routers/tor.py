"""Tor timing-correlation endpoints. Runs on our own testbed only."""

from __future__ import annotations

from fastapi import APIRouter, Query

from ..networking import timing, tor_testbed

router = APIRouter(prefix="/tor", tags=["tor"])


@router.post("/experiment")
def start(n: int = Query(24, ge=6, le=60)) -> dict:
    """Launch a live timing-correlation experiment. Poll /tor/status."""
    return tor_testbed.start(n)


@router.get("/status")
def status() -> dict:
    return {"ok": True, **tor_testbed.status()}


@router.post("/correlate")
def correlate_streams(body: dict) -> dict:
    """Correlate two supplied timing streams (seconds). Source-independent."""
    c = [float(x) for x in body.get("client_events", [])]
    s = [float(x) for x in body.get("service_events", [])]
    return {"ok": True, **timing.correlate(c, s).as_dict()}
