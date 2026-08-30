"""Audit ledger, sealing, verification and export."""

from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import PlainTextResponse, Response
from pydantic import BaseModel

from ..audit import export as X
from ..audit import merkle as M
from ..audit.anchor import get_provider
from ..audit.cases import (DEMO_ANALYST, all_cases, case_ref, get_seal, keys_for,
                           ledger, public_keys, set_seal)
from ..audit.ledger import ACTIONS, verify as verify_chain

router = APIRouter(tags=["audit"])


@router.get("/audit/cases")
def cases() -> dict:
    return {"ok": True, "cases": all_cases(), "actions": list(ACTIONS)}


@router.get("/audit/case/{case_id}/ledger")
def case_ledger(case_id: str) -> dict:
    lg = ledger(case_id)
    leaves = lg.leaves()
    v = verify_chain([r.as_dict() for r in lg.records], public_keys())
    return {
        "ok": True, "case_id": case_id,
        "records": [r.as_dict() for r in lg.records],
        "merkle_root": M.root(leaves), "leaf_count": len(leaves),
        "head": lg.head(), "verification": v.as_dict(),
        "seal": get_seal(case_id),
    }


class Action(BaseModel):
    actor: str = DEMO_ANALYST
    action: str
    payload: dict = {}


@router.post("/audit/case/{case_id}/record")
def append_record(case_id: str, a: Action) -> dict:
    if a.action not in ACTIONS:
        return {"ok": False, "detail": f"Unknown action. Allowed: {list(ACTIONS)}"}
    priv, pub = keys_for(a.actor)
    rec = ledger(case_id).append(a.actor, a.action, a.payload, priv, pub)
    return {"ok": True, "record": rec.as_dict()}


@router.post("/audit/case/{case_id}/seal")
def seal(case_id: str) -> dict:
    """Anchor the case's Merkle root. The chain label comes from the node."""
    lg = ledger(case_id)
    leaves = lg.leaves()
    if not leaves:
        return {"ok": False, "detail": "Nothing to seal: the ledger is empty."}

    root = M.root(leaves)
    res = get_provider().anchor(root, case_ref(case_id), len(leaves))
    data = res.as_dict()
    if res.ok:
        set_seal(case_id, data)
        priv, pub = keys_for(DEMO_ANALYST)
        lg.append(DEMO_ANALYST, "seal",
                  {"root": root, "tx_hash": res.tx_hash, "chain_id": res.chain_id}, priv, pub)
    return {"ok": res.ok, "case_id": case_id, "merkle_root": root,
            "leaf_count": len(leaves), **data}


@router.get("/audit/case/{case_id}/proof/{index}")
def inclusion_proof(case_id: str, index: int) -> dict:
    leaves = ledger(case_id).leaves()
    if not 0 <= index < len(leaves):
        return {"ok": False, "detail": "Record index out of range."}
    return {"ok": True, "case_id": case_id, **M.proof(leaves, index).as_dict()}


class VerifyRequest(BaseModel):
    # Either a whole exported bundle, or one record plus its proof.
    records: list[dict] | None = None
    leaf: str | None = None
    siblings: list[dict] | None = None
    merkle_root: str | None = None


@router.post("/audit/verify")
def verify(req: VerifyRequest) -> dict:
    """Green or red, and when red, WHICH record and why."""
    if req.leaf and req.siblings is not None and req.merkle_root:
        ok = M.verify_proof(req.leaf, req.siblings, req.merkle_root)
        return {"ok": ok, "mode": "inclusion_proof",
                "detail": ("Record is included in the sealed Merkle root."
                           if ok else "Proof does not reconstruct the sealed root.")}

    if req.records is None:
        return {"ok": False, "detail": "Provide either `records`, or `leaf`+`siblings`+`merkle_root`."}

    v = verify_chain(req.records, public_keys())
    out = {"ok": v.ok, "mode": "chain", **v.as_dict()}
    if v.ok and req.merkle_root:
        recomputed = M.root([
            __import__("engine.audit.ledger", fromlist=["AuditRecord"]).AuditRecord(
                seq=r["seq"], case_id=r["case_id"], actor=r["actor"], action=r["action"],
                payload=r["payload"], ts=r["ts"], prev_hash=r["prev_hash"],
            ).leaf_hash() for r in req.records
        ])
        out["merkle_root_matches"] = recomputed == req.merkle_root
        out["recomputed_root"] = recomputed
        if not out["merkle_root_matches"]:
            out["ok"] = False
            out["reason"] = "Chain is intact but the Merkle root does not match the sealed root."
    return out


@router.get("/export/case/{case_id}.json")
def export_json(case_id: str) -> Response:
    return Response(X.to_json(case_id), media_type="application/json",
                    headers={"Content-Disposition": f'attachment; filename="{case_id}.json"'})


@router.get("/export/case/{case_id}.csv", response_class=PlainTextResponse)
def export_csv(case_id: str) -> Response:
    return Response(X.to_csv(case_id), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{case_id}.csv"'})


@router.get("/export/case/{case_id}.pdf")
def export_pdf(case_id: str) -> Response:
    return Response(X.to_pdf(case_id), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{case_id}.pdf"'})
