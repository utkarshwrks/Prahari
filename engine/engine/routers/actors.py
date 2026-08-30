"""Actor endpoints — the PS 26151 deliverables."""

from __future__ import annotations

import csv
import io
import json

from fastapi import APIRouter, Query
from fastapi.responses import Response

from ..engines import actors as A

router = APIRouter(tags=["actors"])


@router.get("/actors")
def list_actors(
    q: str = Query("", description="handle, identifier or actor id"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    min_confidence: float = Query(0.0, ge=0.0, le=1.0),
) -> dict:
    return {"ok": True, **A.list_actors(q, limit, offset, min_confidence)}


@router.get("/actor/{actor_id}")
def actor(actor_id: str) -> dict:
    p = A.profile(actor_id)
    if not p:
        return {"ok": False, "detail": "Unknown actor."}
    return {"ok": True, **p.as_dict()}


@router.get("/actor/{actor_id}/timeline")
def actor_timeline(actor_id: str, bucket: str = Query("week", pattern="^(day|week)$")) -> dict:
    return A.timeline(actor_id, bucket)


# --------------------------------------------------------------------------
# Export — CSV, JSON and report, carrying every field the PS names
# --------------------------------------------------------------------------

PS_FIELDS = [
    "actor_id", "label", "personas", "identifiers", "infrastructure_indicators",
    "persona_linkages", "attribution_confidence", "category", "last_scan", "source",
]


def _flat(p: A.ActorProfile) -> dict:
    return {
        "actor_id": p.actor_id,
        "label": p.label,
        "personas": "; ".join(f"{s.handle}@{s.market}" for s in p.personas),
        "identifiers": "; ".join(
            f"{i.kind}:{i.value}{' (shared)' if i.shared else ''}" for i in p.identifiers),
        "infrastructure_indicators": "; ".join(
            f"{x['clearnet_host']} ({x['strength']})" for x in p.infrastructure) or "none",
        "persona_linkages": "; ".join(
            f"{l.persona_a}~{l.persona_b}={l.confidence:.4f}" for l in p.linkages) or "none",
        "attribution_confidence": p.attribution_confidence,
        "category": "; ".join(p.categories),
        "last_scan": p.last_scan,
        "source": "; ".join(p.sources),
    }


@router.get("/export/actor/{actor_id}.json")
def export_json(actor_id: str) -> Response:
    p = A.profile(actor_id)
    if not p:
        return Response(json.dumps({"ok": False, "detail": "Unknown actor."}),
                        media_type="application/json", status_code=404)
    body = {
        "generated_by": "PRAHARI v2",
        "problem_statement": "SIH 2026 PS 26151 - dark web threat actor de-anonymisation",
        "mandated_fields": PS_FIELDS,
        "honesty": (
            "Attribution is by correlation of footprints operators leaked into public "
            "indexes. PRAHARI never connects to Tor and never de-anonymises the network "
            "itself. Confidence is calibrated and its false-merge rate is published."
        ),
        "profile": p.as_dict(),
    }
    return Response(json.dumps(body, indent=2, default=str),
                    media_type="application/json",
                    headers={"Content-Disposition": f'attachment; filename="{actor_id}.json"'})


@router.get("/export/actor/{actor_id}.csv")
def export_csv(actor_id: str) -> Response:
    p = A.profile(actor_id)
    if not p:
        return Response("actor not found", media_type="text/plain", status_code=404)
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=PS_FIELDS, quoting=csv.QUOTE_ALL)
    w.writeheader()
    w.writerow(_flat(p))
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{actor_id}.csv"'})


@router.get("/export/actors.csv")
def export_all_csv(min_confidence: float = Query(0.0, ge=0.0, le=1.0)) -> Response:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=PS_FIELDS, quoting=csv.QUOTE_ALL)
    w.writeheader()
    for row in A.list_actors(limit=200, min_confidence=min_confidence)["actors"]:
        p = A.profile(row["actor_id"])
        if p:
            w.writerow(_flat(p))
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="actors.csv"'})
