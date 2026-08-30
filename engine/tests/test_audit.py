"""Immutable audit: hash chain, signatures, Merkle proofs, anchoring.

The D3.3 threat model runs throughout: an attacker with FULL DATABASE WRITE
ACCESS but without the analyst's Ed25519 private key or the anchorer wallet.
Every one of their attacks must be detected, and detection must name the index.
"""

from __future__ import annotations

import copy

import pytest

from engine.audit import merkle as M
from engine.audit.anchor import (LOCAL_CHAIN_IDS, NullAnchorProvider, chain_label,
                                 explorer_url)
from engine.audit.ledger import (ACTIONS, GENESIS, Ledger, canonical_json,
                                 generate_keypair, keccak256, sign, verify,
                                 verify_signature)


@pytest.fixture
def signed_ledger():
    priv, pub = generate_keypair()
    lg = Ledger("CASE-T")
    for action, payload in [
        ("score", {"pair_id": "a|b", "p_raw": 0.84}),
        ("confirm", {"pair_id": "a|b"}),
        ("assign", {"officer": "SI A. Yadav"}),
        ("note", {"text": "field unit notified"}),
        ("export", {"format": "json"}),
    ]:
        lg.append("officer@mp.gov.in", action, payload, priv, pub)
    return lg, priv, pub


# --------------------------------------------------------------------------
# Primitives
# --------------------------------------------------------------------------


def test_keccak_matches_solidity_not_sha3():
    """Solidity's keccak256 differs from sha3-256 in padding. Using the wrong
    one makes on-chain verification silently fail against off-chain hashes."""
    assert keccak256(b"") == (
        "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470")


def test_canonical_json_is_key_order_independent():
    assert canonical_json({"b": 1, "a": 2}) == canonical_json({"a": 2, "b": 1})


def test_canonical_json_rejects_nan():
    """NaN is not valid JSON and would serialise differently across parsers,
    breaking the hash for anyone re-verifying with another toolchain."""
    with pytest.raises(ValueError):
        canonical_json({"x": float("nan")})


def test_canonical_json_has_no_whitespace():
    assert b" " not in canonical_json({"a": 1, "b": [1, 2]})


def test_unicode_survives_canonicalisation():
    a = canonical_json({"city": "जबलपुर"})
    assert a == canonical_json({"city": "जबलपुर"})
    assert "जबलपुर" in a.decode("utf-8")


# --------------------------------------------------------------------------
# Chain
# --------------------------------------------------------------------------


def test_chain_starts_at_genesis(signed_ledger):
    lg, _, _ = signed_ledger
    assert lg.records[0].prev_hash == GENESIS


def test_each_record_links_to_the_previous(signed_ledger):
    lg, _, _ = signed_ledger
    for i in range(1, len(lg.records)):
        assert lg.records[i].prev_hash == lg.records[i - 1].hash


def test_intact_chain_verifies(signed_ledger):
    lg, _, pub = signed_ledger
    v = verify([r.as_dict() for r in lg.records], {"officer@mp.gov.in": pub})
    assert v.ok
    assert v.checks["signatures_verified"] == 5


def test_unknown_action_is_refused(signed_ledger):
    lg, _, _ = signed_ledger
    with pytest.raises(ValueError):
        lg.append("x", "delete_everything", {})
    assert "delete_everything" not in ACTIONS


# --------------------------------------------------------------------------
# D3.3 - attacker with database write access
# --------------------------------------------------------------------------


def test_attack_1_modify_a_record_in_place(signed_ledger):
    """Detected, and at which index?"""
    lg, _, pub = signed_ledger
    rows = [r.as_dict() for r in lg.records]
    rows[2]["payload"] = {"officer": "SOMEONE ELSE"}
    v = verify(rows, {"officer@mp.gov.in": pub})
    assert v.ok is False
    assert v.failing_index == 2
    assert "altered" in v.reason


def test_attack_2_delete_a_middle_record(signed_ledger):
    """A gap in seq is itself tamper evidence."""
    lg, _, pub = signed_ledger
    rows = [r.as_dict() for r in lg.records]
    del rows[2]
    v = verify(rows, {"officer@mp.gov.in": pub})
    assert v.ok is False
    assert v.failing_index == 2
    assert "deleted or reordered" in v.reason


def test_attack_2b_delete_and_relink_prev_hash(signed_ledger):
    """The sophisticated version: repair prev_hash after deleting."""
    lg, _, pub = signed_ledger
    rows = [r.as_dict() for r in lg.records]
    del rows[2]
    rows[2]["prev_hash"] = rows[1]["hash"]   # relink
    for i, r in enumerate(rows):
        r["seq"] = i                          # renumber to hide the gap
    v = verify(rows, {"officer@mp.gov.in": pub})
    assert v.ok is False, "a relinked deletion went undetected"


def test_attack_3_resign_with_a_different_key(signed_ledger):
    """The attacker has DB access and their own keypair, but not the analyst's."""
    lg, _, pub = signed_ledger
    evil_priv, evil_pub = generate_keypair()
    rows = [r.as_dict() for r in lg.records]
    rows[1]["payload"] = {"pair_id": "forged"}

    from engine.audit.ledger import AuditRecord

    rec = AuditRecord(**{k: rows[1][k] for k in
                         ("seq", "case_id", "actor", "action", "payload", "ts", "prev_hash")})
    rows[1]["hash"] = rec.compute_hash()
    rows[1]["signature"] = sign(evil_priv, rec.leaf_bytes())
    rows[1]["pubkey"] = evil_pub

    v = verify(rows, {"officer@mp.gov.in": pub})
    assert v.ok is False
    assert v.failing_index == 1
    assert "not registered" in v.reason


def test_attack_4_reorder_records(signed_ledger):
    lg, _, pub = signed_ledger
    rows = [r.as_dict() for r in lg.records]
    rows[1], rows[3] = rows[3], rows[1]
    assert verify(rows, {"officer@mp.gov.in": pub}).ok is False


def test_attack_5_append_an_unsigned_record(signed_ledger):
    """An appended record with no signature must not silently pass as signed."""
    lg, _, pub = signed_ledger
    rows = [r.as_dict() for r in lg.records]
    v = verify(rows, {"officer@mp.gov.in": pub})
    lg.append("attacker", "confirm", {"pair_id": "forged"})  # unsigned
    rows2 = [r.as_dict() for r in lg.records]
    v2 = verify(rows2, {"officer@mp.gov.in": pub})
    assert v2.checks["signatures_present"] == v.checks["signatures_verified"]
    assert v2.n_records == v.n_records + 1


def test_restoring_the_record_makes_it_green_again(signed_ledger):
    lg, _, pub = signed_ledger
    good = [r.as_dict() for r in lg.records]
    bad = copy.deepcopy(good)
    bad[2]["payload"] = {"tampered": True}
    assert verify(bad, {"officer@mp.gov.in": pub}).ok is False
    assert verify(good, {"officer@mp.gov.in": pub}).ok is True


def test_signature_verification_never_raises():
    for pub, msg, sig in [("zz", b"x", "yy"), ("", b"", ""), ("aa" * 32, b"x", "bb" * 64)]:
        assert verify_signature(pub, msg, sig) is False


# --------------------------------------------------------------------------
# Merkle
# --------------------------------------------------------------------------


def test_proof_round_trip_for_every_record(signed_ledger):
    lg, _, _ = signed_ledger
    leaves = lg.leaves()
    root = M.root(leaves)
    for i in range(len(leaves)):
        p = M.proof(leaves, i)
        assert M.verify_proof(p.leaf, p.siblings, root)


def test_altered_proof_is_rejected(signed_ledger):
    lg, _, _ = signed_ledger
    leaves = lg.leaves()
    root = M.root(leaves)
    p = M.proof(leaves, 1)
    tampered = copy.deepcopy(p.siblings)
    tampered[0]["hash"] = keccak256(b"wrong")
    assert M.verify_proof(p.leaf, tampered, root) is False


def test_proof_for_a_different_leaf_is_rejected(signed_ledger):
    lg, _, _ = signed_ledger
    leaves = lg.leaves()
    p = M.proof(leaves, 1)
    assert M.verify_proof(leaves[0], p.siblings, M.root(leaves)) is False


def test_odd_node_is_promoted_not_duplicated():
    """Duplicating the last node lets two distinct leaf sets share a root
    (the CVE-2012-2459 shape)."""
    three = [keccak256(bytes([i])) for i in range(3)]
    four = three + [three[-1]]
    assert M.root(three) != M.root(four)


def test_root_changes_when_any_leaf_changes(signed_ledger):
    lg, _, _ = signed_ledger
    leaves = lg.leaves()
    before = M.root(leaves)
    leaves[2] = keccak256(b"tampered")
    assert M.root(leaves) != before


def test_single_leaf_tree():
    leaf = keccak256(b"only")
    assert M.root([leaf]) == leaf
    assert M.verify_proof(leaf, M.proof([leaf], 0).siblings, leaf)


def test_proof_index_out_of_range():
    with pytest.raises(IndexError):
        M.proof([keccak256(b"a")], 5)


# --------------------------------------------------------------------------
# Anchoring - D3.3 objective 5
# --------------------------------------------------------------------------


@pytest.mark.parametrize("cid", sorted(LOCAL_CHAIN_IDS))
def test_local_chain_never_gets_an_explorer_link(cid):
    """A Sepolia explorer link for an Anvil transaction is a fabricated
    evidence trail. This is the single most important assertion here."""
    assert explorer_url(cid, "0x" + "ab" * 32) is None
    assert chain_label(cid) == "LOCAL CHAIN"


def test_sepolia_gets_an_explorer_link():
    url = explorer_url(11155111, "0x" + "ab" * 32)
    assert url and "sepolia.etherscan.io" in url
    assert chain_label(11155111) == "SEPOLIA"


def test_explorer_url_needs_both_chain_and_tx():
    assert explorer_url(None, "0xabc") is None
    assert explorer_url(11155111, None) is None


def test_unconfigured_anchoring_is_honest():
    r = NullAnchorProvider().anchor("0x" + "11" * 32, "0x" + "22" * 32, 3)
    assert r.ok is False
    assert r.chain_label == "NOT CONFIGURED"
    assert "still computed and verifiable offline" in r.detail
    assert r.explorer_url is None


# --------------------------------------------------------------------------
# Export
# --------------------------------------------------------------------------


def test_export_json_carries_root_tx_and_proofs():
    import json

    from engine.audit import export as X

    b = json.loads(X.to_json("CASE-001"))
    for k in ("merkle_root", "chain_id", "tx_hash", "records"):
        assert k in b
    for r in b["records"]:
        assert "inclusion_proof" in r


def test_export_csv_quotes_every_field():
    from engine.audit import export as X

    out = X.to_csv("CASE-001")
    assert out.startswith('"case_id"')
    assert "merkle_root" in out


def test_export_pdf_is_a_pdf_or_an_honest_fallback():
    from engine.audit import export as X

    data = X.to_pdf("CASE-001")
    assert isinstance(data, bytes) and len(data) > 100
    assert data[:4] == b"%PDF" or b"merkle_root" in data
