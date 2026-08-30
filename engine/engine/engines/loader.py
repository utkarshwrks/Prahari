"""Bridge: testbed / dataset records -> graph rows."""

from __future__ import annotations

from dataclasses import asdict

from ..testbed.generate import Testbed, generate
from . import graph


def testbed_to_rows(tb: Testbed) -> tuple[list[dict], list[dict], list[dict]]:
    personas = [
        {"id": p.id, "market": p.market, "handle": p.handle,
         "first_seen": p.first_seen, "last_seen": p.last_seen,
         "bio": p.bio, "role": p.role}
        for p in tb.personas
    ]

    links: list[dict] = []
    for p in tb.personas:
        if p.pgp_fpr:
            links.append({"persona_id": p.id, "kind": "pgp", "value": p.pgp_fpr})
        if p.wallet:
            links.append({"persona_id": p.id, "kind": "wallet", "value": p.wallet})
        if p.email:
            links.append({"persona_id": p.id, "kind": "email", "value": p.email})
        if p.onion:
            links.append({"persona_id": p.id, "kind": "onion", "value": p.onion})

    lineage = [
        {"from": p.wallet, "to": p.wallet_lineage_to}
        for p in tb.personas
        if getattr(p, "wallet_lineage_to", None) and p.wallet
    ]
    return personas, links, lineage


def load_testbed(seed: int | None = None, wipe: bool = True) -> dict:
    """Full reload. Returns the stats the /graph endpoints report."""
    tb = generate(seed=seed) if seed is not None else generate()
    personas, links, lineage = testbed_to_rows(tb)

    if wipe:
        graph.clear()
    graph.ensure_schema()
    graph.load_personas(personas)
    graph.load_entity_links(links)
    graph.load_lineage(lineage)
    res = graph.resolve_actors()
    embedded = graph.embeddings()

    s = graph.stats()
    return {**s.as_dict(), **res, "embedded": embedded,
            "labels": len(tb.labels), "source": "testbed"}
