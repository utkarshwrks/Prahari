"""Behavioural profiling: when someone posts, not what they write.

Posting rhythm is harder to fake than prose. A vendor can rewrite their
listings; changing the hours they are awake is a lifestyle change. That is why
`temporal` is its own root in the fusion model rather than being folded into
`linguistic` -- the two have genuinely different causes, and collapsing them
would be exactly the double-counting the confidence model exists to prevent.

Agora carries no timestamps at all (DEC-018), so every feature here runs on the
testbed. Gwern's DNM archives are daily crawls and would supply real temporal
data; that download is deferred (DEC-019).

All histograms are in IST, because the jurisdiction is Jabalpur.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Iterable

IST = timezone(timedelta(hours=5, minutes=30))


@dataclass
class BehaviourProfile:
    persona_id: str
    n_posts: int
    hour_hist: list[float] = field(default_factory=lambda: [0.0] * 24)
    weekday_hist: list[float] = field(default_factory=lambda: [0.0] * 7)
    interval_hist: list[float] = field(default_factory=lambda: [0.0] * 8)
    mean_interval_h: float = 0.0
    active_days: int = 0
    first_ts: str | None = None
    last_ts: str | None = None

    def as_dict(self) -> dict:
        return self.__dict__.copy()


# Inter-post interval buckets, in hours. Log-ish spacing because the difference
# between 1h and 2h matters far more than between 200h and 300h.
INTERVAL_EDGES = [1, 3, 6, 12, 24, 72, 168, float("inf")]


def _norm(xs: list[float]) -> list[float]:
    t = sum(xs)
    return [x / t for x in xs] if t else xs


def profile(persona_id: str, timestamps: Iterable[str | datetime]) -> BehaviourProfile:
    """Build a behavioural profile. Never raises on malformed timestamps."""
    ts: list[datetime] = []
    for t in timestamps:
        if isinstance(t, datetime):
            ts.append(t)
            continue
        if not t:
            continue
        try:
            d = datetime.fromisoformat(str(t).replace("Z", "+00:00"))
            if d.tzinfo is None:
                d = d.replace(tzinfo=timezone.utc)
            ts.append(d)
        except Exception:  # noqa: BLE001
            continue

    p = BehaviourProfile(persona_id=persona_id, n_posts=len(ts))
    if not ts:
        return p

    ts.sort()
    local = [t.astimezone(IST) for t in ts]

    hours = [0.0] * 24
    days = [0.0] * 7
    for d in local:
        hours[d.hour] += 1
        days[d.weekday()] += 1
    p.hour_hist = _norm(hours)
    p.weekday_hist = _norm(days)

    gaps = [(ts[i] - ts[i - 1]).total_seconds() / 3600 for i in range(1, len(ts))]
    if gaps:
        p.mean_interval_h = sum(gaps) / len(gaps)
        buckets = [0.0] * len(INTERVAL_EDGES)
        for g in gaps:
            for i, edge in enumerate(INTERVAL_EDGES):
                if g <= edge:
                    buckets[i] += 1
                    break
        p.interval_hist = _norm(buckets)

    p.active_days = len({d.date() for d in local})
    p.first_ts = ts[0].isoformat()
    p.last_ts = ts[-1].isoformat()
    return p


# --------------------------------------------------------------------------
# Divergence
# --------------------------------------------------------------------------


def _kl(p: list[float], q: list[float]) -> float:
    return sum(
        pi * math.log2(pi / qi)
        for pi, qi in zip(p, q)
        if pi > 0 and qi > 0
    )


def jensen_shannon(p: list[float], q: list[float]) -> float:
    """JS distance in [0,1]. Symmetric and finite, unlike raw KL."""
    if not p or not q or len(p) != len(q):
        return 1.0
    if sum(p) == 0 or sum(q) == 0:
        return 1.0
    m = [(a + b) / 2 for a, b in zip(p, q)]
    div = 0.5 * _kl(p, m) + 0.5 * _kl(q, m)
    return max(0.0, min(1.0, math.sqrt(max(0.0, div))))


@dataclass
class BehaviourComparison:
    persona_a: str
    persona_b: str
    s_time: float
    js_hour: float
    js_weekday: float
    js_interval: float
    overlap_days: int
    flags: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return self.__dict__.copy()


def compare(pa: BehaviourProfile, pb: BehaviourProfile) -> BehaviourComparison:
    """s_time = 1 - weighted Jensen-Shannon distance.

    Hour-of-day is weighted most heavily: it is the closest proxy for the
    person's timezone and sleep cycle, which is the thing that is hard to fake.
    """
    jh = jensen_shannon(pa.hour_hist, pb.hour_hist)
    jw = jensen_shannon(pa.weekday_hist, pb.weekday_hist)
    ji = jensen_shannon(pa.interval_hist, pb.interval_hist)
    s = 1.0 - (0.6 * jh + 0.2 * jw + 0.2 * ji)

    flags: list[str] = []
    if pa.n_posts < 5 or pb.n_posts < 5:
        flags.append("insufficient_activity")
        s = min(s, 0.3)

    overlap = 0
    if pa.first_ts and pb.first_ts and pa.last_ts and pb.last_ts:
        a0, a1 = datetime.fromisoformat(pa.first_ts), datetime.fromisoformat(pa.last_ts)
        b0, b1 = datetime.fromisoformat(pb.first_ts), datetime.fromisoformat(pb.last_ts)
        lo, hi = max(a0, b0), min(a1, b1)
        overlap = max(0, (hi - lo).days)

    return BehaviourComparison(
        persona_a=pa.persona_id, persona_b=pb.persona_id,
        s_time=round(max(0.0, min(1.0, s)), 6),
        js_hour=round(jh, 6), js_weekday=round(jw, 6), js_interval=round(ji, 6),
        overlap_days=overlap, flags=flags,
    )


# --------------------------------------------------------------------------
# Rebrand detection
# --------------------------------------------------------------------------


@dataclass
class RebrandCandidate:
    persona_before: str
    persona_after: str
    death_date: str
    birth_date: str
    gap_days: int
    s_style: float
    wallet_lineage: bool
    score: float
    reasons: list[str] = field(default_factory=list)


def daily_series(pb: BehaviourProfile, timestamps: list[str]) -> list[int]:
    """Posts per day, for change-point detection."""
    from collections import Counter

    days = Counter()
    for t in timestamps:
        try:
            d = datetime.fromisoformat(str(t).replace("Z", "+00:00"))
            days[d.date()] += 1
        except Exception:  # noqa: BLE001
            continue
    if not days:
        return []
    lo, hi = min(days), max(days)
    return [days.get(lo + timedelta(days=i), 0) for i in range((hi - lo).days + 1)]


def change_points(series: list[int]) -> list[int]:
    """`ruptures` change-point detection, with a simple fallback.

    The fallback is not a stub: it finds the largest single drop in a rolling
    mean, which is what a persona going dark actually looks like.
    """
    if len(series) < 8:
        return []
    try:
        import numpy as np
        import ruptures as rpt

        algo = rpt.Pelt(model="rbf").fit(np.array(series, dtype=float).reshape(-1, 1))
        return [int(x) for x in algo.predict(pen=3)][:-1]
    except Exception:  # noqa: BLE001
        w = max(2, len(series) // 8)
        best_i, best_drop = -1, 0.0
        for i in range(w, len(series) - w):
            before = sum(series[i - w:i]) / w
            after = sum(series[i:i + w]) / w
            if before - after > best_drop:
                best_drop, best_i = before - after, i
        return [best_i] if best_i > 0 and best_drop > 0.5 else []
