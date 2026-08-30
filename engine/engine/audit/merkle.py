"""Merkle tree over a case's audit leaves, with single-record inclusion proofs.

The inclusion proof is what makes an export admissible without disclosure.
An analyst can hand a court ONE record plus a short proof, and the court can
verify that record was in the sealed case -- without ever seeing the other
records, which may concern unrelated suspects.

That is the practical reading of Bharatiya Sakshya Adhiniyam 2023 section 63:
prove the integrity of the specific electronic record produced.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .ledger import keccak256


def _hash_pair(a: str, b: str) -> str:
    """Order-sensitive parent hash, matching Solidity byte concatenation."""
    return keccak256(bytes.fromhex(a[2:]) + bytes.fromhex(b[2:]))


def build(leaves: list[str]) -> list[list[str]]:
    """Full tree, level 0 = leaves. An odd node is promoted, never duplicated.

    Duplicating the last node is the classic CVE-2012-2459 shape: two distinct
    leaf sets can produce the same root. Promotion avoids it.
    """
    if not leaves:
        return [[]]
    levels = [list(leaves)]
    while len(levels[-1]) > 1:
        cur = levels[-1]
        nxt: list[str] = []
        for i in range(0, len(cur) - 1, 2):
            nxt.append(_hash_pair(cur[i], cur[i + 1]))
        if len(cur) % 2 == 1:
            nxt.append(cur[-1])
        levels.append(nxt)
    return levels


def root(leaves: list[str]) -> str:
    if not leaves:
        return "0x" + "00" * 32
    return build(leaves)[-1][0]


@dataclass
class Proof:
    leaf: str
    index: int
    siblings: list[dict] = field(default_factory=list)
    root: str = ""

    def as_dict(self) -> dict:
        return {"leaf": self.leaf, "index": self.index,
                "siblings": self.siblings, "root": self.root}


def proof(leaves: list[str], index: int) -> Proof:
    """Inclusion proof for one leaf: O(log n) sibling hashes."""
    if not leaves or not 0 <= index < len(leaves):
        raise IndexError("leaf index out of range")

    levels = build(leaves)
    sibs: list[dict] = []
    idx = index
    for level in levels[:-1]:
        if idx % 2 == 0:
            if idx + 1 < len(level):
                sibs.append({"hash": level[idx + 1], "position": "right"})
            # No sibling: this node was promoted unchanged to the next level.
        else:
            sibs.append({"hash": level[idx - 1], "position": "left"})
        idx //= 2
    return Proof(leaf=leaves[index], index=index, siblings=sibs, root=levels[-1][0])


def verify_proof(leaf: str, siblings: list[dict], expected_root: str) -> bool:
    """Recompute the root from one leaf and its siblings. Never raises."""
    try:
        node = leaf
        for s in siblings:
            if s["position"] == "right":
                node = _hash_pair(node, s["hash"])
            else:
                node = _hash_pair(s["hash"], node)
        return node == expected_root
    except Exception:  # noqa: BLE001
        return False
