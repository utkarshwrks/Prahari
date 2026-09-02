"""THE THREE COORDINATE CLASSES (DEC-061).

Every point on the SANGAM map is exactly one of:

    RESOLVED     host -> DNS A/AAAA -> geo-IP returned a real location.
    DERIVED      no resolution; a stable coordinate standing for a known
                 hosting or exchange region. NOT a measured location.
    UNAVAILABLE  nothing to place. Never plotted; listed with the reason.

The distinction is the whole point of the map. A derived point drawn like a
measured one is a picture of an assumption presented as evidence, and an
analyst who cannot tell them apart cannot use either.

HARD RULES, each with a test:

  * A DERIVED coordinate is rounded to ONE DECIMAL PLACE (~11 km). Carrying
    six decimals would imply metre precision the rule does not have.
  * NO RANDOM JITTER, ever. Two hosts that genuinely share a location get two
    identical coordinates and are clustered by the UI. Scattering them to look
    prettier is fabrication.
  * A DERIVED coordinate is DETERMINISTIC: the same host yields the same point
    across runs and across processes, so two analysts comparing screenshots see
    the same map.
  * `.onion` is NEVER resolved (INV-1). It is UNAVAILABLE by construction, and
    the reason says so as a feature.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

RESOLVED = "resolved"
DERIVED = "derived"
UNAVAILABLE = "unavailable"

CLASSES = (RESOLVED, DERIVED, UNAVAILABLE)

ONION_RE = re.compile(r"\.onion$", re.I)

#: Points older than this render muted with an age chip. A stale location
#: presented as current is a false statement.
FRESHNESS_WINDOW_S = 24 * 60 * 60


@dataclass
class ChainStep:
    """One step of the resolution chain, with the time it happened."""

    step: str
    detail: str
    at: str
    ok: bool = True

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass
class GeoPoint:
    host: str
    cls: str
    lat: float | None = None
    lng: float | None = None
    ip: str | None = None
    reverse_dns: str | None = None
    asn: int | None = None
    asn_org: str | None = None
    city: str | None = None
    region: str | None = None
    country: str | None = None
    country_code: str | None = None
    provider: str | None = None
    resolver_used: str | None = None
    ttl: int | None = None
    resolved_at: str | None = None
    #: Why this point is UNAVAILABLE, or which rule produced a DERIVED one.
    reason: str | None = None
    derivation_rule: str | None = None
    resolution_chain: list[dict] = field(default_factory=list)
    #: Seconds since the underlying lookup. Shown in the UI, never hidden.
    cache_age_s: int | None = None

    def as_dict(self) -> dict:
        d = asdict(self)
        d["class"] = d.pop("cls")
        return d


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def is_onion(host: str) -> bool:
    return bool(ONION_RE.search((host or "").strip().lower()))


def clean_host(host: str) -> str:
    h = (host or "").strip().lower()
    for p in ("https://", "http://"):
        if h.startswith(p):
            h = h[len(p):]
    return h.split("/")[0].split(":")[0]


# ---------------------------------------------------------------------------
# Derivation
# ---------------------------------------------------------------------------

#: Known market-hosting regions, rounded to 1 dp. These are REGIONS, not
#: addresses, and the rounding is what says so.
MARKET_REGIONS: dict[str, tuple[float, float, str]] = {
    "alphabay": (52.4, 4.9, "Amsterdam hosting region"),
    "evolution": (50.1, 8.7, "Frankfurt hosting region"),
    "dream": (46.2, 6.1, "Geneva hosting region"),
    "nucleus": (55.8, 37.6, "Moscow hosting region"),
    "agora": (1.3, 103.8, "Singapore hosting region"),
    "silk": (37.8, -122.4, "San Francisco hosting region"),
    "hansa": (52.5, 13.4, "Berlin hosting region"),
}

#: Exchange HQ regions. Chain off-ramps are ALWAYS derived -- an exchange's
#: corporate headquarters is not where a transaction happened.
EXCHANGE_REGIONS: dict[str, tuple[float, float, str]] = {
    "binance": (35.2, 33.4, "Binance corporate region"),
    "kraken": (37.8, -122.4, "Kraken corporate region"),
    "coinbase": (37.8, -122.4, "Coinbase corporate region"),
    "bitfinex": (22.3, 114.2, "Bitfinex corporate region"),
}


def _round(v: float) -> float:
    """One decimal place: ~11 km. A DERIVED point must not imply more."""
    return round(v, 1)


def derive_for(host: str) -> GeoPoint | None:
    """A DERIVED point, or None when no rule applies.

    Returns None rather than inventing something. A host that matches no known
    region is UNAVAILABLE -- a coordinate hashed from its name would be a
    fabrication wearing a coordinate's clothes, which is exactly what
    FINDING-06 was.
    """
    h = clean_host(host)
    for key, (lat, lng, label) in MARKET_REGIONS.items():
        if key in h:
            return GeoPoint(
                host=h, cls=DERIVED, lat=_round(lat), lng=_round(lng),
                derivation_rule=f"host contains '{key}' -> {label}",
                reason="This is not a measured location. It represents a known "
                       "hosting region for this host class.",
                resolved_at=now_iso(),
                resolution_chain=[ChainStep(
                    "derive", f"matched market rule '{key}'", now_iso()
                ).as_dict()],
            )
    return None


def derive_for_exchange(label: str) -> GeoPoint | None:
    """A DERIVED point for a chain off-ramp. Always derived, never resolved."""
    key = (label or "").strip().lower()
    for name, (lat, lng, region) in EXCHANGE_REGIONS.items():
        if name in key:
            return GeoPoint(
                host=label, cls=DERIVED, lat=_round(lat), lng=_round(lng),
                derivation_rule=f"exchange '{name}' -> {region}",
                reason="This is not a measured location. It represents a known "
                       "corporate region for this exchange, not where any "
                       "transaction occurred.",
                resolved_at=now_iso(),
                resolution_chain=[ChainStep(
                    "derive", f"matched exchange rule '{name}'", now_iso()
                ).as_dict()],
            )
    return None


def unavailable(host: str, reason: str, chain: list[dict] | None = None) -> GeoPoint:
    return GeoPoint(
        host=clean_host(host), cls=UNAVAILABLE, reason=reason,
        resolved_at=now_iso(), resolution_chain=chain or [],
    )


def onion_refusal(host: str) -> GeoPoint:
    """`.onion` is refused BY DESIGN, and the wording says so.

    INV-1. This is not a failure to resolve -- it is a refusal to try, and on a
    demo it is one of the more convincing things on screen.
    """
    at = now_iso()
    return GeoPoint(
        host=clean_host(host), cls=UNAVAILABLE,
        reason="onion — resolution refused by design",
        resolved_at=at,
        resolution_chain=[ChainStep(
            "refuse",
            "PRAHARI never resolves or contacts a .onion host (INV-1). No DNS "
            "query was issued.",
            at,
        ).as_dict()],
    )


def age_seconds(resolved_at: str | None, now: datetime | None = None) -> int | None:
    if not resolved_at:
        return None
    try:
        then = datetime.fromisoformat(resolved_at)
    except ValueError:
        return None
    if then.tzinfo is None:
        then = then.replace(tzinfo=timezone.utc)
    return int(((now or datetime.now(timezone.utc)) - then).total_seconds())


def is_stale(resolved_at: str | None, window_s: int = FRESHNESS_WINDOW_S) -> bool:
    age = age_seconds(resolved_at)
    return age is not None and age > window_s


def coordinates_equal(a: GeoPoint, b: GeoPoint) -> bool:
    """Exact equality, deliberately.

    Two hosts in the same datacentre SHOULD produce identical coordinates. The
    UI clusters them; it does not scatter them. This helper exists so the
    no-jitter test can say what it means.
    """
    return a.lat == b.lat and a.lng == b.lng


def summarise(points: list[GeoPoint]) -> dict[str, Any]:
    """Counts by class, so the UI can state what it is showing and what it is not."""
    counts = {c: 0 for c in CLASSES}
    for p in points:
        counts[p.cls] = counts.get(p.cls, 0) + 1
    return {
        "resolved": counts[RESOLVED],
        "derived": counts[DERIVED],
        "unavailable": counts[UNAVAILABLE],
        "plotted": counts[RESOLVED] + counts[DERIVED],
        "total": len(points),
    }
