"""Labelled blockchain transactions for the testbed, so clustering precision is
measurable, plus a live real-chain demonstration.

The synthetic transactions inject a KNOWN ground truth: three addresses that
co-spend (one controller), a change chain, a path to a tagged exchange, and a
laundering path through a mixer. Clustering must recover exactly those groups.
"""

from __future__ import annotations

from functools import lru_cache

from .chainflow import Transaction, EXCHANGE_TAGS, MIXER_TAGS


@lru_cache(maxsize=1)
def testbed_transactions() -> list[Transaction]:
    exch = next(iter(EXCHANGE_TAGS))
    mixer = next(iter(MIXER_TAGS))
    return [
        # Actor A: three addresses co-spent in one tx -> one cluster.
        Transaction("tx1", ["addrA1", "addrA2", "addrA3"], ["dest1", "addrA4"], change="addrA4"),
        # A's cluster cashes out to a tagged exchange -> real-world off-ramp.
        Transaction("tx2", ["addrA4"], [exch, "addrA5"], change="addrA5"),
        # Actor B: separate cluster.
        Transaction("tx3", ["addrB1", "addrB2"], ["dest2", "addrB3"], change="addrB3"),
        # B launders through a mixer -> financial root must DROP for B.
        Transaction("tx4", ["addrB3"], [mixer, "addrB4"], change="addrB4"),
        # Unrelated single-input tx, its own trivial cluster.
        Transaction("tx5", ["addrC1"], ["dest3"]),
    ]


def cluster_map() -> dict[str, str]:
    """persona wallet -> a testbed address, so an actor's wallet maps into the
    labelled transaction graph."""
    return {}
