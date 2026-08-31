"""Real host -> region geolocation for the SANGAM map.

A clearnet host resolves to an IP; the IP resolves to a physical region via a
key-free geo-IP service. This is genuine geolocation of real infrastructure —
the same public-data ethos as the rest of PRAHARI. Results are cached, and the
endpoint NEVER raises: an unresolvable host (e.g. a synthetic demo host that is
not in DNS) returns resolved=false so the UI can fall back and say so.
"""

from __future__ import annotations

import socket
from functools import lru_cache

import httpx
from fastapi import APIRouter

router = APIRouter(prefix="/geo", tags=["geo"])


def _clean(host: str) -> str:
    h = host.strip().lower()
    for p in ("https://", "http://"):
        if h.startswith(p):
            h = h[len(p):]
    return h.split("/")[0].split(":")[0]


@lru_cache(maxsize=512)
def _resolve(host: str) -> dict:
    host = _clean(host)
    if not host:
        return {"host": host, "resolved": False, "detail": "empty host"}
    try:
        ip = socket.gethostbyname(host)
    except Exception:  # noqa: BLE001 — synthetic/dead hosts are expected
        return {"host": host, "resolved": False, "detail": "does not resolve in DNS"}
    try:
        with httpx.Client(timeout=8.0) as c:
            d = c.get(f"https://ipwho.is/{ip}").json()
        if not d.get("success"):
            return {"host": host, "ip": ip, "resolved": False, "detail": "geo-IP miss"}
        conn = d.get("connection", {}) or {}
        return {
            "host": host, "ip": ip, "resolved": True,
            "lat": d.get("latitude"), "lng": d.get("longitude"),
            "city": d.get("city"), "region": d.get("region"), "country": d.get("country"),
            "country_code": d.get("country_code"), "flag": (d.get("flag") or {}).get("emoji"),
            "asn": conn.get("asn"), "org": conn.get("org") or conn.get("isp"),
            "detail": "resolved via DNS + geo-IP",
        }
    except Exception:  # noqa: BLE001
        return {"host": host, "ip": ip, "resolved": False, "detail": "geo-IP error"}


@router.get("/host")
def geo_host(host: str) -> dict:
    return {"ok": True, **_resolve(host)}


@router.post("/hosts")
def geo_hosts(body: dict) -> dict:
    hosts = body.get("hosts", [])[:32] if isinstance(body, dict) else []
    return {"ok": True, "results": [_resolve(h) for h in hosts]}
