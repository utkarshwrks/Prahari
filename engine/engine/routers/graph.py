"""Graph endpoints. Every one degrades honestly when Neo4j is down."""

from __future__ import annotations

import logging
from functools import lru_cache

from fastapi import APIRouter, Query

from ..engines import graph as G
from ..engines import linkage as L
from ..testbed.generate import generate

log = logging.getLogger(__name__)
router = APIRouter(prefix="/graph", tags=["graph"])


def _unavailable(detail: str) -> dict:
    return {"ok": False, "available": False, "detail": detail,
            "nodes": [], "edges": [], "results": []}


@router.get("/stats")
def stats() -> dict:
    s = G.stats()
    return {"ok": s.available, **s.as_dict()}


@router.get("/actor/{actor_id}")
def actor(actor_id: str) -> dict:
    ok, err = G.ping()
    if not ok:
        return _unavailable(f"Neo4j unreachable ({err})")
    sub = G.actor_subgraph(actor_id)
    return {"ok": True, "available": True, **sub}


@router.get("/persona/{persona_id}")
def persona(persona_id: str) -> dict:
    ok, err = G.ping()
    if not ok:
        return _unavailable(f"Neo4j unreachable ({err})")
    a = G.persona_actor(persona_id)
    if a is None:
        return {"ok": False, "available": True, "detail": "Persona not in the graph."}
    return {"ok": True, "available": True, "persona_id": persona_id,
            "actor_id": a, **G.actor_subgraph(a)}


@router.get("/search")
def search(q: str = Query(min_length=1), limit: int = Query(20, ge=1, le=100)) -> dict:
    ok, err = G.ping()
    if not ok:
        return _unavailable(f"Neo4j unreachable ({err})")
    rows = G.search(q, limit)
    return {"ok": True, "available": True, "query": q, "count": len(rows), "results": rows}


@lru_cache(maxsize=1)
def _linkage():
    """Splink is expensive; compute once per process."""
    tb = generate()
    return tb, L.run(tb)


@router.get("/candidates")
def candidates(
    persona: str = Query(...),
    threshold: float = Query(0.0, ge=0.0, le=1.0),
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    """Blocked candidate pairs for a persona, with Splink's match_probability.

    A candidate is a pair worth SCORING, not a match. The decoy appears here by
    design -- blocking proposed it because the bio is identical -- and its low
    probability is the system rejecting it on the evidence.
    """
    _, res = _linkage()
    if not res.trained:
        return {"ok": False, "detail": res.detail or "Linkage unavailable", "results": []}
    rows = [
        {**p, "other": p["persona_b"] if p["persona_a"] == persona else p["persona_a"]}
        for p in res.pairs
        if persona in (p["persona_a"], p["persona_b"]) and p["match_probability"] >= threshold
    ]
    rows.sort(key=lambda r: -r["match_probability"])
    return {"ok": True, "persona": persona, "count": len(rows[:limit]), "results": rows[:limit]}


@router.get("/metrics")
def metrics(threshold: float = Query(0.5, ge=0.0, le=1.0)) -> dict:
    """Linkage precision/recall against the testbed labels."""
    tb, res = _linkage()
    if not res.trained:
        return {"ok": False, "detail": res.detail or "Linkage unavailable"}
    m = L.evaluate(tb, res, threshold)
    return {"ok": True, **m, "m_u": res.mu}


@router.post("/reload")
def reload_graph() -> dict:
    ok, err = G.ping()
    if not ok:
        return _unavailable(f"Neo4j unreachable ({err})")
    from ..engines.loader import load_testbed

    return {"ok": True, **load_testbed()}
