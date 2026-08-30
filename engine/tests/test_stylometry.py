"""Stylometry, behaviour, counter-deception and rebrand detection.

The assertion this phase exists to make, and the inversion of Phase 4:
the DECOY -- invisible to linkage because it shares no identifier -- scores
HIGH on raw style similarity because it copied its target. Counter-deception
must catch it, while the REBRAND pair, also invisible to linkage, must become
visible here.
"""

from __future__ import annotations

import statistics as st

import pytest

from engine.engines import behaviour as B
from engine.engines import stylometry as S
from engine.engines import verifier as V
from engine.engines.authorship import build_profiles, rebrand_candidates
from engine.testbed.generate import generate


@pytest.fixture(scope="module")
def ctx():
    build_profiles.cache_clear()
    return generate(), build_profiles()


def _cmp(pr, a, b):
    return S.compare(pr.style[a], pr.style[b], pr.burstiness)


# --------------------------------------------------------------------------
# Separation
# --------------------------------------------------------------------------


def test_true_pairs_score_higher_than_unrelated(ctx):
    tb, pr = ctx
    true = [_cmp(pr, x.persona_a, x.persona_b).s_style
            for x in tb.labels if x.same_actor]
    unrel = [_cmp(pr, x.persona_a, x.persona_b).s_style
             for x in tb.labels if x.case == "unrelated"][:300]
    assert st.mean(true) > st.mean(unrel)


def test_s_style_is_a_probability(ctx):
    tb, pr = ctx
    for x in tb.labels[:200]:
        s = _cmp(pr, x.persona_a, x.persona_b).s_style
        assert 0.0 <= s <= 1.0
        assert s == s  # not NaN


# --------------------------------------------------------------------------
# Counter-deception - the decoy
# --------------------------------------------------------------------------


def test_decoy_triggers_mimicry_suspected(ctx):
    """DEC-025. Applied to the full corpus instead of bios, this failed: the
    decoy scored 0.914 -- higher than genuine pairs -- with no flag."""
    tb, pr = ctx
    lab = next(x for x in tb.labels if x.case == "decoy")
    c = _cmp(pr, lab.persona_a, lab.persona_b)
    assert "mimicry_suspected" in c.flags


def test_decoy_style_is_capped(ctx):
    tb, pr = ctx
    lab = next(x for x in tb.labels if x.case == "decoy")
    c = _cmp(pr, lab.persona_a, lab.persona_b)
    assert c.cap == 0.2
    assert c.s_style <= 0.2


def test_decoy_raw_similarity_is_genuinely_high(ctx):
    """The cap is the system recognising imitation, not failing to see it.
    If raw similarity were low the test would prove nothing."""
    tb, pr = ctx
    lab = next(x for x in tb.labels if x.case == "decoy")
    assert _cmp(pr, lab.persona_a, lab.persona_b).char_ngram > 0.7


def test_decoy_scores_below_the_rebrand_pair(ctx):
    """The Phase 5 inversion: both are invisible to linkage, and style must
    separate them in the right direction."""
    tb, pr = ctx
    d = next(x for x in tb.labels if x.case == "decoy")
    r = next(x for x in tb.labels if x.case == "rebrand")
    assert _cmp(pr, d.persona_a, d.persona_b).s_style < _cmp(pr, r.persona_a, r.persona_b).s_style


def test_mimicry_needs_near_verbatim_copying(ctx):
    """Shared habits are not copying. Only a verbatim steal should flag."""
    assert S.mimicry_suspected("escrow only bulk orders welcome ships daily",
                               "escrow only bulk orders welcome ships daily")
    assert not S.mimicry_suspected("escrow only, bulk orders welcome, ships daily",
                                   "cash on meet only, small orders, weekend drops")


# --------------------------------------------------------------------------
# Counter-deception - LLM rewrite (DEC-024)
# --------------------------------------------------------------------------


def test_llm_detector_abstains_without_a_reference_corpus():
    flat = " ".join(["the vendor offers this item with escrow available now."] * 30)
    assert S.llm_rewrite_suspected(flat, None) is False
    assert S.llm_rewrite_suspected(flat, [0.2, 0.3]) is False  # corpus too small


def test_llm_detector_catches_flattened_text(ctx):
    _, pr = ctx
    flat = " ".join(["the vendor offers this item with escrow available now."] * 30)
    assert S.llm_rewrite_suspected(flat, pr.burstiness) is True


def test_llm_detector_false_positive_rate_is_low(ctx):
    """Was 206/244 (84%) with an absolute threshold. Must stay well under 10%."""
    _, pr = ctx
    fp = sum(1 for p in pr.style.values()
             if S.llm_rewrite_suspected(p.text, pr.burstiness))
    assert fp / len(pr.style) < 0.10


def test_burstiness_returns_none_on_short_text():
    assert S.burstiness("one sentence only.") is None


# --------------------------------------------------------------------------
# Behaviour
# --------------------------------------------------------------------------


def test_jensen_shannon_bounds():
    p = [0.5, 0.5, 0.0]
    assert B.jensen_shannon(p, p) == pytest.approx(0.0, abs=1e-9)
    assert B.jensen_shannon([1.0, 0.0], [0.0, 1.0]) == pytest.approx(1.0, abs=1e-6)


def test_behaviour_profiles_have_normalised_histograms(ctx):
    _, pr = ctx
    for p in list(pr.behav.values())[:20]:
        if p.n_posts:
            assert sum(p.hour_hist) == pytest.approx(1.0, abs=1e-6)
            assert sum(p.weekday_hist) == pytest.approx(1.0, abs=1e-6)


def test_behaviour_uses_ist(ctx):
    """The jurisdiction is Jabalpur; hour histograms must be local."""
    assert B.IST.utcoffset(None).total_seconds() == 5.5 * 3600


def test_behaviour_flags_thin_activity():
    a = B.profile("a", ["2026-01-01T10:00:00+00:00"])
    b = B.profile("b", ["2026-01-02T10:00:00+00:00"])
    c = B.compare(a, b)
    assert "insufficient_activity" in c.flags
    assert c.s_time <= 0.3


def test_behaviour_profile_survives_bad_timestamps():
    p = B.profile("x", ["not-a-date", "", None, "2026-01-01T10:00:00+00:00"])
    assert p.n_posts == 1


# --------------------------------------------------------------------------
# Rebrand
# --------------------------------------------------------------------------


def test_rebrand_case_is_detected(ctx):
    tb, _ = ctx
    lab = next(x for x in tb.labels if x.case == "rebrand")
    rows = rebrand_candidates()
    assert any({r["persona_before"], r["persona_after"]} ==
               {lab.persona_a, lab.persona_b} for r in rows)


def test_rebrand_reports_correct_dates(ctx):
    tb, _ = ctx
    lab = next(x for x in tb.labels if x.case == "rebrand")
    r = next(r for r in rebrand_candidates()
             if {r["persona_before"], r["persona_after"]} == {lab.persona_a, lab.persona_b})
    assert r["death_date"] == "2026-02-10"
    assert r["birth_date"] == "2026-02-15"
    assert r["gap_days"] == 5
    assert r["wallet_lineage"] is True


def test_rebrand_ordering_is_death_then_birth(ctx):
    for r in rebrand_candidates():
        assert r["death_date"] <= r["birth_date"]
        assert r["gap_days"] >= 0


def test_rebrand_respects_its_thresholds(ctx):
    assert rebrand_candidates(max_gap_days=1) == []
    assert rebrand_candidates(min_style=0.999) == []


def test_change_point_detection_finds_a_drop():
    series = [5] * 20 + [0] * 20
    assert B.change_points(series)


# --------------------------------------------------------------------------
# Verifier (DEC-023)
# --------------------------------------------------------------------------


def test_verifier_trains_and_beats_chance():
    r = V.train()
    assert r.trained
    assert r.auc is not None and r.auc > 0.6


def test_verifier_reports_its_engine_honestly():
    assert V.status().engine in {"logistic", "classic"}


def test_hinglish_is_a_load_bearing_feature():
    """DEC-023. If this stops holding, the Hinglish work is decoration."""
    r = V.train()
    w = r.coefficients
    ranked = sorted(w.items(), key=lambda kv: -abs(kv[1]))
    assert "hinglish_diff" in [k for k, _ in ranked[:3]]


def test_scoring_degrades_to_classic_without_a_model(ctx, monkeypatch):
    """Endpoints must answer with classic features when no model is available."""
    _, pr = ctx
    monkeypatch.setattr(V, "_MODEL", None)
    monkeypatch.setattr(V, "train", lambda *a, **k: V.VerifierResult(False, "classic"))
    a, b = list(pr.style.values())[:2]
    s, engine = V.score(a, b, 0.5, 0.5)
    assert engine == "classic"
    assert 0.0 <= s <= 1.0
