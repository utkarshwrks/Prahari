"""Blockchain flow endpoints. Real chain + labelled testbed."""

from __future__ import annotations

from fastapi import APIRouter, Query

from ..engines import chainflow as CF
from ..engines.chainflow_testbed import testbed_transactions

router = APIRouter(prefix="/chain", tags=["chainflow"])


@router.get("/clusters")
def clusters() -> dict:
    """Wallet clusters from the labelled testbed, with off-ramp trails."""
    txs = testbed_transactions()
    cs = [c.as_dict() for c in CF.cluster(txs).values()]
    cs.sort(key=lambda c: -len(c["addresses"]))
    return {"ok": True, "count": len(cs), "clusters": cs,
            "co_spent_edges": len(CF.co_spent_edges(txs))}


@router.get("/trace")
def trace(address: str = Query(..., min_length=6), limit: int = Query(15, ge=1, le=50)) -> dict:
    """Live common-input clustering on a REAL public BTC address."""
    if address.lower().endswith(".onion"):
        return {"ok": False, "detail": "Refused: not a chain address."}
    txs = CF.from_mempool(address, limit)
    if not txs:
        return {"ok": True, "address": address, "count": 0, "clusters": [],
                "detail": "No transactions returned (address empty or network unavailable)."}
    cs = CF.cluster(txs)
    target = CF.cluster_for(address, txs)
    return {
        "ok": True, "address": address, "source": "mempool.space (live)",
        "transactions": len(txs),
        "multi_input_txs": sum(1 for t in txs if len(t.inputs) > 1),
        "clusters": len(cs),
        "co_spent_edges": len(CF.co_spent_edges(txs)),
        "target_cluster": target.as_dict() if target else None,
    }
