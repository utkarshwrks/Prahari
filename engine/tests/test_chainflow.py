"""Wallet clustering, off-ramp tagging, and the laundering drop."""

from __future__ import annotations

from engine.engines import chainflow as CF
from engine.engines.chainflow_testbed import testbed_transactions


def test_common_input_clustering_merges_co_spent_addresses():
    txs = testbed_transactions()
    c = CF.cluster_for("addrA1", txs)
    assert c is not None
    for a in ("addrA1", "addrA2", "addrA3"):
        assert a in c.addresses   # co-spent in tx1 -> one controller


def test_change_address_rejoins_the_cluster():
    txs = testbed_transactions()
    c = CF.cluster_for("addrA1", txs)
    assert "addrA4" in c.addresses   # change output of tx1


def test_separate_actors_do_not_merge():
    txs = testbed_transactions()
    a = CF.cluster_for("addrA1", txs)
    b = CF.cluster_for("addrB1", txs)
    assert a.cluster_id != b.cluster_id


def test_cluster_reaches_a_tagged_exchange():
    txs = testbed_transactions()
    c = CF.cluster_for("addrA1", txs)
    assert c.risk == "exchange"
    assert any(r["kind"] == "exchange" for r in c.reaches)


def test_laundering_path_is_flagged():
    txs = testbed_transactions()
    c = CF.cluster_for("addrB1", txs)
    assert c.risk == "laundering"
    assert any(r["kind"] == "mixer" for r in c.reaches)


def test_shared_cluster_gives_a_financial_signal():
    txs = testbed_transactions()
    a = CF.cluster_for("addrA1", txs)
    a2 = CF.cluster_for("addrA3", txs)
    sig = CF.financial_signal(a, a2)
    assert sig["present"] is True
    assert sig["strength"] == 0.85


def test_mixer_drops_the_financial_root():
    """A mixer output is shared by thousands, so it is not evidence of a common
    controller -- the financial root is dropped, not merely downweighted."""
    txs = testbed_transactions()
    b = CF.cluster_for("addrB1", txs)
    b2 = CF.cluster_for("addrB2", txs)
    sig = CF.financial_signal(b, b2)
    assert sig["present"] is False
    assert sig["dropped"] is True


def test_co_spent_edges_are_symmetric_and_deduped():
    txs = testbed_transactions()
    edges = CF.co_spent_edges(txs)
    keys = {frozenset((e["a"], e["b"])) for e in edges}
    assert len(keys) == len(edges)   # no duplicates


def test_union_find_path_compression():
    uf = CF._UnionFind()
    for a, b in [("a", "b"), ("b", "c"), ("c", "d")]:
        uf.union(a, b)
    assert uf.find("a") == uf.find("d")


def test_from_mempool_never_raises_offline(monkeypatch):
    import httpx

    class Boom:
        def __init__(self, *a, **k): pass
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def get(self, *a, **k): raise httpx.ConnectError("down")

    monkeypatch.setattr(httpx, "Client", Boom)
    assert CF.from_mempool("1abc") == []
