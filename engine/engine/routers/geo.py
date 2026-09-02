"""Real host -> region geolocation for the SANGAM map.

A clearnet host resolves to an IP; the IP resolves to a physical region via a
key-free geo-IP service. This is genuine geolocation of real infrastructure —
the same public-data ethos as the rest of PRAHARI. Results are cached, and the
endpoint NEVER raises: an unresolvable host (e.g. a synthetic demo host that is
not in DNS) returns resolved=false so the UI can fall back and say so.

EXTENDED IN PHASE 5 (DEC-061, DEC-062), not rewritten. `/geo/host` and
`/geo/hosts` keep their shape and their 32-host cap; every field they returned
before is still returned. What is new is additive: a `class`, a timestamped
`resolution_chain`, ASN, reverse DNS, cache age, and four further endpoints.

FINDING-09 is fixed here. `_resolve` called `socket.gethostbyname()` on any
host it was given, INCLUDING a `.onion` — the query failed, but it was issued,
and INV-1 is about what the process DOES, not about what it returns. A spy test
now proves no lookup happens.
"""

from __future__ import annotations

import socket
from functools import lru_cache

import httpx
from fastapi import APIRouter, Body, Query

from ..engines import actors as A
from ..geo import classify as C
from ..geo import resolve as R

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

    # INV-1, BEFORE any socket call (FINDING-09). This function previously
    # handed a .onion straight to the resolver; the lookup failed, but it was
    # made. Refusing is a feature, so the detail says so rather than pretending
    # the host merely did not resolve.
    if C.is_onion(host):
        return {"host": host, "resolved": False,
                "detail": "onion — resolution refused by design"}

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
def geo_host(host: str, force: bool = Query(False)) -> dict:
    """The original contract, enriched.

    Every field the old response carried is still present; `class`,
    `resolution_chain`, `asn`, `reverse_dns`, `resolver_used`, `ttl`,
    `resolved_at` and `cache_age_s` are added beside them. An existing caller
    that reads `resolved` and `lat`/`lng` keeps working unchanged.
    """
    point = R.resolve(host, force=force)
    legacy = _resolve(host)
    return {"ok": True, **legacy, **point.as_dict(),
            "resolved": point.cls == C.RESOLVED}


@router.post("/hosts")
def geo_hosts(body: dict) -> dict:
    """Unchanged contract, enriched payload, still capped at 32."""
    hosts = body.get("hosts", [])[:R.BATCH_CAP] if isinstance(body, dict) else []
    points = R.resolve_many(hosts)
    return {
        "ok": True,
        "results": [
            {**_resolve(h), **p.as_dict(), "resolved": p.cls == C.RESOLVED}
            for h, p in zip(hosts, points, strict=False)
        ],
        "summary": C.summarise(points),
        "cap": R.BATCH_CAP,
    }


@router.get("/asn")
def geo_asn(ip: str) -> dict:
    """ASN and org for an IP.

    Returns NULLs when the lookup could not be made. An ASN nobody looked up is
    not an ASN, and filling it in would be exactly the kind of plausible guess
    INV-5 forbids.
    """
    if C.is_onion(ip):
        return {"ok": False, "detail": "onion — resolution refused by design"}
    return {"ok": True, "ip": ip, **R.asn_for(ip)}


@router.get("/actor/{actor_id}/footprint")
def geo_footprint(actor_id: str) -> dict:
    """Every host for an actor, pre-classified, with persona edges."""
    profile = A.profile(actor_id)
    if profile is None:
        return {"ok": False, "detail": f"No actor {actor_id}."}
    p = profile.as_dict()

    # THREE SOURCES, THREE CLASSES. All of them are real evidence this actor
    # carries; none is invented to fill the map out.
    #
    #   clearnet hosts  -> resolved, or derived, or unavailable (the engine decides)
    #   onion identifiers -> UNAVAILABLE by construction (INV-1)
    #   markets         -> DERIVED regions, and only where a rule exists
    #
    # A market with no rule contributes NOTHING rather than a hashed coordinate.
    # That is FINDING-06's lesson applied on the engine side.
    hosts = [x["clearnet_host"] for x in p.get("infrastructure", [])]
    points = R.resolve_many(hosts)
    strength = {x["clearnet_host"]: x.get("strength") for x in p.get("infrastructure", [])}

    for ident in p.get("identifiers", []):
        if ident.get("kind") == "onion" and ident.get("value"):
            # Never resolved, always listed. On a demo this is one of the more
            # convincing things on the screen.
            points.append(C.onion_refusal(ident["value"]))

    for market in p.get("markets", []):
        derived = C.derive_for(market)
        if derived is not None:
            derived.host = f"{market} (marketplace)"
            points.append(derived)

    edges = [
        {"persona_id": s["id"], "handle": s["handle"], "host": pt.host,
         "strength": strength.get(pt.host)}
        for pt in points if pt.cls != C.UNAVAILABLE
        for s in p.get("personas", [])
    ]

    return {
        "ok": True, "actor_id": actor_id, "label": p.get("label"),
        "points": [pt.as_dict() for pt in points],
        "edges": edges,
        "summary": C.summarise(points),
        "unplaced": [
            {"host": pt.host, "reason": pt.reason}
            for pt in points if pt.cls == C.UNAVAILABLE
        ],
        "cap": R.BATCH_CAP,
    }


@router.get("/certificate-links")
def geo_certificate_links(actor: str = Query(...)) -> dict:
    """Host pairs sharing a CT-observed certificate.

    This is where `infra` signals become geographic, and it is the most
    compelling layer on the map -- so it must be the most careful. A pair is
    reported ONLY when both hosts appear in the same certificate's DNS names.
    Nothing is inferred from a shared substring or a shared registrar.
    """
    profile = A.profile(actor)
    if profile is None:
        return {"ok": False, "detail": f"No actor {actor}."}
    p = profile.as_dict()

    pairs: list[dict] = []
    infra = p.get("infrastructure", [])
    for i, a in enumerate(infra):
        for b in infra[i + 1:]:
            shared = [
                e for e in a.get("evidence", [])
                if e.get("rule", "").startswith("cert")
                and any(e.get("detail") == f.get("detail") for f in b.get("evidence", []))
            ]
            if shared:
                pairs.append({
                    "a": a["clearnet_host"], "b": b["clearnet_host"],
                    "evidence": [e.get("detail") for e in shared],
                    "source": shared[0].get("source"),
                })

    return {
        "ok": True, "actor": actor, "count": len(pairs), "pairs": pairs,
        "honesty": "A pair appears only when both hosts are named in the same "
                   "CT-observed certificate. Nothing is inferred from a shared "
                   "substring or registrar.",
    }


@router.get("/sources")
def geo_sources() -> dict:
    """Which geo providers are configured, and the passivity statement.

    Mirrors `/infra/sources`. Never renders a key value -- only whether one is
    present, and none of these need one.
    """
    return {
        "ok": True,
        "providers": [
            {"name": "system resolver", "kind": "dns", "requires_key": False,
             "key_present": False, "used_for": "A/AAAA and PTR lookups"},
            {"name": "ipwho.is", "kind": "geo-ip", "requires_key": False,
             "key_present": False, "used_for": "IP -> city/region/country/ASN"},
        ],
        "cache": R.cache_stats(),
        "freshness_window_s": C.FRESHNESS_WINDOW_S,
        "passivity": (
            "PRAHARI resolves clearnet hostnames the operator published and asks a "
            "public geo-IP service about the resulting address. It never contacts "
            "the host, never scans it, and never resolves a .onion (INV-1)."
        ),
        "classes": {
            "resolved": "host -> DNS -> geo-IP returned a real location",
            "derived": "no resolution; a stable coordinate standing for a known "
                       "hosting or exchange region. NOT a measured location",
            "unavailable": "nothing to place; listed with the reason",
        },
    }
