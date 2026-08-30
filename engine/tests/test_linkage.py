"""Splink linkage: measured m/u, precision, and the decoy's low score."""

from __future__ import annotations

import pytest

from engine.engines import linkage as L
from engine.testbed.generate import generate


@pytest.fixture(scope="module")
def run():
    tb = generate()
    return tb, L.run(tb)


def test_linkage_trains(run):
    _, res = run
    assert res.trained, res.detail
    assert res.n_blocked > 0


def test_u_is_measured_not_estimated(run):
    """DEC-020. estimate_u_using_random_sampling reported u(pgp)=0.0053 on this
    data because it sampled the true matches too. The measured value is ~0."""
    _, res = run
    assert res.mu is not None
    u = res.mu["pgp_fpr"]["u"]
    assert u < 1e-4, f"u(pgp)={u} looks like a contaminated estimate, not a measurement"
    assert u > 0, "u must stay positive; an infinite Bayes factor is not honest"


def test_hard_identifiers_dominate(run):
    """A shared 40-hex fingerprint must be worth thousands, not hundreds."""
    _, res = run
    assert res.mu["pgp_fpr"]["bayes_factor"] > 10_000
    assert res.mu["wallet"]["bayes_factor"] > 10_000


def test_precision_is_perfect_with_zero_false_positives(run):
    tb, res = run
    m = L.evaluate(tb, res, 0.5)
    assert m["false_positives"] == 0
    assert m["precision"] == 1.0


def test_recall_reaches_the_structural_ceiling(run):
    """DEC-021. Only 130 of 159 true pairs share any hard identifier, so
    exact-match linkage cannot exceed 0.818. Splink must find all 130."""
    tb, res = run
    m = L.evaluate(tb, res, 0.5)
    assert m["true_positives"] == 130
    assert m["recall"] >= 0.81


def test_recall_over_reachable_pairs_is_total(run):
    """The number that is actually about linkage quality: of the pairs a
    record linker CAN find, it finds all of them."""
    tb, res = run
    by = {p.id: p for p in tb.personas}
    truth = {frozenset((x.persona_a, x.persona_b)) for x in tb.labels if x.same_actor}
    reachable = {
        k for k in truth
        if (lambda a, b: (by[a].pgp_fpr and by[a].pgp_fpr == by[b].pgp_fpr)
            or (by[a].wallet and by[a].wallet == by[b].wallet))(*tuple(k))
    }
    found = {
        frozenset((p["persona_a"], p["persona_b"]))
        for p in res.pairs if p["match_probability"] >= 0.5
    }
    assert reachable <= found, f"{len(reachable - found)} reachable pairs missed"


def test_decoy_is_blocked_but_scores_low(run):
    """Both halves matter. Blocking MUST propose the decoy -- an identical bio
    is a reason to look -- and the evidence must then reject it."""
    tb, res = run
    m = L.evaluate(tb, res, 0.5)
    assert m["decoy_blocked"] is True, "blocking never proposed the decoy"
    assert m["decoy_match_probability"] < 0.5
    assert m["decoy_match_probability"] < 0.05


def test_blocking_coverage_is_reported(run):
    """Blocking is a recall ceiling, so it is measured, not assumed."""
    _, res = run
    assert 0.0 < res.coverage <= 1.0
    assert res.coverage > 0.8


def test_probabilities_are_valid(run):
    _, res = run
    for p in res.pairs:
        assert 0.0 <= p["match_probability"] <= 1.0
        assert p["match_probability"] == p["match_probability"]  # not NaN


def test_evaluate_is_deterministic(run):
    tb, res = run
    assert L.evaluate(tb, res, 0.5) == L.evaluate(tb, res, 0.5)
