"""DATASET-mode feed: real Agora listings shaped as v1 Intercepts.

Loaded once from the committed fixture so the demo never depends on the 32 MB
download. Entities are extracted per listing, so the workbench shows real
identifiers pulled from real marketplace text.

Severity here is NOT a geofence verdict. Agora contains no Madhya Pradesh
geography at all (DEC-018), so a DATASET item can never breach the Jabalpur
zone -- and must never pretend to.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

from ..extract.extractor import extract
from .kaggle_agora import load

log = logging.getLogger(__name__)

FIXTURE = Path(__file__).resolve().parents[2] / "fixtures" / "agora_sample.csv"


@lru_cache(maxsize=1)
def _items() -> list[dict]:
    if not FIXTURE.exists():
        log.warning("agora fixture missing", extra={"path": str(FIXTURE)})
        return []

    res = load(FIXTURE)
    out: list[dict] = []
    for i, p in enumerate(res.posts):
        text = " ".join(x for x in (p.title, p.body) if x)
        if not text:
            continue
        e = extract(text).entities
        out.append(
            {
                "id": p.id,
                "source": "Marketplace",
                "channel": "Agora 2014-2015",
                "timestamp": None,          # DEC-018: dataset has no timestamps
                "rawText": text[:400],
                "entities": {
                    "locations": e.locations,     # always [] for Agora
                    "contraband": e.contraband,
                    "wallets": e.crypto_wallets,
                    "handles": e.handles,
                },
                "severity": "medium" if e.contraband else "low",
                "live": False,
                "dataset": True,
                "vendor": p.persona_id.split(":", 1)[-1],
                "category": p.category,
                "price": p.price,
            }
        )
    log.info("dataset feed ready", extra={"items": len(out), "blocked": res.bodies_blocked})
    return out


def page(limit: int = 20, offset: int = 0) -> dict:
    items = _items()
    if not items:
        return {
            "items": [],
            "count": 0,
            "total": 0,
            "detail": "Agora fixture not found. See engine/README.md for the download steps.",
        }
    window = items[offset : offset + limit]
    return {
        "items": window,
        "count": len(window),
        "total": len(items),
        "detail": None,
    }
