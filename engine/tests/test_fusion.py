"""Evidence fusion, calibration, and the conformal guarantee.

These tests carry the project's central claim. The deck says 0.84 where naive
stacking says 0.999; if that stops being true, the pitch is wrong and the slide
must change, not the test.
"""

from __future__ import annotations

import math

import pytest

from engine.fusion import calibrate as C
from engine.fusion import eval as E
from engine.fusion.score import (CAPS, DECK_EXAMPLE, RELIABILITY, ROOTS, S_MAX,
                                 Signal, naive_stack, reproduce_from_trail, score)


# --------------------------------------------------------------------------
# The acceptance criteria
# --------------------------------------------------------------------------


def test_deck_example_reproduces_084():
    assert score("deck", DECK_EXAMPLE).p_raw == pytest.approx(0.84, abs=0.01)


def test_naive_stack_reproduces_0999():
    """DEC-003. An LR-product baseline gives 0.9963, not 0.999 -- this test
    would have failed against the project's own documentation."""
    assert naive_stack(DECK_EXAMPLE) == pytest.approx(0.999, abs=0.001)


def test_the_gap_is_the_pitch():
    s = score("deck", DECK_EXAMPLE)
    assert s.naive_stack - s.p_raw > 0.15


def test_trail_reproduces_p_raw_exactly():
    """D3.2 objective 3. A score whose trail cannot recompute it is not
    evidence, it is an assertion."""
    for blocked in (True, False):
        s = score("x", DECK_EXAMPLE, blocked=blocked)
        assert reproduce_from_trail(s.trail) == s.p_raw


# --------------------------------------------------------------------------
# Root-cause collapse - the step that stops double-counting
# --------------------------------------------------------------------------


def test_duplicate_signals_in_one_root_do_not_double_count():
    """D3.2 objective 1: the same fact under two names must collapse."""
    one = score("a", [Signal("infra", "cert_reuse", 0.83)])
    two = score("b", [
        Signal("infra", "cert_reuse", 0.83),
        Signal("infra", "same_certificate_different_name", 0.83),
        Signal("infra", "tls_fingerprint_from_that_cert", 0.83),
    ])
    assert two.p_raw == one.p_raw
    assert two.roots_collapsed["infra"]


def test_collapse_keeps_the_strongest_and_names_the_rest():
    s = score("a", [
        Signal("financial", "weak", 0.55),
        Signal("financial", "strong", 0.91),
    ])
    assert s.roots_used["financial"]["signal"] == "strong"
    assert any("weak" in x for x in s.roots_collapsed["financial"])


def test_independent_roots_do_accumulate():
    """Collapse must not flatten genuinely separate evidence."""
    one = score("a", [Signal("infra", "cert", 0.83)])
    two = score("b", [Signal("infra", "cert", 0.83),
                      Signal("identity_key", "pgp", 0.83)])
    assert two.p_raw > one.p_raw


# --------------------------------------------------------------------------
# Reliability dampening
# --------------------------------------------------------------------------


def test_reliability_ordering_reflects_evidence_quality():
    assert RELIABILITY["identity_key"] > RELIABILITY["infra"] > RELIABILITY["financial"]
    assert RELIABILITY["linguistic"] == 0.5


def test_a_key_outweighs_a_writing_style_at_equal_strength():
    k = score("k", [Signal("identity_key", "pgp", 0.9)])
    l = score("l", [Signal("linguistic", "style", 0.9)])
    assert k.p_raw > l.p_raw


def test_weak_linguistic_evidence_cannot_reach_certainty():
    """D3.2 objective 2: a defensible ceiling on style-only evidence."""
    s = score("style-only", [Signal("linguistic", "writing_style", 0.95)])
    assert s.p_raw < 0.75


# --------------------------------------------------------------------------
# Caps and negatives
# --------------------------------------------------------------------------


def test_mimicry_caps_the_pair():
    s = score("m", [
        Signal("linguistic", "writing_style", 0.99),
        Signal("identity_key", "pgp", 0.9),
        Signal("linguistic", "mimicry_suspected", 0.0, negative=True),
    ])
    assert s.p_raw <= CAPS["mimicry_suspected"]
    assert s.cap_applied == 0.30
    assert any(n["name"] == "mimicry_suspected" for n in s.negatives)


def test_analyst_reject_outranks_the_model():
    s = score("r", DECK_EXAMPLE, analyst_verdict="reject")
    assert s.p_raw <= 0.10


def test_conflicting_pgp_caps_hardest():
    s = score("c", DECK_EXAMPLE + [
        Signal("identity_key", "conflicting_pgp", 0.0, negative=True)])
    assert s.p_raw <= 0.25


def test_exchange_wallet_drops_the_financial_root_entirely():
    """A mixer address is shared by thousands. A weak version of a fact that
    is not a fact is still not a fact."""
    s = score("e", [
        Signal("financial", "shared_wallet", 0.95),
        Signal("identity_key", "pgp", 0.8),
        Signal("financial", "exchange_wallet", 0.0, negative=True),
    ])
    assert "financial" not in s.roots_used
    assert "financial" in s.trail["dropped_roots"]


# --------------------------------------------------------------------------
# Numerical safety - D3.2 objective 3
# --------------------------------------------------------------------------


@pytest.mark.parametrize("s_val", [0.0, 1.0, 1e-12, 1 - 1e-12, 0.5])
def test_probability_stays_in_the_open_interval(s_val):
    p = score("x", [Signal("infra", "sig", s_val)]).p_raw
    assert 0.0 < p < 1.0
    assert not math.isnan(p)


def test_many_strong_signals_never_reach_one():
    s = score("x", [Signal(r, f"sig_{r}", 0.999) for r in ROOTS])
    assert s.p_raw < 1.0
    assert s.p_raw <= S_MAX


def test_no_signals_gives_the_prior():
    s = score("x", [], blocked=True)
    assert s.p_raw == pytest.approx(0.1 / 1.1, abs=1e-6)


def test_unblocked_prior_is_far_lower():
    a = score("a", DECK_EXAMPLE, blocked=True)
    b = score("b", DECK_EXAMPLE, blocked=False)
    assert b.p_raw < a.p_raw


# --------------------------------------------------------------------------
# Calibration
# --------------------------------------------------------------------------


def test_brier_and_ece_are_sane():
    probs = [0.1, 0.2, 0.8, 0.9]
    labels = [0, 0, 1, 1]
    assert 0.0 <= C.brier_score(probs, labels) <= 0.25
    ece, bins = C.expected_calibration_error(probs, labels)
    assert 0.0 <= ece <= 1.0
    assert sum(b["n"] for b in bins) == len(probs)


def test_perfect_predictions_score_zero_brier():
    assert C.brier_score([0.0, 1.0], [0, 1]) == 0.0


# --------------------------------------------------------------------------
# Conformal guarantee - the defensible claim
# --------------------------------------------------------------------------


@pytest.fixture(scope="module")
def rows():
    return E.thresholds((0.01, 0.02, 0.05, 0.10, 0.20))


def test_guarantee_holds_at_every_alpha(rows):
    for r in rows:
        assert r["guarantee_holds"], r
        assert r["empirical_false_merge_rate"] <= r["alpha"] + 1e-9


def test_lower_alpha_gives_higher_tau(rows):
    taus = [r["tau"] for r in rows]
    assert taus == sorted(taus, reverse=True)


def test_lower_alpha_accepts_fewer_links(rows):
    accepted = [r["accepted"] for r in rows]
    assert accepted == sorted(accepted)


def test_conformal_handles_ties():
    """Regression. Isotonic outputs are piecewise constant, so the quantile can
    land inside a block of identical scores; taking that value admits the whole
    block. Measured false-merge rate was 25.2% at alpha=0.05 -- a guarantee
    that does not hold is worse than none."""
    probs = [0.5] * 100 + [0.9] * 5
    labels = [0] * 100 + [1] * 5
    t = C.conformal_threshold(probs, labels, 0.05)
    assert t.guarantee_holds
    assert t.empirical_false_merge_rate <= 0.05


def test_no_negatives_is_reported_not_faked():
    t = C.conformal_threshold([0.9, 0.8], [1, 1], 0.05)
    assert t.guarantee_holds is False
    assert "cannot bound" in t.detail


# --------------------------------------------------------------------------
# End to end over the testbed
# --------------------------------------------------------------------------


@pytest.fixture(scope="module")
def result():
    return E.evaluate(0.05)


def test_decoy_scores_at_or_below_030(result):
    """The acceptance criterion, and the case a defence lawyer builds."""
    d = result["decoy"]
    assert d is not None
    assert d["p_raw"] <= 0.30


def test_decoy_lists_its_negative(result):
    assert "mimicry_suspected" in result["decoy"]["negatives"]


def test_rebrand_is_recoverable_without_a_hard_identifier(result):
    """It shares no PGP and no wallet address -- only lineage, style and
    timing. If fusion cannot surface it, Phases 5 and 6 were pointless."""
    r = result["rebrand"]
    assert set(r["roots"]) >= {"financial", "linguistic", "temporal"}
    assert "identity_key" not in r["roots"]
    assert r["p_raw"] > 0.1


def test_precision_and_guarantee_on_the_testbed(result):
    assert result["guarantee_holds"] is True
    assert result["false_merge_rate"] <= result["alpha"]
    assert result["precision"] >= 0.9


def test_calibration_is_good(result):
    assert result["brier"] < 0.05
    assert result["ece"] < 0.05


def test_evaluate_is_idempotent():
    """A metric that moves when nothing changed is not a measurement."""
    a = E.evaluate(0.05)
    b = E.evaluate(0.05)
    assert a == b


def test_every_scored_pair_has_a_reproducible_trail():
    ds = E.build_signals()
    for ps in ds.scores[:300]:
        assert reproduce_from_trail(ps.trail) == ps.p_raw
