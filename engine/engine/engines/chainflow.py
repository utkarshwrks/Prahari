"""Blockchain flow analysis — wallet clustering to real-world off-ramps.

The PS asks us to trace threat actors, and money is the one identifier that has
to touch the real world eventually: a wallet cluster leads to a KYC exchange, a
mixer, or a laundering path. This is the fifth signal family and the source of
the `financial` root.

Two heuristics, both standard and both defensible in court:

  COMMON-INPUT (multi-input) clustering — if a single transaction spends from
  several addresses at once, one entity controls all of them (they had to sign
  for all the inputs). Union-find merges them into one wallet cluster. This is
  the heuristic that underpins essentially every real chain-analysis tool.

  CHANGE-ADDRESS heuristic — a fresh address receiving the change of a spend is
  usually controlled by the same entity. Applied conservatively (only when
  unambiguous) because a wrong merge here is a wrong attribution.

Clusters are then matched against public exchange / mixer tag lists. A path to a
tagged off-ramp is the real-world lead; a path through a mixer is the
money-laundering / terror-financing signal the PS names, and it also DROPS the
financial evidence for attribution — a mixer output is shared by thousands.

Source-independent: it takes transactions, it produces clusters. `chain.py`
feeds it real mempool.space / Etherscan data; the testbed feeds it labelled
co-spends so precision is measurable.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

log = logging.getLogger(__name__)

# Public tag lists — a small, illustrative set of well-known tagged addresses.
# In production these come from the public tag feeds the playbook allows.
EXCHANGE_TAGS: dict[str, str] = {
    "1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s": "Binance (hot wallet)",
    "3M219KR5vEneNb47ewrPfWyb5jQ2DjxRP6": "Binance",
    "1P5ZEDWTKTFGxQjZphgWPQUpe554WKDfHQ": "Kraken",
    "0x28c6c06298d514db089934071355e5743bf21d60": "Binance 14",
    "0x3cd751e6b0078be393132286c442345e5dc49699": "Coinbase",
}
MIXER_TAGS: dict[str, str] = {
    "bc1qmixer00000000000000000000000000000000": "CoinJoin coordinator",
    "0x722122df12d4e14e13ac3b6895a86e84145b6967": "Tornado Cash",
    "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b": "Tornado Cash router",
}


class _UnionFind:
    def __init__(self) -> None:
        self.parent: dict[str, str] = {}

    def find(self, x: str) -> str:
        self.parent.setdefault(x, x)
        root = x
        while self.parent[root] != root:
            root = self.parent[root]
        # path compression
        while self.parent[x] != root:
            self.parent[x], x = root, self.parent[x]
        return root

    def union(self, a: str, b: str) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[ra] = rb


@dataclass
class Transaction:
    txid: str
    inputs: list[str]           # spending addresses (co-spent = same controller)
    outputs: list[str]
    change: str | None = None   # the address identified as change, if any


@dataclass
class WalletCluster:
    cluster_id: str
    addresses: list[str]
    tx_count: int = 0
    reaches: list[dict] = field(default_factory=list)   # tagged off-ramps hit
    risk: str = "unclassified"                          # clean | exchange | laundering

    def as_dict(self) -> dict:
        return self.__dict__.copy()


def tag_of(address: str) -> tuple[str, str] | None:
    """Return (label, kind) if the address is a known exchange or mixer."""
    if address in EXCHANGE_TAGS:
        return EXCHANGE_TAGS[address], "exchange"
    if address in MIXER_TAGS:
        return MIXER_TAGS[address], "mixer"
    return None


def cluster(transactions: list[Transaction]) -> dict[str, WalletCluster]:
    """Union-find over common inputs + conservative change linking."""
    uf = _UnionFind()
    tx_by_addr: dict[str, int] = {}

    for tx in transactions:
        # Common-input: every input address is co-signed, so one controller.
        for a in tx.inputs:
            for b in tx.inputs[1:]:
                uf.union(a, b)
            tx_by_addr[a] = tx_by_addr.get(a, 0) + 1
        # Change heuristic: a change output rejoins the input cluster.
        if tx.change and tx.inputs:
            uf.union(tx.inputs[0], tx.change)

    clusters: dict[str, list[str]] = {}
    for addr in uf.parent:
        clusters.setdefault(uf.find(addr), []).append(addr)

    out: dict[str, WalletCluster] = {}
    for root, addrs in clusters.items():
        wc = WalletCluster(
            cluster_id=f"cluster:{root[:10]}",
            addresses=sorted(addrs),
            tx_count=sum(tx_by_addr.get(a, 0) for a in addrs),
        )
        # Does this cluster's money reach a tagged off-ramp?
        for tx in transactions:
            if any(uf.find(i) == root for i in tx.inputs):
                for o in tx.outputs:
                    t = tag_of(o)
                    if t:
                        wc.reaches.append({"address": o, "label": t[0], "kind": t[1]})
        kinds = {r["kind"] for r in wc.reaches}
        wc.risk = "laundering" if "mixer" in kinds else "exchange" if "exchange" in kinds else "clean"
        out[wc.cluster_id] = wc
    return out


def cluster_for(address: str, transactions: list[Transaction]) -> WalletCluster | None:
    """The cluster containing a given address, with its off-ramp trail."""
    clusters = cluster(transactions)
    for wc in clusters.values():
        if address in wc.addresses:
            return wc
    return None


def co_spent_edges(transactions: list[Transaction]) -> list[dict]:
    """CO_SPENT_WITH edges for the identity graph: address pairs proven to share
    a controller by appearing as inputs of one transaction."""
    seen: set[frozenset[str]] = set()
    edges: list[dict] = []
    for tx in transactions:
        for i, a in enumerate(tx.inputs):
            for b in tx.inputs[i + 1:]:
                key = frozenset((a, b))
                if key not in seen:
                    seen.add(key)
                    edges.append({"a": a, "b": b, "strength": 0.85, "txid": tx.txid})
    return edges


def financial_signal(a_cluster: WalletCluster | None, b_cluster: WalletCluster | None) -> dict:
    """Turn a shared cluster into the `financial` root signal for fusion.

    A mixer in the path DROPS the signal — a mixer output is shared by thousands,
    so it is not evidence of a common controller.
    """
    if not a_cluster or not b_cluster:
        return {"present": False}
    if a_cluster.cluster_id == b_cluster.cluster_id:
        laundering = a_cluster.risk == "laundering"
        return {
            "present": not laundering,
            "root": "financial",
            "name": "shared_wallet_cluster",
            "strength": 0.0 if laundering else 0.85,
            "dropped": laundering,
            "reason": ("Both wallets resolve to one cluster via common-input clustering."
                       + (" Cluster passes through a mixer, so the financial root is dropped."
                          if laundering else "")),
        }
    return {"present": False}


# --------------------------------------------------------------------------
# Live chain adapter — real transactions from mempool.space (no key)
# --------------------------------------------------------------------------


def from_mempool(address: str, limit: int = 25) -> list[Transaction]:
    """Pull real BTC transactions and shape them for clustering. Never raises."""
    import httpx

    try:
        with httpx.Client(timeout=15.0) as c:
            r = c.get(f"https://mempool.space/api/address/{address}/txs")
            r.raise_for_status()
            raw = r.json()[:limit]
    except Exception:  # noqa: BLE001
        return []

    txs: list[Transaction] = []
    for t in raw:
        inputs = [
            v.get("prevout", {}).get("scriptpubkey_address")
            for v in t.get("vin", [])
            if v.get("prevout", {}).get("scriptpubkey_address")
        ]
        outputs = [
            o.get("scriptpubkey_address")
            for o in t.get("vout", [])
            if o.get("scriptpubkey_address")
        ]
        if inputs:
            txs.append(Transaction(txid=t.get("txid", "")[:16], inputs=inputs, outputs=outputs))
    return txs
