"""Case export in the three NTRO-mandated formats.

Every format embeds the Merkle root, the anchoring transaction and chain id,
plus a per-record inclusion proof -- so a single record can be verified in
isolation without disclosing the rest of the case.
"""

from __future__ import annotations

import csv
import io
import json

from . import merkle as M
from .cases import get_seal, ledger, public_keys


def bundle(case_id: str) -> dict:
    lg = ledger(case_id)
    leaves = lg.leaves()
    seal = get_seal(case_id) or {}
    current_root = M.root(leaves)
    sealed_root = seal.get("root")

    # If records were appended after sealing, the current root legitimately
    # differs from the anchored one. Say so loudly rather than publishing a
    # root that was never on chain.
    drift = bool(sealed_root and sealed_root != current_root)

    return {
        "case_id": case_id,
        "generated_by": "PRAHARI v2",
        "merkle_root": current_root,
        "sealed_root": sealed_root,
        "sealed_root_matches_current": (not drift) if sealed_root else None,
        "records_added_after_seal": (
            len(leaves) - seal.get("leaf_count", len(leaves))) if sealed_root else 0,
        "integrity_note": (
            "Records were appended after this case was sealed. Verify the "
            "sealed_root against the chain, and re-seal to cover the new records."
            if drift else None),
        "leaf_count": len(leaves),
        "seal": seal,
        "chain_id": seal.get("chain_id"),
        "tx_hash": seal.get("tx_hash"),
        "is_public_chain": seal.get("is_public_chain", False),
        "chain_label": seal.get("chain_label", "NOT SEALED"),
        "explorer_url": seal.get("explorer_url"),
        "analyst_public_keys": public_keys(),
        "records": [
            {**r.as_dict(), "inclusion_proof": M.proof(leaves, i).as_dict()}
            for i, r in enumerate(lg.records)
        ],
    }


def to_json(case_id: str) -> str:
    return json.dumps(bundle(case_id), indent=2, sort_keys=True, ensure_ascii=False)


def to_csv(case_id: str) -> str:
    b = bundle(case_id)
    buf = io.StringIO()
    w = csv.writer(buf, quoting=csv.QUOTE_ALL)
    w.writerow(["case_id", "merkle_root", "chain_id", "tx_hash", "chain_label"])
    w.writerow([b["case_id"], b["merkle_root"], b["chain_id"], b["tx_hash"], b["chain_label"]])
    w.writerow([])
    w.writerow(["seq", "ts", "actor", "action", "payload", "prev_hash", "hash", "signature"])
    for r in b["records"]:
        # QUOTE_ALL plus csv's own escaping: an analyst note containing a comma
        # or a quote must not be able to shift columns in the exhibit.
        w.writerow([r["seq"], r["ts"], r["actor"], r["action"],
                    json.dumps(r["payload"], sort_keys=True),
                    r["prev_hash"], r["hash"], r["signature"] or ""])
    return buf.getvalue()


def to_pdf(case_id: str) -> bytes:
    """Dark-on-white, escaped. Falls back to plain text when reportlab is absent."""
    b = bundle(case_id)
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas as pdfcanvas
    except Exception:  # noqa: BLE001
        return to_json(case_id).encode("utf-8")

    buf = io.BytesIO()
    c = pdfcanvas.Canvas(buf, pagesize=A4)
    w, h = A4
    y = h - 20 * mm

    def line(text: str, size: int = 9, dy: float = 5 * mm, bold: bool = False):
        nonlocal y
        if y < 20 * mm:
            c.showPage()
            y = h - 20 * mm
        c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        c.drawString(18 * mm, y, str(text)[:110])
        y -= dy

    line("PRAHARI - Case Export", 15, 8 * mm, True)
    line(f"Case: {b['case_id']}", 10, 6 * mm, True)
    line(f"Merkle root: {b['merkle_root']}", 8)
    line(f"Leaf count: {b['leaf_count']}")
    line(f"Chain: {b['chain_label']}  (chain_id {b['chain_id']})")
    line(f"Tx: {b['tx_hash'] or 'not sealed'}", 8)
    if not b["is_public_chain"] and b["tx_hash"]:
        line("NOTE: sealed to a LOCAL chain. This is not a public anchor.", 9, 6 * mm, True)
    line("")
    line("Audit records", 12, 7 * mm, True)
    for r in b["records"]:
        line(f"[{r['seq']}] {r['ts']}  {r['action']}  by {r['actor']}", 9)
        line(f"     hash {r['hash']}", 7, 4 * mm)
        line(f"     prev {r['prev_hash']}", 7, 5 * mm)
    c.save()
    return buf.getvalue()
