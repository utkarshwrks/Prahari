"""Identity graph resolution.

The two assertions this phase exists to make:
  - personas sharing a hard identifier become ONE actor
  - the decoy does NOT, despite an identical bio and matching style

Skipped when Neo4j is unreachable so the suite still runs without Docker.
"""

from __future__ import annotations

import pytest

from engine.engines import graph as G
from engine.engines.loader import load_testbed
from engine.testbed.generate import generate

pytestmark = pytest.mark.skipif(not G.ping()[0], reason="Neo4j unreachable")


@pytest.fixture(scope="module")
def loaded():
    stats = load_testbed()
    return generate(), stats


def test_graph_loads_every_persona(loaded):
    tb, stats = loaded
    assert stats["personas"] == len(tb.personas)
    assert stats["edges"] > 0


def test_load_is_idempotent(loaded):
    """MERGE, not CREATE. The reload job runs on a schedule."""
    before = G.stats()
    load_testbed(wipe=False)
    after = G.stats()
    assert after.personas == before.personas
    assert after.entities == before.entities
    assert after.edges == before.edges


def test_multi_persona_actor_forms_one_component(loaded):
    """Every pair sharing a hard identifier must resolve to one actor."""
    tb, _ = loaded
    by = {p.id: p for p in tb.personas}
    checked = merged = 0
    for lab in (x for x in tb.labels if x.case == "multi_persona"):
        a, b = by[lab.persona_a], by[lab.persona_b]
        hard = (a.pgp_fpr and a.pgp_fpr == b.pgp_fpr) or (a.wallet and a.wallet == b.wallet)
        if not hard:
            continue
        checked += 1
        if G.persona_actor(lab.persona_a) == G.persona_actor(lab.persona_b):
            merged += 1
    assert checked > 0
    assert merged == checked, f"{checked - merged} hard-identifier pairs failed to merge"


def test_decoy_is_NOT_merged_with_its_target(loaded):
    """The headline assertion of Phase 4.

    The decoy copies the target's bio verbatim, matches its writing style and
    overlaps its active window. It shares no hard identifier. A system that
    merges it has learned to match bios, not people.
    """
    tb, _ = loaded
    lab = next(x for x in tb.labels if x.case == "decoy")
    by = {p.id: p for p in tb.personas}
    assert by[lab.persona_a].bio == by[lab.persona_b].bio      # the trap is real
    assert by[lab.persona_a].style == by[lab.persona_b].style
    assert G.persona_actor(lab.persona_a) != G.persona_actor(lab.persona_b)


def test_rebrand_pair_is_NOT_merged_by_hard_identifiers(loaded):
    """Wallet lineage is a transfer between distinct addresses, not shared
    control. If WCC merged this pair it would resolve for free and prove
    nothing about style or timing -- which is what Phase 5 must do."""
    tb, _ = loaded
    lab = next(x for x in tb.labels if x.case == "rebrand")
    assert G.persona_actor(lab.persona_a) != G.persona_actor(lab.persona_b)


def test_zero_false_merges_across_all_unrelated_pairs(loaded):
    """The false-merge rate we publish depends on this being 0."""
    tb, _ = loaded
    bad = [
        x for x in tb.labels
        if x.case == "unrelated"
        and G.persona_actor(x.persona_a) == G.persona_actor(x.persona_b)
    ]
    assert bad == [], f"{len(bad)} unrelated pairs were wrongly merged"


def test_only_hard_edges_form_actors():
    """DEC-022. Adding CONTACT here would merge everyone with a shared inbox."""
    assert set(G.HARD_EDGES) == {"SIGNED_WITH", "PAID_TO"}
    assert "CONTACT" not in G.HARD_EDGES
    assert "FUNDS_FLOW_TO" not in G.HARD_EDGES


def test_edge_weights_match_the_playbook():
    assert G.EDGE_WEIGHTS["SIGNED_WITH"] == 0.95
    assert G.EDGE_WEIGHTS["PAID_TO"] == 0.80
    assert G.EDGE_WEIGHTS["CONTACT"] == 0.70
    assert G.EDGE_WEIGHTS["VOUCHES_FOR"] == 0.30
    assert G.EDGE_WEIGHTS["MENTIONS"] == 0.20


def test_actor_subgraph_returns_nodes_and_edges(loaded):
    tb, _ = loaded
    actor = G.persona_actor(tb.personas[0].id)
    sub = G.actor_subgraph(actor)
    assert sub["nodes"]
    assert all("id" in n and "label" in n for n in sub["nodes"])
    for e in sub["edges"]:
        assert {"source", "target", "type"} <= set(e)


def test_search_finds_a_persona_by_handle(loaded):
    tb, _ = loaded
    h = tb.personas[0].handle
    assert any(r["handle"] == h for r in G.search(h))


def test_search_is_fast(loaded):
    import time

    t = time.perf_counter()
    G.search("night")
    assert time.perf_counter() - t < 1.0


def test_fastrp_embeddings_written(loaded):
    _, stats = loaded
    assert stats["embedded"] > 0
