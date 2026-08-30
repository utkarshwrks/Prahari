"""Evidence fusion. The number the whole project is judged on.

Naive evidence stacking assumes every signal is independent. It is not, and the
consequence is not academic: five correlated signals stack to 0.999, which is a
claim of near-certainty that will not survive cross-examination.

PRAHARI does three things instead:

  1. LIKELIHOOD RATIOS.  LR = s / (1 - s). A probability is not evidence
     strength; the ratio is.

  2. ROOT-CAUSE COLLAPSE.  Signals are grouped by WHY they agree, and only the
     strongest survives per root. Two views of one certificate are one fact.
     This is the step that stops double-counting.

  3. RELIABILITY DAMPENING.  LR_root ^ r, where r reflects how much that class
     of evidence has earned. A PGP key (0.9) is not a writing style (0.5).

        LR_total   = PROD over roots of  LR_root ^ r_root
        posterior  = prior_odds x LR_total
        p          = odds / (1 + odds)

Prior odds are 1:10 for a pair that survived blocking, 1:10,000 otherwise --
being proposed as a candidate is itself weak evidence, and pretending otherwise
would smuggle in the base rate.

Every number in `trail` must recompute `p_raw` exactly. A score whose trail does
not reproduce it is a Critical finding (D3.2 objective 3).
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from typing import Iterable, Literal

Root = Literal["identity_key", "financial", "infra", "linguistic", "temporal", "social"]

ROOTS: tuple[Root, ...] = (
    "identity_key", "financial", "infra", "linguistic", "temporal", "social",
)

# Reliability exponent per root. These are the deck's values and they encode a
# claim: how much this CLASS of evidence has earned, independent of how strong
# any single instance looks.
RELIABILITY: dict[str, float] = {
    "identity_key": 0.9,   # a signing key is close to control
    "infra": 0.8,          # shared infrastructure is hard to fake
    "financial": 0.7,      # wallets are reused, but also shared and mixed
    "temporal": 0.5,       # rhythm is suggestive, not probative
    "linguistic": 0.5,     # style is imitable - see the decoy
    "social": 0.5,         # vouches and handles are cheap
}

PRIOR_ODDS_BLOCKED = 1 / 10
PRIOR_ODDS_UNBLOCKED = 1 / 10_000

# Clamp so a single signal can never assert certainty. s=1.0 gives LR=inf and a
# posterior of exactly 1.0, which is not a probability anyone should publish.
S_MIN, S_MAX = 1e-6, 1 - 1e-6


@dataclass
class Signal:
    root: Root
    name: str
    strength: float
    reliability: float | None = None
    provenance: dict | None = None
    negative: bool = False
    cap: float | None = None

    def r(self) -> float:
        return self.reliability if self.reliability is not None else RELIABILITY[self.root]

    def clamped(self) -> float:
        return min(S_MAX, max(S_MIN, float(self.strength)))

    def lr(self) -> float:
        s = self.clamped()
        return s / (1 - s)


@dataclass
class PairScore:
    pair_id: str
    p_raw: float
    p_calibrated: float | None
    roots_used: dict[str, dict]
    roots_collapsed: dict[str, list[str]]
    negatives: list[dict]
    trail: dict
    naive_stack: float
    cap_applied: float | None = None
    blocked: bool = True

    def as_dict(self) -> dict:
        return asdict(self)


# --------------------------------------------------------------------------
# Must-not-link caps
# --------------------------------------------------------------------------

CAPS = {
    # Two personas signing simultaneously with DIFFERENT keys on the same
    # platform are strong evidence of two people, whatever else agrees.
    "conflicting_pgp": 0.25,
    # A copied bio explains the linguistic agreement without any shared author.
    "mimicry_suspected": 0.30,
    # An analyst who looked and said no outranks the model.
    "analyst_reject": 0.10,
}

# A wallet tagged as an exchange or mixer is shared by thousands of people, so
# it is not evidence of shared control. The financial root is DROPPED entirely
# rather than downweighted -- a weak version of a fact that isn't a fact is
# still not a fact.
DROP_ROOT_FLAGS = {"exchange_wallet": "financial", "mixer_wallet": "financial"}


def naive_stack(signals: Iterable[Signal]) -> float:
    """The baseline PRAHARI exists to beat: noisy-OR, `1 - PROD(1 - s)`.

    Settled as DEC-003 in Phase 1. An LR-product baseline gives 0.9963 on the
    deck inputs, not 0.999, and Phase 7's acceptance test would have failed
    against the project's own documentation.
    """
    prod = 1.0
    for sig in signals:
        if sig.negative:
            continue
        prod *= 1 - sig.clamped()
    return 1 - prod


def score(
    pair_id: str,
    signals: list[Signal],
    blocked: bool = True,
    analyst_verdict: str | None = None,
) -> PairScore:
    """Fuse signals into one calibrated-ready confidence, with a full trail."""
    positives = [s for s in signals if not s.negative]
    negatives = [s for s in signals if s.negative]

    # --- flags that remove evidence before any arithmetic happens ----------
    flag_names = {s.name for s in negatives}
    dropped_roots: set[str] = set()
    for flag, root in DROP_ROOT_FLAGS.items():
        if flag in flag_names:
            dropped_roots.add(root)

    usable = [s for s in positives if s.root not in dropped_roots]

    # --- root-cause collapse: max LR per root ------------------------------
    by_root: dict[str, list[Signal]] = {}
    for s in usable:
        by_root.setdefault(s.root, []).append(s)

    roots_used: dict[str, dict] = {}
    roots_collapsed: dict[str, list[str]] = {}
    lr_total = 1.0
    factors: list[dict] = []

    for root in ROOTS:
        group = by_root.get(root)
        if not group:
            continue
        best = max(group, key=lambda x: x.lr())
        r = best.r()
        contribution = best.lr() ** r
        lr_total *= contribution

        roots_used[root] = {
            "signal": best.name,
            "s": round(best.clamped(), 6),
            "lr": round(best.lr(), 6),
            "r": r,
            "lr_pow_r": round(contribution, 6),
            "provenance": best.provenance,
        }
        # Everything discarded by the collapse, named. This is the audit trail
        # for the single most contestable step in the model.
        if len(group) > 1:
            roots_collapsed[root] = [
                f"{s.name} (s={s.clamped():.4f}, LR={s.lr():.4f})"
                for s in sorted(group, key=lambda x: -x.lr())[1:]
            ]
        factors.append({"root": root, "lr": best.lr(), "r": r, "lr_pow_r": contribution})

    prior = PRIOR_ODDS_BLOCKED if blocked else PRIOR_ODDS_UNBLOCKED
    posterior_odds = prior * lr_total
    p_raw = posterior_odds / (1 + posterior_odds)

    # --- caps --------------------------------------------------------------
    cap_applied: float | None = None
    cap_reasons: list[str] = []
    for name, ceiling in CAPS.items():
        if name in flag_names:
            cap_applied = ceiling if cap_applied is None else min(cap_applied, ceiling)
            cap_reasons.append(f"{name} -> {ceiling}")
    if analyst_verdict == "reject":
        cap_applied = CAPS["analyst_reject"] if cap_applied is None else min(
            cap_applied, CAPS["analyst_reject"])
        cap_reasons.append("analyst_reject -> 0.10")

    if cap_applied is not None:
        p_raw = min(p_raw, cap_applied)

    p_raw = min(S_MAX, max(S_MIN, p_raw))

    trail = {
        "formula": "p = odds/(1+odds), odds = prior_odds * PROD(LR_root ^ r_root)",
        "prior_odds": prior,
        "prior_label": "1:10 (blocked candidate)" if blocked else "1:10,000 (unblocked)",
        # Factors carry 12 decimal places, not 6. Rounding them to the
        # display precision made the trail recompute to 0.925596 where p_raw
        # was 0.925597 -- accumulated rounding across factors. One unit in the
        # last published place is still a published number that does not
        # reproduce, which is exactly what gets picked at under
        # cross-examination. `roots_used` stays at 6dp for reading.
        "factors": [
            {**f, "lr": round(f["lr"], 12), "lr_pow_r": round(f["lr_pow_r"], 12)}
            for f in factors
        ],
        "lr_total": round(lr_total, 6),
        "posterior_odds": round(posterior_odds, 6),
        "p_before_caps": round(posterior_odds / (1 + posterior_odds), 6),
        "caps": cap_reasons,
        "dropped_roots": sorted(dropped_roots),
        "roots_present": sorted(roots_used),
        "roots_absent": [r for r in ROOTS if r not in roots_used],
    }

    return PairScore(
        pair_id=pair_id,
        p_raw=round(p_raw, 6),
        p_calibrated=None,
        roots_used=roots_used,
        roots_collapsed=roots_collapsed,
        negatives=[
            {"name": s.name, "root": s.root, "provenance": s.provenance} for s in negatives
        ],
        trail=trail,
        naive_stack=round(naive_stack(signals), 6),
        cap_applied=cap_applied,
        blocked=blocked,
    )


def reproduce_from_trail(trail: dict) -> float:
    """Recompute p_raw from the published trail alone.

    If this ever disagrees with `p_raw`, the trail is decoration and the score
    is unfalsifiable. Asserted in tests for exactly that reason.

    Rounded to the same 6 decimal places the trail publishes: a reader can only
    reproduce a number to the precision they were given, and claiming exactness
    beyond the published digits would itself be a small dishonesty.
    """
    odds = trail["prior_odds"]
    for f in trail["factors"]:
        odds *= f["lr"] ** f["r"]
    p = odds / (1 + odds)
    for c in trail.get("caps", []):
        ceiling = float(c.rsplit("-> ", 1)[-1])
        p = min(p, ceiling)
    return round(min(S_MAX, max(S_MIN, p)), 6)


# --------------------------------------------------------------------------
# The deck example, kept next to the code it validates
# --------------------------------------------------------------------------

DECK_EXAMPLE: list[Signal] = [
    Signal("identity_key", "pgp_fingerprint_match", 0.78, 0.9),
    Signal("financial", "shared_wallet", 0.71, 0.7),
    Signal("infra", "cert_reuse", 0.83, 0.8),
    Signal("linguistic", "writing_style", 0.69, 0.5),
    Signal("temporal", "posting_rhythm", 0.74, 0.5),
]
