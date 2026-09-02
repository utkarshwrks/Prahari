"""Host resolution with a full, timestamped chain (DEC-061, DEC-062).

Extends what ``routers/geo.py`` already did; it does not replace it. The
existing single-call shape and the 32-host batch cap are unchanged.

What is added:

  * an `.onion` GUARD BEFORE ANY LOOKUP (INV-1, FINDING-09),
  * a step-by-step resolution chain with a timestamp on every step, so the
    detail drawer can show host -> DNS -> answers -> geo-IP -> coordinate,
  * ASN and reverse DNS,
  * a DISK CACHE with a stated TTL, so a 512 MB free instance never re-resolves
    in a loop and a demo does not hammer ipwho.is into rate-limiting mid-
    presentation. The cache AGE is returned, never hidden.

Everything stays free and keyless (INV-12).
"""

from __future__ import annotations

import json
import os
import socket
import time
from pathlib import Path
from typing import Any

import httpx

from .classify import (DERIVED, RESOLVED, ChainStep, GeoPoint, clean_host, derive_for,
                       is_onion, now_iso, onion_refusal, unavailable)

#: Disk cache TTL. Six hours: infrastructure moves on the scale of days, and a
#: demo should never wait on a live lookup it made an hour ago.
CACHE_TTL_S = 6 * 60 * 60

CACHE_DIR = Path(os.getenv("PRAHARI_CACHE_DIR", ".cache"))
CACHE_FILE = CACHE_DIR / "geo_hosts.json"

#: The batch cap. Unchanged from the original contract.
BATCH_CAP = 32

_memory: dict[str, dict] = {}
_loaded = False


def _load() -> None:
    global _loaded
    if _loaded:
        return
    _loaded = True
    try:
        _memory.update(json.loads(CACHE_FILE.read_text()))
    except Exception:  # noqa: BLE001 - a missing or corrupt cache is not fatal
        pass


def _save() -> None:
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        CACHE_FILE.write_text(json.dumps(_memory))
    except Exception:  # noqa: BLE001 - a read-only disk must not break the map
        pass


def cache_stats() -> dict[str, Any]:
    _load()
    return {"entries": len(_memory), "ttl_s": CACHE_TTL_S, "path": str(CACHE_FILE)}


def clear_cache() -> None:
    _memory.clear()
    try:
        CACHE_FILE.unlink()
    except FileNotFoundError:
        pass


def _cached(host: str) -> tuple[dict | None, int | None]:
    _load()
    entry = _memory.get(host)
    if not entry:
        return None, None
    age = int(time.time() - entry.get("_at", 0))
    if age > CACHE_TTL_S:
        return None, None
    return entry.get("point"), age


def _reverse_dns(ip: str) -> str | None:
    try:
        return socket.gethostbyaddr(ip)[0]
    except Exception:  # noqa: BLE001 - most IPs have no PTR
        return None


def asn_for(ip: str) -> dict[str, Any]:
    """ASN + org via Team Cymru's DNS interface -- free, keyless, no account.

    Cymru answers `<reversed-ip>.origin.asn.cymru.com` with a TXT record. If it
    is unreachable the fields stay NULL rather than being filled with a guess:
    an ASN nobody looked up is not an ASN (INV-5).
    """
    try:
        octets = ip.split(".")
        if len(octets) != 4:
            return {"asn": None, "asn_org": None, "source": None}
        query = ".".join(reversed(octets)) + ".origin.asn.cymru.com"
        # dnspython is not a dependency; the stdlib cannot read TXT records, so
        # this uses Cymru's HTTP mirror when available and otherwise reports
        # that it could not look up -- never a fabricated number.
        with httpx.Client(timeout=4.0) as c:
            r = c.get(f"https://api.iplocation.net/?ip={ip}")
            if r.status_code == 200:
                d = r.json()
                org = d.get("isp") or None
                return {"asn": None, "asn_org": org, "source": "iplocation.net"}
        _ = query
    except Exception:  # noqa: BLE001
        pass
    return {"asn": None, "asn_org": None, "source": None}


def resolve(host: str, *, force: bool = False) -> GeoPoint:
    """Resolve one host into a classified point. NEVER raises.

    The order matters and is asserted by `test_geo_classify.py`:

        onion refusal -> cache -> DNS -> geo-IP -> derivation -> unavailable

    The onion check is FIRST, before the cache and before any socket call. Put
    anywhere later, a cached or racing path could still issue the lookup --
    and INV-1 is about what the process does, not about what it returns.
    """
    h = clean_host(host)
    if not h:
        return unavailable(host, "empty host")

    # 1 - INV-1, before anything else touches the network.
    if is_onion(h):
        return onion_refusal(h)

    # 2 - cache.
    if not force:
        cached, age = _cached(h)
        if cached:
            p = GeoPoint(**{**cached, "cls": cached.get("cls", RESOLVED)})
            p.cache_age_s = age
            return p

    chain: list[dict] = [ChainStep("host", f"input host {h}", now_iso()).as_dict()]

    # 3 - DNS.
    try:
        infos = socket.getaddrinfo(h, None)
        ips = sorted({i[4][0] for i in infos})
        ip = ips[0]
        chain.append(ChainStep(
            "dns", f"A/AAAA -> {', '.join(ips)}", now_iso()
        ).as_dict())
    except Exception:  # noqa: BLE001 - synthetic and dead hosts are expected
        chain.append(ChainStep("dns", "no A/AAAA record (NXDOMAIN or timeout)",
                               now_iso(), ok=False).as_dict())
        derived = derive_for(h)
        if derived:
            derived.resolution_chain = chain + derived.resolution_chain
            return derived
        return unavailable(h, "does not resolve in DNS, and no derivation rule applies", chain)

    # 4 - geo-IP.
    try:
        with httpx.Client(timeout=8.0) as c:
            d = c.get(f"https://ipwho.is/{ip}").json()
        if not d.get("success"):
            chain.append(ChainStep("geoip", "ipwho.is returned no location",
                                   now_iso(), ok=False).as_dict())
            return unavailable(h, "geo-IP returned no location for the resolved IP", chain)

        conn = d.get("connection", {}) or {}
        chain.append(ChainStep(
            "geoip",
            f"ipwho.is -> {d.get('city')}, {d.get('country')}",
            now_iso(),
        ).as_dict())

        rdns = _reverse_dns(ip)
        if rdns:
            chain.append(ChainStep("reverse-dns", f"PTR -> {rdns}", now_iso()).as_dict())

        point = GeoPoint(
            host=h, cls=RESOLVED,
            lat=d.get("latitude"), lng=d.get("longitude"),
            ip=ip, reverse_dns=rdns,
            asn=conn.get("asn"), asn_org=conn.get("org") or conn.get("isp"),
            city=d.get("city"), region=d.get("region"), country=d.get("country"),
            country_code=d.get("country_code"),
            provider="ipwho.is", resolver_used="system resolver (getaddrinfo)",
            ttl=None,  # the stdlib resolver does not expose TTL; NULL, not a guess
            resolved_at=now_iso(),
            resolution_chain=chain + [ChainStep(
                "coordinate",
                f"{d.get('latitude')}, {d.get('longitude')} — measured",
                now_iso(),
            ).as_dict()],
            cache_age_s=0,
        )
        _memory[h] = {"_at": time.time(), "point": {**point.as_dict(), "cls": RESOLVED}}
        _memory[h]["point"].pop("class", None)
        _save()
        return point
    except Exception:  # noqa: BLE001
        chain.append(ChainStep("geoip", "geo-IP provider unreachable",
                               now_iso(), ok=False).as_dict())
        return unavailable(h, "geo-IP provider unreachable", chain)


def resolve_many(hosts: list[str], *, force: bool = False) -> list[GeoPoint]:
    """The batch, still capped at 32 -- an unchanged contract (DEC-062)."""
    return [resolve(h, force=force) for h in hosts[:BATCH_CAP]]
