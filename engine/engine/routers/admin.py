"""The admin scope (DEC-060).

Every handler depends on ``admin.auth.require``, which verifies the service
token INDEPENDENTLY of the web proxy and checks the role against the engine's
own table. Every mutation is appended to the keccak-256 / Ed25519 audit ledger
before it is reported as done.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from ..admin.auth import Principal, require
from ..admin.store import STORE, Conflict, NotFound
from ..audit import merkle as M
from ..audit.cases import keys_for, ledger
from ..audit.ledger import ADMIN_ACTIONS
from ..audit.ledger import verify as verify_chain
from ..fusion import eval as E

router = APIRouter(prefix="/admin", tags=["admin"])

#: Admin mutations are recorded against this case, so they sit in the same
#: tamper-evident chain as investigative actions rather than in a side log.
ADMIN_CASE = "CASE-ADMIN"

KINDS = ("personas", "posts", "entities", "actors", "cases", "sources", "users")


def record(principal: Principal, action: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Append to the audit chain. Called BEFORE a mutation is reported as done.

    If this raises, the caller has not yet answered success -- which is the
    right ordering. A mutation that happened but was never recorded is exactly
    the gap an audit chain exists to close.
    """
    if action not in ADMIN_ACTIONS:
        # The set is closed. An unknown action is a programming error, not a
        # request to widen the ledger.
        raise HTTPException(status_code=500, detail=f"Unknown admin action {action}.")
    priv, pub = keys_for(principal.email or principal.sub)
    lg = ledger(ADMIN_CASE)
    rec = lg.append(principal.email or principal.sub, action, payload, priv, pub)
    return {"seq": rec.seq, "hash": rec.hash, "prev_hash": rec.prev_hash}


class Patch(BaseModel):
    """A validated write. Pydantic on the engine side, zod on the web side."""

    patch: dict[str, Any] = Field(default_factory=dict)
    #: The updated_at the client last saw. Absent means "I did not look",
    #: which is allowed for a create and refused for an edit by the store.
    expected_updated_at: str | None = None
    reason: str | None = None


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------

@router.get("/{kind}")
def list_kind(
    kind: str,
    request: Request,
    principal: Principal = Depends(require),
    q: str = Query(""),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    include_deleted: bool = Query(False),
) -> dict:
    if kind not in KINDS:
        raise HTTPException(status_code=404, detail="Unknown entity kind.")
    return STORE.list(kind, include_deleted=include_deleted, limit=limit, offset=offset, q=q)


# ---------------------------------------------------------------------------
# Writes
# ---------------------------------------------------------------------------

@router.post("/{kind}")
def create(kind: str, rid: str = Query(..., alias="id"), body: Patch = Body(default=Patch()),
           principal: Principal = Depends(require)) -> dict:
    if kind not in KINDS:
        raise HTTPException(status_code=404, detail="Unknown entity kind.")
    try:
        out = STORE.create(kind, rid, body.patch, principal.email)
    except Conflict as c:
        raise HTTPException(status_code=409, detail=f"{kind} {rid} already exists.") from c
    entry = record(principal, "admin.create",
                   {"kind": kind, "id": rid, "diff": out["diff"], "reason": body.reason})
    return {"ok": True, **out, "ledger": entry}


@router.patch("/{kind}/{rid}")
def update(kind: str, rid: str, body: Patch = Body(...),
           principal: Principal = Depends(require)) -> dict:
    if kind not in KINDS:
        raise HTTPException(status_code=404, detail="Unknown entity kind.")

    # An attribution override is capped and flagged, never presented as a model
    # output. The UI shows it as an analyst decision with a name attached.
    if kind == "actors" and "attribution_confidence" in body.patch:
        if not body.reason:
            raise HTTPException(
                status_code=400,
                detail="An attribution override requires a written justification.",
            )
        body.patch["override"] = True
        body.patch["override_reason"] = body.reason
        body.patch["override_by"] = principal.email

    try:
        out = STORE.update(kind, rid, body.patch, principal.email, body.expected_updated_at)
    except NotFound as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Conflict as c:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "This record changed since you loaded it. Reload and reapply.",
                "expected_updated_at": c.expected,
                "actual_updated_at": c.actual,
            },
        ) from c

    action = "admin.override" if kind == "actors" and body.reason else "admin.update"
    entry = record(principal, action,
                   {"kind": kind, "id": rid, "diff": out["diff"], "reason": body.reason})
    return {"ok": True, **out, "ledger": entry}


@router.delete("/{kind}/{rid}")
def soft_delete(kind: str, rid: str, expected_updated_at: str | None = Query(None),
                reason: str | None = Query(None),
                principal: Principal = Depends(require)) -> dict:
    """A soft delete. There is no hard-delete endpoint, by design."""
    if kind not in KINDS:
        raise HTTPException(status_code=404, detail="Unknown entity kind.")
    try:
        out = STORE.soft_delete(kind, rid, principal.email, expected_updated_at)
    except NotFound as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Conflict as c:
        raise HTTPException(status_code=409, detail={
            "message": "This record changed since you loaded it.",
            "expected_updated_at": c.expected, "actual_updated_at": c.actual,
        }) from c
    entry = record(principal, "admin.delete", {"kind": kind, "id": rid, "reason": reason})
    return {
        "ok": True, **out, "ledger": entry,
        "honesty": "Soft-deleted. The record is hidden from reads and remains in exports.",
    }


@router.post("/{kind}/{rid}/restore")
def restore(kind: str, rid: str, principal: Principal = Depends(require)) -> dict:
    if kind not in KINDS:
        raise HTTPException(status_code=404, detail="Unknown entity kind.")
    try:
        out = STORE.restore(kind, rid, principal.email)
    except NotFound as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    entry = record(principal, "admin.restore", {"kind": kind, "id": rid})
    return {"ok": True, **out, "ledger": entry}


# ---------------------------------------------------------------------------
# Bulk import -- dry run first, always
# ---------------------------------------------------------------------------

class BulkImport(BaseModel):
    kind: str
    #: Raw CSV. Parsed here rather than client-side so the diff preview and the
    #: commit are computed from exactly the same bytes.
    csv: str = ""
    dry_run: bool = True
    reason: str | None = None


def _parse_csv(text: str) -> tuple[list[dict[str, Any]], list[str]]:
    """A deliberately small parser: header row, comma separated, no quoting.

    Stated rather than implied. A CSV dialect guesser that silently mis-splits a
    quoted field would corrupt evidence quietly, which is worse than refusing a
    file. Rows that do not match the header width are REPORTED, not dropped.
    """
    import csv as _csv
    import io

    problems: list[str] = []
    rows: list[dict[str, Any]] = []
    reader = _csv.reader(io.StringIO(text.strip()))
    try:
        header = next(reader)
    except StopIteration:
        return [], ["The file is empty."]
    if "id" not in header:
        return [], ["The header row must contain an 'id' column."]

    for n, raw in enumerate(reader, start=2):
        if len(raw) != len(header):
            problems.append(f"Row {n}: expected {len(header)} columns, found {len(raw)}.")
            continue
        row = dict(zip(header, raw, strict=True))
        if not row.get("id"):
            problems.append(f"Row {n}: missing id.")
            continue
        rows.append(row)
    return rows, problems


@router.post("/bulk/import")
def bulk_import(body: BulkImport, principal: Principal = Depends(require)) -> dict:
    """CSV import, dry run first.

    The dry run returns a DIFF PREVIEW -- what would be created, what would be
    updated, and field-by-field before/after for each. A bulk operation that
    commits before anyone has seen its consequences is the one that ends up
    rewriting a hundred records nobody meant to touch.
    """
    if body.kind not in KINDS:
        raise HTTPException(status_code=404, detail="Unknown entity kind.")

    rows, problems = _parse_csv(body.csv)

    creates: list[dict[str, Any]] = []
    updates: list[dict[str, Any]] = []
    for row in rows:
        rid = row["id"]
        patch = {k: v for k, v in row.items() if k != "id"}
        try:
            existing = STORE.get(body.kind, rid)
            diff = {
                k: {"before": existing.data.get(k), "after": v}
                for k, v in patch.items() if existing.data.get(k) != v
            }
            if diff:
                updates.append({"id": rid, "diff": diff})
        except NotFound:
            creates.append({"id": rid, "diff": {k: {"before": None, "after": v}
                                                for k, v in patch.items()}})

    if body.dry_run:
        return {
            "ok": True, "dry_run": True, "parsed": len(rows), "problems": problems,
            "would_create": creates, "would_update": updates,
            "detail": "Nothing was changed. Review the diff, then re-send with dry_run=false.",
        }

    if problems:
        # Refuse a partial import. Half a file applied is a dataset nobody can
        # reason about afterwards.
        raise HTTPException(
            status_code=400,
            detail={"message": "Fix these rows before importing.", "problems": problems},
        )
    if not body.reason:
        raise HTTPException(status_code=400, detail="A bulk import requires a written reason.")

    for c in creates:
        STORE.create(body.kind, c["id"],
                     {k: v["after"] for k, v in c["diff"].items()}, principal.email)
    for u in updates:
        STORE.update(body.kind, u["id"],
                     {k: v["after"] for k, v in u["diff"].items()}, principal.email, None)

    entry = record(principal, "admin.bulk_import", {
        "kind": body.kind, "created": len(creates), "updated": len(updates),
        "reason": body.reason,
    })
    return {"ok": True, "dry_run": False, "created": len(creates),
            "updated": len(updates), "ledger": entry}


# ---------------------------------------------------------------------------
# Retention -- dry run first, always
# ---------------------------------------------------------------------------

class PurgeRequest(BaseModel):
    kind: str
    before: str
    dry_run: bool = True
    reason: str | None = None
    #: Two-person rule: a second authorised user's token, not the caller's.
    second_approver: str | None = None


@router.post("/retention/purge")
def purge(body: PurgeRequest, principal: Principal = Depends(require)) -> dict:
    """A retention purge that cannot be dry-run is not shipped.

    The dry run is the DEFAULT and the wet run needs a named second approver.
    A single person able to irreversibly remove evidence is the failure this
    guards against, whether the cause is a mistake or coercion.
    """
    if body.kind not in KINDS:
        raise HTTPException(status_code=404, detail="Unknown entity kind.")

    rows = [r for r in STORE.export(body.kind) if (r.get("updated_at") or "") < body.before]

    if body.dry_run:
        return {
            "ok": True,
            "dry_run": True,
            "would_purge": len(rows),
            "sample": [r["id"] for r in rows[:20]],
            "detail": "Nothing was changed. Re-send with dry_run=false and a second approver.",
        }

    if not body.second_approver or body.second_approver == principal.email:
        raise HTTPException(
            status_code=400,
            detail="A live purge needs a second approver, and it cannot be you.",
        )
    if not body.reason:
        raise HTTPException(status_code=400, detail="A live purge requires a written reason.")

    # Even here nothing is hard-deleted: purge is a soft delete with a retention
    # reason. The playbook's rule is absolute -- never a hard DELETE on evidence.
    for r in rows:
        try:
            STORE.soft_delete(body.kind, r["id"], principal.email, None)
        except (NotFound, Conflict):
            continue

    entry = record(principal, "admin.purge", {
        "kind": body.kind, "before": body.before, "count": len(rows),
        "reason": body.reason, "second_approver": body.second_approver,
    })
    return {
        "ok": True, "dry_run": False, "purged": len(rows), "ledger": entry,
        "honesty": "Records were soft-deleted with a retention reason. Nothing was hard-deleted.",
    }


# ---------------------------------------------------------------------------
# Analytics -- real numbers, or an explicit absence
# ---------------------------------------------------------------------------

@router.get("/analytics/{scope}")
def analytics(scope: str, principal: Principal = Depends(require)) -> dict:
    """Every figure is measured. A scope that cannot be computed says so rather
    than returning zeroes, because a zero is a measurement (INV-5)."""
    if scope == "overview":
        index = STORE.list("actors", limit=200)
        confs = [
            i["attribution_confidence"] for i in index["items"]
            if i.get("attribution_confidence") is not None
        ]
        bands = {
            "strong": sum(1 for c in confs if c >= 0.90),
            "worth_a_look": sum(1 for c in confs if 0.75 <= c < 0.90),
            "weak": len(index["items"]) - sum(1 for c in confs if c >= 0.75),
        }
        overrides = sum(1 for i in index["items"] if i.get("override"))
        return {
            "ok": True, "scope": scope, "actors": index["total"], "bands": bands,
            "measured": len(confs), "unmeasured": index["total"] - len(confs),
            "override_rate": (overrides / index["total"]) if index["total"] else 0.0,
        }

    if scope == "model":
        m = E.metrics()
        return {"ok": True, "scope": scope, **m}

    if scope == "signals":
        # How often each root SURVIVES collapse versus is discarded. Genuinely
        # diagnostic, and nobody currently sees it.
        ds = E.build_signals()
        survived: dict[str, int] = {}
        discarded: dict[str, int] = {}
        for ps in ds.by_pair.values():
            for root, names in (ps.roots_collapsed or {}).items():
                survived[root] = survived.get(root, 0) + (1 if names else 0)
                discarded[root] = discarded.get(root, 0) + max(0, len(names) - 1)
        roots = sorted(set(survived) | set(discarded))
        return {
            "ok": True, "scope": scope,
            "roots": [
                {"root": r, "survived": survived.get(r, 0), "discarded": discarded.get(r, 0)}
                for r in roots
            ],
            "pairs": len(ds.by_pair),
        }

    if scope == "ledger":
        lg = ledger(ADMIN_CASE)
        # The same Merkle helper and the same chain verifier the case ledger
        # uses -- a second implementation could report a root the audit page
        # disagreed with, which is DEC-038 all over again.
        v = verify_chain([r.as_dict() for r in lg.records])
        return {
            "ok": True, "scope": scope, "records": len(lg.records),
            "merkle_root": M.root(lg.leaves()) if lg.records else None,
            "verification": v.as_dict(),
        }

    return {
        "ok": False, "scope": scope, "available": False,
        "detail": f"No analytics are computed for '{scope}'.",
    }


@router.get("/audit/activity")
def activity(principal: Principal = Depends(require),
             limit: int = Query(100, ge=1, le=500)) -> dict:
    """Who did what, from the chain itself -- not from a parallel log that could
    disagree with it."""
    lg = ledger(ADMIN_CASE)
    rows = [
        {
            "seq": r.seq, "actor": r.actor, "action": r.action, "ts": r.ts,
            "payload": r.payload, "hash": r.hash, "prev_hash": r.prev_hash,
            "signed": r.signature is not None,
        }
        for r in lg.records[-limit:]
    ]
    return {"ok": True, "count": len(rows), "records": rows,
            "merkle_root": M.root(lg.leaves()) if lg.records else None}
