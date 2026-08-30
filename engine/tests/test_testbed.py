"""Testbed determinism and the four labelled cases."""

from __future__ import annotations

from engine.testbed.generate import generate, labels_digest


def test_same_seed_gives_identical_labels():
    assert labels_digest(generate()) == labels_digest(generate())


def test_different_seed_gives_different_labels():
    assert labels_digest(generate()) != labels_digest(generate(seed=999))


def test_all_four_cases_present():
    cases = {x.case for x in generate().labels}
    assert {"multi_persona", "rebrand", "decoy", "unrelated"} <= cases


def test_enough_positives_to_calibrate():
    """Phase 7 conformal prediction needs a meaningful validation split.
    An earlier 40-actor config produced 21 positives - far too few."""
    tb = generate()
    assert tb.meta["positive_pairs"] >= 100, tb.meta["positive_pairs"]


def test_negative_ratio_is_bounded():
    tb = generate()
    ratio = tb.meta["negative_pairs"] / tb.meta["positive_pairs"]
    assert ratio <= 25, f"imbalance {ratio:.0f}:1 is not trainable"


def test_decoy_is_the_hard_negative():
    tb = generate()
    lab = next(x for x in tb.labels if x.case == "decoy")
    a = next(p for p in tb.personas if p.id == lab.persona_a)
    b = next(p for p in tb.personas if p.id == lab.persona_b)
    assert lab.same_actor is False
    assert lab.must_not_link is True
    assert a.bio == b.bio          # the trap: verbatim copied bio
    assert a.style == b.style      # and the same writing style
    assert a.pgp_fpr != b.pgp_fpr  # the evidence against
    assert a.wallet != b.wallet


def test_rebrand_is_not_solvable_by_hard_identifier():
    """Wallet LINEAGE, not a shared address. If they shared an address the
    pair would be solved trivially by WCC and prove nothing about style."""
    tb = generate()
    a = next(p for p in tb.personas if p.role == "rebrand_before")
    b = next(p for p in tb.personas if p.role == "rebrand_after")
    assert a.wallet != b.wallet
    assert a.wallet_lineage_to == b.wallet
    assert a.pgp_fpr is None and b.pgp_fpr is None
    assert a.last_seen < b.first_seen  # death precedes birth


def test_infra_case_has_an_onion():
    tb = generate()
    infra = next(p for p in tb.personas if p.role == "infra")
    assert infra.onion and infra.onion.endswith(".onion")
    assert len(infra.onion.split(".")[0]) == 56  # v3


def test_multi_persona_actors_share_a_hard_identifier():
    tb = generate()
    mp = [x for x in tb.labels if x.case == "multi_persona"]
    by_id = {p.id: p for p in tb.personas}
    shared = sum(
        1 for x in mp
        if (by_id[x.persona_a].pgp_fpr and by_id[x.persona_a].pgp_fpr == by_id[x.persona_b].pgp_fpr)
        or (by_id[x.persona_a].wallet and by_id[x.persona_a].wallet == by_id[x.persona_b].wallet)
    )
    assert shared / len(mp) >= 0.75


def test_posts_carry_timestamps_unlike_agora():
    """The testbed is the ONLY temporal source in the project (DEC-018)."""
    tb = generate()
    assert all(p.ts for p in tb.posts)


def test_generated_text_contains_no_how_to_content():
    from engine.ingest.kaggle_agora import _BLOCK_RE

    tb = generate()
    for p in tb.posts:
        assert not _BLOCK_RE.search(f"{p.title} {p.body}")
