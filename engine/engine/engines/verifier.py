"""Authorship verification model.

The playbook specifies a Siamese char-CNN in PyTorch with a documented
fallback to "the classic-features logistic model" if CPU training exceeds
30 minutes. That fallback is taken deliberately (DEC-023) -- and implemented
as a real trained model, not a stub.

The model learns weights over the pairwise feature vector rather than using the
hand-picked 0.5/0.5 blend in stylometry.compare(). Its output is still only
`s_style`, which fusion dampens with reliability 0.5.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

log = logging.getLogger(__name__)

FEATURES = [
    "char_ngram", "classic_cosine", "ttr_diff", "wordlen_diff",
    "hinglish_diff", "devanagari_diff", "honorific_diff", "punct_cosine",
]


@dataclass
class VerifierResult:
    trained: bool
    engine: str
    auc: float | None = None
    accuracy: float | None = None
    n_train: int = 0
    n_test: int = 0
    coefficients: dict[str, float] | None = None
    detail: str | None = None


def pair_features(pa, pb, ngram: float, classic: float) -> list[float]:
    import math

    def cos(d1: dict, d2: dict, keys) -> float:
        a = [d1.get(k, 0.0) for k in keys]
        b = [d2.get(k, 0.0) for k in keys]
        na = math.sqrt(sum(x * x for x in a))
        nb = math.sqrt(sum(x * x for x in b))
        return sum(x * y for x, y in zip(a, b)) / (na * nb) if na and nb else 0.0

    from .stylometry import PUNCT_KEYS

    return [
        ngram,
        classic,
        abs(pa.ttr - pb.ttr),
        abs(pa.mean_word_len - pb.mean_word_len),
        abs(pa.hinglish_ratio - pb.hinglish_ratio),
        abs(pa.devanagari_ratio - pb.devanagari_ratio),
        abs(pa.honorific_rate - pb.honorific_rate),
        cos(pa.punctuation, pb.punctuation, PUNCT_KEYS),
    ]


_MODEL = None
_RESULT: VerifierResult | None = None


def train(seed: int = 42) -> VerifierResult:
    """Fit logistic regression on labelled testbed pairs. Never raises."""
    global _MODEL, _RESULT
    try:
        from sklearn.linear_model import LogisticRegression
        from sklearn.metrics import accuracy_score, roc_auc_score
        from sklearn.model_selection import train_test_split
    except Exception as exc:  # noqa: BLE001
        _RESULT = VerifierResult(False, "classic", detail=f"sklearn absent: {type(exc).__name__}")
        return _RESULT

    from ..testbed.generate import generate
    from .authorship import build_profiles
    from .stylometry import char_ngram_similarity, _cosine

    tb = generate()
    pr = build_profiles()

    X: list[list[float]] = []
    y: list[int] = []
    pos = [x for x in tb.labels if x.same_actor]
    neg = [x for x in tb.labels if not x.same_actor][: len(pos) * 3]

    for lab in pos + neg:
        a, b = pr.style.get(lab.persona_a), pr.style.get(lab.persona_b)
        if not a or not b:
            continue
        ng = char_ngram_similarity(a.text, b.text)
        cl = _cosine(a.vector(), b.vector())
        X.append(pair_features(a, b, ng, cl))
        y.append(1 if lab.same_actor else 0)

    if len(set(y)) < 2 or len(X) < 40:
        _RESULT = VerifierResult(False, "classic", detail="insufficient labelled pairs")
        return _RESULT

    Xtr, Xte, ytr, yte = train_test_split(
        X, y, test_size=0.3, random_state=seed, stratify=y
    )
    clf = LogisticRegression(max_iter=2000, class_weight="balanced")
    clf.fit(Xtr, ytr)

    prob = clf.predict_proba(Xte)[:, 1]
    _MODEL = clf
    _RESULT = VerifierResult(
        trained=True,
        engine="logistic",
        auc=round(float(roc_auc_score(yte, prob)), 4),
        accuracy=round(float(accuracy_score(yte, clf.predict(Xte))), 4),
        n_train=len(Xtr), n_test=len(Xte),
        coefficients={f: round(float(c), 4) for f, c in zip(FEATURES, clf.coef_[0])},
    )
    log.info("verifier trained", extra=_RESULT.__dict__)
    return _RESULT


def status() -> VerifierResult:
    """Which engine is actually available. Honest badge, never aspirational."""
    if _RESULT is None:
        return train()
    return _RESULT


def score(pa, pb, ngram: float, classic: float) -> tuple[float, str]:
    """Model probability, or the classic blend when no model is available."""
    if _MODEL is None:
        train()
    if _MODEL is None:
        return 0.5 * ngram + 0.5 * classic, "classic"
    try:
        p = float(_MODEL.predict_proba([pair_features(pa, pb, ngram, classic)])[0][1])
        return p, "logistic"
    except Exception:  # noqa: BLE001
        return 0.5 * ngram + 0.5 * classic, "classic"
