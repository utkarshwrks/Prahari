"""Passive infrastructure fingerprinting: onion -> clearnet.

The whole engine rests on one rule, and it is not a guideline:

    WE NEVER CONNECT TO A HIDDEN SERVICE, AND NEVER SCAN A HOST WE DO NOT OWN.

Every source here is a third-party index that already holds the data.
Certificate Transparency logs are published by CAs. Shodan InternetDB is a
scan someone else already ran. Reading an index is not probing a target.

That distinction is the difference between "we de-anonymise by correlating
footprints operators leaked themselves" and "we hack people". It is enforced by
`assert_not_onion()` on every outbound URL and by a network-layer test, not by
anyone remembering to be careful.

Matching rules and strengths are the playbook's:

    cert SHA-256 reused on clearnet            0.95
    cert CN/SAN names a clearnet domain        0.85
    exposed server-status names a vhost        0.90
    favicon mmh3 hash match                    0.75
    JARM + banner match                        0.60
    banner alone                               0.40
"""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

log = logging.getLogger(__name__)

TIMEOUT_S = 25.0
CACHE_TTL_S = 3600

ONION_RE = re.compile(r"\.onion$", re.I)

# name -> strength. Ordered strongest first; the pivot keeps the best evidence.
RULE_STRENGTH: dict[str, float] = {
    "cert_sha256_reuse": 0.95,
    "server_status_vhost": 0.90,
    "cert_cn_san_match": 0.85,
    "favicon_mmh3_match": 0.75,
    "jarm_banner_match": 0.60,
    "banner_only": 0.40,
}


class OnionRequestBlocked(RuntimeError):
    """Raised when any code path tries to reach a hidden service."""


def assert_not_onion(url: str) -> str:
    """Hard guard on every outbound request. Never remove this."""
    host = (urlparse(url).hostname or "")
    if ONION_RE.search(host):
        raise OnionRequestBlocked(
            f"Refused outbound request to a hidden service: {host}. "
            "PRAHARI never connects to Tor."
        )
    return url


# --------------------------------------------------------------------------
# Cache
# --------------------------------------------------------------------------

_cache: dict[str, tuple[float, Any]] = {}
_stats = {"hits": 0, "misses": 0, "last_scan": None, "source_used": None}


def _cached(key: str):
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_TTL_S:
        _stats["hits"] += 1
        return hit[1]
    _stats["misses"] += 1
    return None


def _store(key: str, val: Any):
    _cache[key] = (time.time(), val)
    _stats["last_scan"] = time.time()
    return val


def cache_stats() -> dict:
    total = _stats["hits"] + _stats["misses"]
    return {
        "hits": _stats["hits"],
        "misses": _stats["misses"],
        "hit_rate": round(_stats["hits"] / total, 4) if total else 0.0,
        "entries": len(_cache),
        "last_scan": _stats["last_scan"],
        "source_used": _stats["source_used"],
    }


# --------------------------------------------------------------------------
# Certificate Transparency (DEC-027: certspotter primary, crt.sh failover)
# --------------------------------------------------------------------------


@dataclass
class Certificate:
    sha256: str | None
    dns_names: list[str]
    issuer: str | None
    not_before: str | None = None
    source: str = ""


def _ct_certspotter(domain: str, client) -> list[Certificate]:
    url = assert_not_onion(
        "https://api.certspotter.com/v1/issuances"
        f"?domain={domain}&include_subdomains=true&expand=dns_names&expand=issuer"
    )
    r = client.get(url)
    r.raise_for_status()
    out = []
    for c in r.json():
        out.append(
            Certificate(
                sha256=(c.get("cert_sha256") or "").lower() or None,
                dns_names=[n.lower() for n in c.get("dns_names", [])],
                issuer=(c.get("issuer") or {}).get("name"),
                not_before=c.get("not_before"),
                source="certspotter",
            )
        )
    return out


def _ct_crtsh(domain: str, client) -> list[Certificate]:
    url = assert_not_onion(f"https://crt.sh/?q={domain}&output=json")
    r = client.get(url)
    r.raise_for_status()
    out = []
    for c in r.json():
        names = [n.strip().lower() for n in str(c.get("name_value", "")).split("\n") if n.strip()]
        out.append(
            Certificate(
                sha256=None,  # crt.sh JSON omits the leaf hash
                dns_names=names,
                issuer=c.get("issuer_name"),
                not_before=c.get("not_before"),
                source="crt.sh",
            )
        )
    return out


def certificates(domain: str) -> tuple[list[Certificate], str | None, str | None]:
    """CT lookup with failover. Returns (certs, source_used, error).

    Never raises: a dead CT log degrades the infra engine, it does not break it.
    """
    key = f"ct:{domain}"
    if (hit := _cached(key)) is not None:
        return hit[0], hit[1], None

    try:
        import httpx
    except Exception as exc:  # noqa: BLE001
        return [], None, f"httpx unavailable: {type(exc).__name__}"

    errors = []
    with httpx.Client(timeout=TIMEOUT_S, follow_redirects=True,
                      headers={"User-Agent": "prahari-research/2.0"}) as client:
        for name, fn in (("certspotter", _ct_certspotter), ("crt.sh", _ct_crtsh)):
            try:
                certs = fn(domain, client)
                if certs:
                    _stats["source_used"] = name
                    _store(key, (certs, name))
                    return certs, name, None
                errors.append(f"{name}: empty")
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{name}: {type(exc).__name__}")
                log.info("CT source failed", extra={"source": name, "error": str(exc)[:120]})

    return [], None, "; ".join(errors)


# --------------------------------------------------------------------------
# Shodan InternetDB (DEC-026: free, no key)
# --------------------------------------------------------------------------


def internetdb(ip: str) -> dict:
    """Host fingerprint from Shodan's free, keyless index.

    This is a scan Shodan already ran and published. We read their result; we
    never touch the host.
    """
    key = f"idb:{ip}"
    if (hit := _cached(key)) is not None:
        return {**hit, "cached": True}
    try:
        import httpx

        url = assert_not_onion(f"https://internetdb.shodan.io/{ip}")
        with httpx.Client(timeout=TIMEOUT_S) as c:
            r = c.get(url)
            if r.status_code == 404:
                return {"ok": True, "ip": ip, "ports": [], "hostnames": [],
                        "detail": "No Shodan record for this host.", "source": "internetdb"}
            r.raise_for_status()
            d = r.json()
        return _store(key, {
            "ok": True, "ip": ip,
            "ports": d.get("ports", []), "hostnames": d.get("hostnames", []),
            "cpes": d.get("cpes", []), "tags": d.get("tags", []),
            "vulns": d.get("vulns", []),
            "source": "internetdb", "requires_key": False,
        })
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "ip": ip, "error": type(exc).__name__,
                "detail": "Shodan InternetDB unreachable; infra runs cache-only."}


# --------------------------------------------------------------------------
# Fingerprints
# --------------------------------------------------------------------------


def favicon_hash(data: bytes) -> int | None:
    """Shodan-compatible favicon hash: mmh3 over standard-base64 with newlines."""
    try:
        import base64

        import mmh3

        b64 = base64.encodebytes(data).decode()
        return mmh3.hash(b64)
    except Exception:  # noqa: BLE001
        return None


def header_order_fingerprint(headers: list[str]) -> str:
    """Order-sensitive digest of response header names.

    Servers emit headers in a stable order that varies by stack and config, so
    the ORDER is the signal - two hosts behind the same deployment agree even
    when their values differ.
    """
    import hashlib

    joined = ",".join(h.lower() for h in headers)
    return hashlib.sha256(joined.encode()).hexdigest()[:32]


def jarm(host: str, port: int = 443, allow: bool = False) -> dict:
    """JARM actively probes TLS. DEC-028: testbed-controlled hosts only.

    `allow` must be set explicitly by a caller that owns the host. The default
    refuses, because an active probe against a target is a scan.
    """
    if not allow:
        return {"ok": False, "skipped": True,
                "detail": "JARM is an active probe; refused against a host we do not control."}
    assert_not_onion(f"https://{host}")
    return {"ok": False, "skipped": True,
            "detail": "JARM probe not run: no testbed host configured."}


# --------------------------------------------------------------------------
# Matching
# --------------------------------------------------------------------------


@dataclass
class Evidence:
    rule: str
    strength: float
    detail: str
    source: str


@dataclass
class Pivot:
    onion: str
    clearnet_host: str
    strength: float
    evidence: list[Evidence] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "onion": self.onion,
            "clearnet_host": self.clearnet_host,
            "strength": round(self.strength, 4),
            "evidence": [e.__dict__ for e in self.evidence],
        }


def match(onion: str, observed: dict, candidates: list[dict]) -> list[Pivot]:
    """Score onion -> clearnet candidates against the rule table.

    `observed` is what we know about the hidden service from PASSIVE sources:
    its certificate hash, the names on that certificate, a favicon hash, a
    banner, an exposed server-status vhost. Never from connecting to it.

    Strength is the MAX rule that fired, never a sum: two views of the same
    underlying fact are not two facts. That is the same root-cause collapse
    Phase 7 applies to the whole pipeline, applied locally here.
    """
    pivots: list[Pivot] = []
    o_sha = (observed.get("cert_sha256") or "").lower()
    o_names = {n.lower() for n in observed.get("cert_names", [])}
    o_fav = observed.get("favicon_mmh3")
    o_banner = (observed.get("banner") or "").strip().lower()
    o_status_vhost = (observed.get("server_status_vhost") or "").lower()
    o_jarm = observed.get("jarm")

    for cand in candidates:
        host = (cand.get("host") or "").lower()
        if not host or ONION_RE.search(host):
            continue
        ev: list[Evidence] = []
        src = cand.get("source", "unknown")

        if o_sha and o_sha == (cand.get("cert_sha256") or "").lower():
            ev.append(Evidence("cert_sha256_reuse", RULE_STRENGTH["cert_sha256_reuse"],
                               f"Same leaf certificate {o_sha[:16]}... served on {host}", src))

        if o_status_vhost and o_status_vhost == host:
            ev.append(Evidence("server_status_vhost", RULE_STRENGTH["server_status_vhost"],
                               f"Exposed server-status names vhost {host}", src))

        c_names = {n.lower() for n in cand.get("dns_names", [])}
        shared = o_names & c_names
        if not shared and o_names and host in o_names:
            shared = {host}
        if shared:
            ev.append(Evidence("cert_cn_san_match", RULE_STRENGTH["cert_cn_san_match"],
                               f"Certificate names clearnet domain(s): {sorted(shared)[:3]}", src))

        if o_fav is not None and cand.get("favicon_mmh3") == o_fav:
            ev.append(Evidence("favicon_mmh3_match", RULE_STRENGTH["favicon_mmh3_match"],
                               f"Favicon mmh3 {o_fav} matches", src))

        c_banner = (cand.get("banner") or "").strip().lower()
        banner_match = bool(o_banner and o_banner == c_banner)
        if o_jarm and cand.get("jarm") == o_jarm and banner_match:
            ev.append(Evidence("jarm_banner_match", RULE_STRENGTH["jarm_banner_match"],
                               "JARM and banner both match", src))
        elif banner_match:
            ev.append(Evidence("banner_only", RULE_STRENGTH["banner_only"],
                               f"Banner match: {c_banner[:60]}", src))

        if ev:
            # MAX, not sum. Correlated views of one fact are one fact.
            pivots.append(Pivot(onion, host, max(e.strength for e in ev), ev))

    pivots.sort(key=lambda p: -p.strength)
    return pivots
