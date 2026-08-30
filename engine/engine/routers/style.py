"""Stylometry, behaviour and rebrand endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Query

from ..engines import authorship as A
from ..engines import behaviour as B
from ..engines import stylometry as S

router = APIRouter(tags=["stylometry"])


@router.get("/style/compare")
def style_compare(a: str = Query(...), b: str = Query(...)) -> dict:
    pr = A.build_profiles()
    if a not in pr.style or b not in pr.style:
        return {"ok": False, "detail": "Unknown persona."}
    c = S.compare(pr.style[a], pr.style[b], pr.burstiness)
    return {"ok": True, **c.as_dict()}


@router.get("/style/profile/{persona_id}")
def style_profile(persona_id: str) -> dict:
    pr = A.build_profiles()
    p = pr.style.get(persona_id)
    if not p:
        return {"ok": False, "detail": "Unknown persona."}
    return {
        "ok": True, "persona_id": p.persona_id, "n_tokens": p.n_tokens,
        "ttr": round(p.ttr, 4), "mean_word_len": round(p.mean_word_len, 4),
        "hinglish_ratio": round(p.hinglish_ratio, 4),
        "devanagari_ratio": round(p.devanagari_ratio, 6),
        "honorific_rate": round(p.honorific_rate, 4),
        "punctuation": {k: round(v, 6) for k, v in p.punctuation.items()},
        "burstiness": S.burstiness(p.text),
        "engine": "classic",
    }


@router.get("/behaviour/compare")
def behaviour_compare(a: str = Query(...), b: str = Query(...)) -> dict:
    pr = A.build_profiles()
    if a not in pr.behav or b not in pr.behav:
        return {"ok": False, "detail": "Unknown persona."}
    c = B.compare(pr.behav[a], pr.behav[b])
    return {"ok": True, **c.as_dict()}


@router.get("/behaviour/profile/{persona_id}")
def behaviour_profile(persona_id: str) -> dict:
    pr = A.build_profiles()
    p = pr.behav.get(persona_id)
    if not p:
        return {"ok": False, "detail": "Unknown persona."}
    return {"ok": True, **p.as_dict()}


@router.get("/compare")
def compare_both(a: str = Query(...), b: str = Query(...)) -> dict:
    return A.compare_pair(a, b)


@router.get("/rebrand/candidates")
def rebrand(
    max_gap_days: int = Query(30, ge=1, le=365),
    min_style: float = Query(0.75, ge=0.0, le=1.0),
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    rows = A.rebrand_candidates(max_gap_days, min_style)
    return {"ok": True, "count": len(rows), "params":
            {"max_gap_days": max_gap_days, "min_style": min_style},
            "results": rows[:limit]}
