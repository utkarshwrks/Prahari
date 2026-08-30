"""Calibration and the conformal false-merge guarantee.

Two different claims, and the difference matters:

  CALIBRATION says "when we output 0.84, it is right about 84% of the time."
  Measured by Brier score and Expected Calibration Error. Isotonic regression
  fits the mapping from raw score to observed frequency.

  CONFORMAL PREDICTION says "among links we accept at threshold tau, at most
  alpha are wrong." That is a distribution-free finite-sample guarantee, not a
  hope. It makes no assumption about the score being well-behaved -- only that
  the validation split is exchangeable with what comes next.

The second is the defensible one, and it is why PRAHARI can publish a
false-merge rate at all. A team that shows a graph and a confidence number
cannot say what happens when they are wrong. This can.

Split-conformal, concretely: sort the calibration scores of the KNOWN NEGATIVE
pairs, and pick tau at the (1-alpha) quantile. By construction, at most an
alpha fraction of negatives sit above it, so the false-merge rate among
accepted links is bounded by alpha with finite-sample coverage.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field


@dataclass
class Calibration:
    fitted: bool
    engine: str
    brier: float | None = None
    ece: float | None = None
    n_train: int = 0
    n_val: int = 0
    bins: list[dict] = field(default_factory=list)
    detail: str | None = None

    def as_dict(self) -> dict:
        return self.__dict__.copy()


@dataclass
class ConformalThreshold:
    alpha: float
    tau: float
    n_calibration: int
    n_negatives: int
    empirical_false_merge_rate: float
    guarantee_holds: bool
    accepted: int = 0
    detail: str = ""

    def as_dict(self) -> dict:
        return self.__dict__.copy()


# --------------------------------------------------------------------------
# Calibration
# --------------------------------------------------------------------------


def brier_score(probs: list[float], labels: list[int]) -> float:
    """Mean squared error of probability against outcome. 0.25 = coin flip."""
    if not probs:
        return float("nan")
    return sum((p - y) ** 2 for p, y in zip(probs, labels)) / len(probs)


def expected_calibration_error(
    probs: list[float], labels: list[int], n_bins: int = 10
) -> tuple[float, list[dict]]:
    """ECE over equal-width bins, with the bin table so the claim is auditable.

    ECE is the average gap between stated confidence and observed accuracy. It
    is the number that answers "does 0.84 actually mean 84%".
    """
    if not probs:
        return float("nan"), []

    bins: list[dict] = []
    total = len(probs)
    ece = 0.0
    for i in range(n_bins):
        lo, hi = i / n_bins, (i + 1) / n_bins
        idx = [j for j, p in enumerate(probs)
               if (p > lo or (i == 0 and p >= lo)) and p <= hi]
        if not idx:
            bins.append({"bin": f"({lo:.1f},{hi:.1f}]", "n": 0,
                         "mean_confidence": None, "observed_accuracy": None, "gap": None})
            continue
        conf = sum(probs[j] for j in idx) / len(idx)
        acc = sum(labels[j] for j in idx) / len(idx)
        gap = abs(conf - acc)
        ece += (len(idx) / total) * gap
        bins.append({
            "bin": f"({lo:.1f},{hi:.1f}]", "n": len(idx),
            "mean_confidence": round(conf, 4),
            "observed_accuracy": round(acc, 4),
            "gap": round(gap, 4),
        })
    return ece, bins


_ISO = None


def fit(
    train_probs: list[float], train_labels: list[int],
    val_probs: list[float], val_labels: list[int],
    seed: int = 42,
) -> Calibration:
    """Isotonic regression on train, evaluated on the held-out split."""
    global _ISO
    if len(set(train_labels)) < 2 or len(train_probs) < 20:
        return Calibration(False, "identity", detail="insufficient labelled pairs")

    try:
        from sklearn.isotonic import IsotonicRegression
    except Exception as exc:  # noqa: BLE001
        return Calibration(False, "identity", detail=f"sklearn absent: {type(exc).__name__}")

    iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
    iso.fit(train_probs, train_labels)
    _ISO = iso

    cal = [float(x) for x in iso.predict(val_probs)]
    ece, bins = expected_calibration_error(cal, val_labels)
    return Calibration(
        fitted=True, engine="isotonic",
        brier=round(brier_score(cal, val_labels), 6),
        ece=round(ece, 6),
        n_train=len(train_probs), n_val=len(val_probs),
        bins=bins,
    )


def apply(p: float) -> float:
    """Map a raw score through the fitted calibrator. Identity if unfitted."""
    if _ISO is None:
        return p
    try:
        return float(_ISO.predict([p])[0])
    except Exception:  # noqa: BLE001
        return p


def reset() -> None:
    global _ISO
    _ISO = None


# --------------------------------------------------------------------------
# Conformal guarantee
# --------------------------------------------------------------------------


def conformal_threshold(
    cal_probs: list[float], cal_labels: list[int], alpha: float = 0.05
) -> ConformalThreshold:
    """Smallest tau such that the false-merge rate above it is bounded by alpha.

    Split-conformal over the NEGATIVE calibration pairs: tau is their
    (1-alpha) quantile with the finite-sample correction ceil((n+1)(1-alpha)).
    At most an alpha fraction of negatives can then exceed tau.

    Lower alpha must give a HIGHER tau and fewer accepted links. If it ever
    does not, the guarantee is broken and the number is worthless.
    """
    negatives = sorted(p for p, y in zip(cal_probs, cal_labels) if y == 0)
    n = len(negatives)
    if n == 0:
        return ConformalThreshold(alpha, 1.0, len(cal_probs), 0, 0.0, False,
                                  detail="No negative calibration pairs; cannot bound the rate.")

    # Finite-sample quantile index. The +1 is what makes the guarantee hold for
    # a finite calibration set rather than only asymptotically.
    k = math.ceil((n + 1) * (1 - alpha))
    tau = 1.0 if k > n else negatives[k - 1]

    # TIES. Isotonic regression outputs are piecewise constant, so calibrated
    # scores clump into steps and the quantile can land inside a block of
    # identical values. Taking that value as tau admits the WHOLE block, which
    # silently broke the guarantee: measured false-merge rate 25.2% at
    # alpha = 0.05. A guarantee that does not hold is worse than none, because
    # it is stated with confidence.
    #
    # Walk tau up to the next distinct value until the bound is actually met.
    distinct = sorted(set(negatives))
    above = sum(1 for p in negatives if p >= tau)
    if above / n > alpha:
        for cand in distinct:
            if cand <= tau:
                continue
            cnt = sum(1 for p in negatives if p >= cand)
            if cnt / n <= alpha:
                tau = cand
                above = cnt
                break
        else:
            # No threshold below 1.0 can bound the rate; say so rather than
            # returning a tau that does not deliver what it promises.
            tau, above = 1.0, sum(1 for p in negatives if p >= 1.0)

    fmr = above / n
    accepted = sum(1 for p in cal_probs if p >= tau)

    return ConformalThreshold(
        alpha=alpha,
        tau=round(float(tau), 6),
        n_calibration=len(cal_probs),
        n_negatives=n,
        empirical_false_merge_rate=round(fmr, 6),
        guarantee_holds=fmr <= alpha + 1e-9,
        accepted=accepted,
        detail=(f"At p >= {tau:.4f}, at most {alpha:.0%} of accepted links are "
                f"expected to be false merges (measured {fmr:.2%} on calibration)."),
    )
