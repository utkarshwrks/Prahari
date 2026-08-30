"""Infrastructure pivot endpoints. Passive sources only."""

from __future__ import annotations

from fastapi import APIRouter, Query

from ..engines import infra as I
from ..engines.infra_testbed import infra_fixture

router = APIRouter(prefix="/infra", tags=["infra"])


@router.get("/pivot")
def pivot(onion: str = Query(..., min_length=4)) -> dict:
    """onion -> clearnet candidates with the evidence that produced each score.

    Resolves the testbed case from planted metadata; a real onion returns an
    honest empty result rather than a guess. Under no circumstances does this
    endpoint connect to the hidden service.
    """
    fx = infra_fixture()
    o = onion.lower().strip()
    if o != fx["onion"].lower():
        return {
            "ok": True, "onion": onion, "count": 0, "results": [],
            "detail": ("No passive observations for this hidden service. PRAHARI never "
                       "connects to a .onion; pivots come from public indexes only."),
        }
    pivots = I.match(fx["onion"], fx["observed"], fx["candidates"])
    return {
        "ok": True, "onion": fx["onion"], "persona_id": fx["persona_id"],
        "count": len(pivots), "results": [p.as_dict() for p in pivots],
    }


@router.get("/certificates")
def certs(domain: str = Query(..., min_length=3)) -> dict:
    """Live Certificate Transparency lookup on a PUBLIC CLEARNET domain.

    Proves the adapter is real rather than a fixture. certspotter primary,
    crt.sh failover (DEC-027); the response names which source answered.
    """
    if domain.lower().endswith(".onion"):
        return {"ok": False, "detail": "Refused: PRAHARI never queries hidden services."}
    rows, source, err = I.certificates(domain)
    return {
        "ok": bool(rows), "domain": domain, "source": source, "error": err,
        "count": len(rows),
        "certificates": [
            {"sha256": c.sha256, "dns_names": c.dns_names[:8],
             "issuer": c.issuer, "not_before": c.not_before, "source": c.source}
            for c in rows[:20]
        ],
    }


@router.get("/host")
def host(ip: str = Query(...)) -> dict:
    """Shodan InternetDB fingerprint. Free, no key (DEC-026)."""
    return I.internetdb(ip)


@router.get("/sources")
def sources() -> dict:
    return {
        "ok": True,
        "cache": I.cache_stats(),
        "rules": I.RULE_STRENGTH,
        "sources": [
            {"name": "certspotter", "kind": "ct", "requires_key": False, "role": "primary"},
            {"name": "crt.sh", "kind": "ct", "requires_key": False, "role": "failover"},
            {"name": "internetdb.shodan.io", "kind": "host", "requires_key": False,
             "role": "primary"},
            {"name": "jarm", "kind": "active", "requires_key": False,
             "role": "testbed-controlled hosts only"},
        ],
        "passivity": "No code path may request a .onion host; enforced by assert_not_onion().",
    }
