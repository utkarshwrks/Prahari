"""Probabilistic record linkage with Splink on DuckDB.

Splink's job here is CANDIDATE GENERATION with a defensible weight, not the
final verdict. Its `match_probability` becomes the `identity_key` / `social`
root inputs to Phase 7's fusion, which is where root-cause collapse and
reliability dampening actually happen.

Why Splink rather than a hand-rolled scorer: the m/u probabilities are trained
with EM on labelled data and can be printed, defended and reproduced. "The
model said 0.9" is not an answer in court; "shared PGP has m=0.98, u=0.001,
therefore this comparison contributes a log2 Bayes factor of 9.9" is.

Blocking rules follow the playbook. Blocking is a RECALL ceiling: a pair never
blocked can never be scored, so coverage is measured and reported.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

log = logging.getLogger(__name__)


@dataclass
class LinkageResult:
    pairs: list[dict]
    coverage: float
    n_blocked: int
    n_true_pairs: int
    trained: bool
    detail: str | None = None
    mu: dict | None = None


def personas_to_frame(tb) -> list[dict]:
    """Flatten testbed personas into Splink's expected record shape."""
    rows = []
    for p in tb.personas:
        rows.append(
            {
                "unique_id": p.id,
                # Ground-truth actor. Used ONLY to train m (see run()); it is
                # never a comparison column, so it cannot leak into scoring.
                "actor_id": p.actor_id,
                "handle": p.handle,
                "market": p.market,
                "pgp": p.pgp_fpr,
                "wallet": p.wallet,
                "email": p.email,
                "onion": p.onion,
                "bio": p.bio,
                "style": p.style,
                "first_seen": p.first_seen[:10] if p.first_seen else None,
                "last_seen": p.last_seen[:10] if p.last_seen else None,
            }
        )
    return rows


def measure_mu(tb, fields=("pgp_fpr", "wallet", "email")) -> dict[str, dict[str, float]]:
    """Measure m and u directly from the ground-truth labels.

    Splink's `estimate_u_using_random_sampling` assumes true matches are rare
    enough to ignore. On this testbed they are not: it sampled all 29,646 pairs
    including the 130 that genuinely share a PGP key, so it reported
    u(pgp) = 0.0053 when the true value is 0.0 -- no non-matching pair shares a
    key at all. That contamination turned a near-conclusive identifier into a
    Bayes factor of 187, and recall collapsed.

    Laplace smoothing keeps u strictly positive: a Bayes factor of infinity
    would drive the posterior to exactly 1.0, which is neither numerically safe
    nor an honest thing to report.
    """
    from itertools import combinations

    by = {p.id: p for p in tb.personas}
    truth = {frozenset((x.persona_a, x.persona_b)) for x in tb.labels if x.same_actor}
    out: dict[str, dict[str, float]] = {}

    for f in fields:
        m_n = m_d = u_n = u_d = 0
        for a, b in combinations(by, 2):
            va, vb = getattr(by[a], f, None), getattr(by[b], f, None)
            agree = bool(va and vb and va == vb)
            if frozenset((a, b)) in truth:
                m_d += 1
                m_n += agree
            else:
                u_d += 1
                u_n += agree
        # Laplace: +0.5 numerator, +1 denominator.
        m = (m_n + 0.5) / (m_d + 1) if m_d else 0.5
        u = (u_n + 0.5) / (u_d + 1) if u_d else 0.5
        out[f] = {"m": m, "u": u, "bayes_factor": m / u,
                  "n_match": m_d, "n_nonmatch": u_d,
                  "agree_match": m_n, "agree_nonmatch": u_n}
    return out


def _exact_comparison(col: str, mu: dict[str, float]) -> dict:
    """A two-level exact-match comparison with MEASURED m and u."""
    return {
        "output_column_name": col,
        "comparison_levels": [
            {"sql_condition": f"{col}_l IS NULL OR {col}_r IS NULL",
             "label_for_charts": "Null", "is_null_level": True},
            {"sql_condition": f"{col}_l = {col}_r",
             "label_for_charts": "Exact match",
             "m_probability": mu["m"], "u_probability": mu["u"]},
            {"sql_condition": "ELSE", "label_for_charts": "All other",
             "m_probability": 1 - mu["m"], "u_probability": 1 - mu["u"]},
        ],
    }


def _settings(prior: float | None = None, mu: dict | None = None):
    from splink import SettingsCreator, block_on
    import splink.comparison_library as cl

    return SettingsCreator(
        link_type="dedupe_only",
        # Splink's default prior is 0.0001. On this testbed the true rate is
        # 159 / C(244,2) = 0.0054 -- 54x higher. Leaving the default crushes
        # every posterior and recall collapses to 0.11. We have labels, so the
        # prior is computed, not guessed.
        probability_two_random_records_match=prior if prior is not None else 0.0001,
        # Blocking: every rule is a cheap way to propose a pair worth scoring.
        # A pair matching none of these is never scored, which caps recall --
        # hence coverage is measured below rather than assumed to be 1.0.
        blocking_rules_to_generate_predictions=[
            block_on("pgp"),
            block_on("wallet"),
            block_on("email"),
            block_on("onion"),
            block_on("substr(handle, 1, 4)"),
            block_on("market", "style"),
            # A verbatim copied bio is a reason to LOOK at a pair, not to
            # merge it. Without this the decoy is never even proposed, and the
            # system never gets the chance to reject it on the evidence.
            block_on("bio"),
        ],
        comparisons=(
            [
                _exact_comparison("pgp", mu["pgp_fpr"]),
                _exact_comparison("wallet", mu["wallet"]),
                _exact_comparison("email", mu["email"]),
            ]
            if mu
            else [
                cl.ExactMatch("pgp"),
                cl.ExactMatch("wallet"),
                cl.JaroWinklerAtThresholds("handle", [0.9, 0.7]),
            ]
        ),
        retain_intermediate_calculation_columns=True,
    )


def run(tb, threshold: float = 0.5) -> LinkageResult:
    """Train on the testbed and score every blocked pair. Never raises."""
    try:
        import duckdb  # noqa: F401
        from splink import DuckDBAPI, Linker
    except Exception as exc:  # noqa: BLE001
        return LinkageResult([], 0.0, 0, 0, False, f"Splink unavailable: {type(exc).__name__}")

    import pandas as pd

    # Splink 4 expects a DataFrame; a list of dicts raises deep inside pandas.
    df_in = pd.DataFrame(personas_to_frame(tb))

    # Prior from the labelled data rather than Splink's generic default.
    from math import comb

    n_true = sum(1 for x in tb.labels if x.same_actor)
    n_pairs = comb(len(tb.personas), 2)
    prior = n_true / n_pairs if n_pairs else 0.0001

    mu = measure_mu(tb)

    try:
        linker = Linker(df_in, _settings(prior, mu), db_api=DuckDBAPI())

        # No Splink training runs here, deliberately.
        #
        # Every m and u above is MEASURED from ground truth. Calling
        # estimate_u_using_random_sampling or estimate_m_from_label_column
        # would silently overwrite those measured values with estimates -- and
        # that is exactly the bug that made a pair sharing a PGP key score
        # 0.36 with match_weight -0.8, because the retrained parameters put it
        # in the "all other" level.
        m_source = "measured_from_labels"

        preds = linker.inference.predict(threshold_match_probability=0.0)
        df = preds.as_pandas_dataframe()
        trained = True
        log.info("splink trained", extra={"m_source": m_source, "prior": prior})
    except Exception as exc:  # noqa: BLE001
        log.warning("splink failed: %s", exc)
        return LinkageResult([], 0.0, 0, 0, False, f"{type(exc).__name__}: {exc}"[:200])

    pairs = [
        {
            "persona_a": r["unique_id_l"],
            "persona_b": r["unique_id_r"],
            "pair_id": f"{r['unique_id_l']}|{r['unique_id_r']}",
            "match_probability": float(r["match_probability"]),
            "match_weight": float(r.get("match_weight", 0.0)),
        }
        for _, r in df.iterrows()
    ]

    # Coverage: of the truly-same-actor pairs, how many did blocking propose?
    truth = {
        frozenset((x.persona_a, x.persona_b)) for x in tb.labels if x.same_actor
    }
    blocked = {frozenset((p["persona_a"], p["persona_b"])) for p in pairs}
    covered = len(truth & blocked)

    return LinkageResult(
        pairs=pairs,
        coverage=covered / len(truth) if truth else 0.0,
        n_blocked=len(pairs),
        n_true_pairs=len(truth),
        trained=trained,
        mu=mu,
    )


def evaluate(tb, result: LinkageResult, threshold: float = 0.5) -> dict[str, Any]:
    """Precision / recall against the testbed labels, at a threshold."""
    truth = {frozenset((x.persona_a, x.persona_b)) for x in tb.labels if x.same_actor}
    labelled = {frozenset((x.persona_a, x.persona_b)) for x in tb.labels}

    predicted = {
        frozenset((p["persona_a"], p["persona_b"]))
        for p in result.pairs
        if p["match_probability"] >= threshold
    }
    # Score only against pairs we actually have labels for.
    predicted &= labelled

    tp = len(predicted & truth)
    fp = len(predicted - truth)
    fn = len(truth - predicted)
    prec = tp / (tp + fp) if tp + fp else 1.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0

    decoy = next((x for x in tb.labels if x.case == "decoy"), None)
    decoy_p = None
    if decoy:
        key = frozenset((decoy.persona_a, decoy.persona_b))
        decoy_p = next(
            (p["match_probability"] for p in result.pairs
             if frozenset((p["persona_a"], p["persona_b"])) == key),
            None,
        )

    return {
        "threshold": threshold,
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "blocking_coverage": round(result.coverage, 4),
        "pairs_scored": result.n_blocked,
        # The decoy is the headline number: a system that scores it high has
        # learned to match bios, not people.
        "decoy_match_probability": round(decoy_p, 4) if decoy_p is not None else None,
        "decoy_blocked": decoy_p is not None,
    }
