"""Fusion endpoints. Every score ships with the trail that reproduces it."""

from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from ..fusion import calibrate as C
from ..fusion import eval as E
from ..fusion.score import (CAPS, DECK_EXAMPLE, RELIABILITY, ROOTS,
                            reproduce_from_trail, score)

router = APIRouter(prefix="/fusion", tags=["fusion"])

# Analyst verdicts, in memory for Phase 7. Phase 8 makes each one an
# append-only, signed audit record.
_FEEDBACK: dict[str, dict] = {}


@router.get("/model")
def model() -> dict:
    """The scoring model itself, published. No black boxes."""
    return {
        "ok": True,
        "roots": list(ROOTS),
        "reliability": RELIABILITY,
        "caps": CAPS,
        "prior_odds": {"blocked": 0.1, "unblocked": 0.0001},
        "formula": "p = odds/(1+odds), odds = prior_odds * PROD(LR_root ^ r_root)",
        "naive_baseline": "noisy-OR: 1 - PROD(1 - s)",
    }


@router.get("/example")
def deck_example() -> dict:
    """The worked example: 0.84 against a naive 0.999."""
    s = score("deck-example", DECK_EXAMPLE, blocked=True)
    return {
        "ok": True, **s.as_dict(),
        "reproduced_from_trail": reproduce_from_trail(s.trail),
        "gap": round(s.naive_stack - s.p_raw, 6),
    }


@router.get("/pair/{pair_id:path}")
def pair(pair_id: str) -> dict:
    ds = E.build_signals()
    ps = ds.by_pair.get(pair_id)
    if ps is None:
        return {"ok": False, "detail": "Unknown pair."}
    E.ensure_calibrated()
    fb = _FEEDBACK.get(pair_id)
    out = ps.as_dict()
    out["p_calibrated"] = round(C.apply(ps.p_raw), 6)
    if fb and fb.get("verdict") == "reject":
        # An analyst who looked and said no outranks the model.
        rescored = score(pair_id, [], blocked=ps.blocked, analyst_verdict="reject")
        out["p_raw"] = rescored.p_raw
        out["p_calibrated"] = rescored.p_raw
        out["cap_applied"] = rescored.cap_applied
        out["analyst_verdict"] = fb
    return {"ok": True, **out, "reproduced_from_trail": reproduce_from_trail(ps.trail)}


@router.get("/threshold")
def threshold(alpha: float = Query(0.05, gt=0.0, lt=1.0)) -> dict:
    E.ensure_calibrated()
    rows = E.thresholds((alpha,))
    return {"ok": True, **rows[0]}


@router.get("/thresholds")
def threshold_table() -> dict:
    return {"ok": True, "rows": E.thresholds((0.01, 0.02, 0.05, 0.10, 0.20))}


@router.get("/metrics")
def metrics(alpha: float = Query(0.05, gt=0.0, lt=1.0)) -> dict:
    return {"ok": True, **E.evaluate(alpha)}


class Feedback(BaseModel):
    pair_id: str
    verdict: str = Field(pattern="^(confirm|reject)$")
    note: str = ""


@router.post("/feedback")
def feedback(fb: Feedback) -> dict:
    """Analyst verdict. A reject caps the pair at 0.10 and re-scores."""
    ds = E.build_signals()
    if fb.pair_id not in ds.by_pair:
        return {"ok": False, "detail": "Unknown pair."}
    _FEEDBACK[fb.pair_id] = {"verdict": fb.verdict, "note": fb.note}
    return {"ok": True, **pair(fb.pair_id)}
