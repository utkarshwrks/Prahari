"""End-to-end fusion evaluation over the testbed.

Builds real Signals from every engine built so far -- Splink linkage, shared
wallets, stylometry, behaviour, infra -- fuses them, calibrates, and computes
the metrics that go on the landing page.

    python -m engine.fusion.eval

Idempotent by construction: fixed seeds, deterministic splits, sorted output.
Running it twice must produce an identical diff, because a metric that moves
when nothing changed is not a measurement.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from . import calibrate as C
from .score import PairScore, Signal, score

log = logging.getLogger(__name__)

SEED = 42
VAL_FRACTION = 0.4


@dataclass
class Dataset:
    pair_ids: list[str]
    scores: list[PairScore]
    labels: list[int]
    by_pair: dict[str, PairScore] = field(default_factory=dict)


def _split(n: int, seed: int = SEED) -> tuple[list[int], list[int]]:
    """Deterministic train/validation split. Same seed, same split, always."""
    import random

    idx = list(range(n))
    random.Random(seed).shuffle(idx)
    cut = int(n * (1 - VAL_FRACTION))
    return sorted(idx[:cut]), sorted(idx[cut:])


@lru_cache(maxsize=1)
def build_signals() -> Dataset:
    """Assemble Signals for every labelled testbed pair from the real engines."""
    from ..engines import behaviour as B
    from ..engines import linkage as L
    from ..engines import stylometry as S
    from ..engines.authorship import build_profiles
    from ..testbed.generate import generate

    tb = generate()
    pr = build_profiles()
    by = {p.id: p for p in tb.personas}

    link = L.run(tb)
    link_p = {
        frozenset((p["persona_a"], p["persona_b"])): p["match_probability"]
        for p in link.pairs
    }
    lineage = {p.wallet: p.wallet_lineage_to for p in tb.personas
               if getattr(p, "wallet_lineage_to", None)}

    # Second candidate generator: the Phase 5 rebrand detector.
    from ..engines.authorship import rebrand_candidates

    rebrand_pairs = {
        f"{r['persona_before']}|{r['persona_after']}" for r in rebrand_candidates()
    } | {
        f"{r['persona_after']}|{r['persona_before']}" for r in rebrand_candidates()
    }

    ids: list[str] = []
    scores: list[PairScore] = []
    labels: list[int] = []

    for lab in tb.labels:
        a, b = lab.persona_a, lab.persona_b
        pa, pb = by[a], by[b]
        key = frozenset((a, b))
        sigs: list[Signal] = []

        # --- identity_key -------------------------------------------------
        if pa.pgp_fpr and pa.pgp_fpr == pb.pgp_fpr:
            sigs.append(Signal("identity_key", "pgp_fingerprint_match", 0.95,
                               provenance={"fingerprint": pa.pgp_fpr[:16] + "..."}))
        mp = link_p.get(key)
        if mp is not None and mp > 0:
            # Splink's own probability is a second view of the same root.
            # Root-cause collapse keeps only the stronger of the two.
            sigs.append(Signal("identity_key", "splink_match_probability",
                               min(0.99, max(0.01, mp)),
                               provenance={"source": "splink"}))

        # --- financial ----------------------------------------------------
        if pa.wallet and pa.wallet == pb.wallet:
            sigs.append(Signal("financial", "shared_wallet", 0.88,
                               provenance={"wallet": pa.wallet[:12] + "..."}))
        elif lineage.get(pa.wallet) == pb.wallet or lineage.get(pb.wallet) == pa.wallet:
            # Lineage is a transfer between distinct addresses: real evidence,
            # weaker than shared control.
            sigs.append(Signal("financial", "wallet_lineage", 0.62,
                               provenance={"kind": "funds_flow"}))

        # --- social -------------------------------------------------------
        if pa.email and pa.email == pb.email:
            sigs.append(Signal("social", "shared_email", 0.80))

        # --- infra --------------------------------------------------------
        if pa.onion and pa.onion == pb.onion:
            sigs.append(Signal("infra", "shared_onion", 0.90))

        # --- linguistic ---------------------------------------------------
        if a in pr.style and b in pr.style:
            st = S.compare(pr.style[a], pr.style[b], pr.burstiness)
            sigs.append(Signal("linguistic", "writing_style", st.s_style,
                               provenance={"char_ngram": st.char_ngram}))
            for f in st.flags:
                # Negative signals do not lower the score arithmetically; they
                # cap it. Mimicry EXPLAINS the agreement rather than adding to it.
                sigs.append(Signal("linguistic", f, 0.0, negative=True,
                                   provenance={"detector": f}))

        # --- temporal -----------------------------------------------------
        if a in pr.behav and b in pr.behav:
            bh = B.compare(pr.behav[a], pr.behav[b])
            sigs.append(Signal("temporal", "posting_rhythm", bh.s_time,
                               provenance={"js_hour": bh.js_hour}))

        # A pair is "blocked" -- and so earns the 1:10 prior -- if ANY
        # candidate generator proposed it, not only Splink. The rebrand pair
        # shares no hard identifier and is invisible to record linkage by
        # design, but the rebrand detector proposes it on a death/birth gap
        # plus style. Giving it the 1:10,000 unblocked prior crushed it to
        # 0.0003 and made the case unfindable by construction.
        proposed = key in link_p or lab.pair_id in rebrand_pairs
        ps = score(lab.pair_id, sigs, blocked=proposed)
        ids.append(lab.pair_id)
        scores.append(ps)
        labels.append(1 if lab.same_actor else 0)

    return Dataset(ids, scores, labels, {i: s for i, s in zip(ids, scores)})


def evaluate(alpha: float = 0.05) -> dict:
    """Fit calibration on train, measure on validation, derive tau. Never raises."""
    ds = build_signals()
    raw = [s.p_raw for s in ds.scores]
    tr, va = _split(len(raw))

    cal = C.fit([raw[i] for i in tr], [ds.labels[i] for i in tr],
                [raw[i] for i in va], [ds.labels[i] for i in va], seed=SEED)

    val_cal = [C.apply(raw[i]) for i in va]
    val_lab = [ds.labels[i] for i in va]
    thr = C.conformal_threshold(val_cal, val_lab, alpha)

    tp = sum(1 for p, y in zip(val_cal, val_lab) if p >= thr.tau and y == 1)
    fp = sum(1 for p, y in zip(val_cal, val_lab) if p >= thr.tau and y == 0)
    fn = sum(1 for p, y in zip(val_cal, val_lab) if p < thr.tau and y == 1)
    prec = tp / (tp + fp) if tp + fp else 1.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0

    decoy = next((s for i, s in zip(ds.pair_ids, ds.scores) if "decoy" in i), None)
    rebrand = next((s for i, s in zip(ds.pair_ids, ds.scores) if "rebrand" in i), None)

    return {
        "seed": SEED,
        "n_pairs": len(raw),
        "n_train": len(tr),
        "n_val": len(va),
        "alpha": alpha,
        "tau": thr.tau,
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "false_merge_rate": thr.empirical_false_merge_rate,
        "guarantee_holds": thr.guarantee_holds,
        "accepted_links": thr.accepted,
        "brier": cal.brier,
        "ece": cal.ece,
        "calibration_engine": cal.engine,
        "reliability_bins": cal.bins,
        "decoy": {
            "pair_id": decoy.pair_id, "p_raw": decoy.p_raw,
            "cap_applied": decoy.cap_applied,
            "negatives": [n["name"] for n in decoy.negatives],
        } if decoy else None,
        "rebrand": {
            "pair_id": rebrand.pair_id, "p_raw": rebrand.p_raw,
            "roots": sorted(rebrand.roots_used),
        } if rebrand else None,
    }


def ensure_calibrated() -> None:
    """Fit the calibrator if it has not been fitted in this process.

    Without this, `thresholds()` computed tau over RAW scores while
    `evaluate()` used CALIBRATED ones, so /fusion/threshold and /fusion/pair
    reported thresholds on two different scales. An analyst comparing a pair's
    score against the published tau would have been comparing different units.
    """
    if C._ISO is None:
        ds = build_signals()
        raw = [s.p_raw for s in ds.scores]
        tr, va = _split(len(raw))
        C.fit([raw[i] for i in tr], [ds.labels[i] for i in tr],
              [raw[i] for i in va], [ds.labels[i] for i in va], seed=SEED)


def thresholds(alphas=(0.01, 0.05, 0.10)) -> list[dict]:
    """tau across risk budgets, always on the CALIBRATED scale.

    Lower alpha must give a HIGHER tau and FEWER accepted links.
    """
    ensure_calibrated()
    ds = build_signals()
    raw = [s.p_raw for s in ds.scores]
    _, va = _split(len(raw))
    val_cal = [C.apply(raw[i]) for i in va]
    val_lab = [ds.labels[i] for i in va]
    return [C.conformal_threshold(val_cal, val_lab, a).as_dict() for a in alphas]


if __name__ == "__main__":  # pragma: no cover
    res = evaluate()
    out = Path("fixtures/metrics.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(res, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps({k: v for k, v in res.items() if k != "reliability_bins"}, indent=2))
