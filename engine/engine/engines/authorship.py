"""Pair scoring across style + behaviour, and rebrand detection.

This is where Phase 5's two cases invert relative to Phase 4:
  - the DECOY scored low in linkage (no shared identifier) but will score HIGH
    on style, because it copied its target. mimicry_suspected must catch it.
  - the REBRAND pair was invisible to linkage (distinct wallets) but should
    become visible here, on style plus a death/birth gap plus wallet lineage.
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime
from functools import lru_cache

from ..testbed.generate import generate
from . import behaviour as B
from . import stylometry as S

log = logging.getLogger(__name__)


@dataclass
class Profiles:
    style: dict[str, S.StyleProfile]
    behav: dict[str, B.BehaviourProfile]
    timestamps: dict[str, list[str]]
    # Reference distribution for the relative LLM-rewrite detector.
    burstiness: list[float] = field(default_factory=list)


@lru_cache(maxsize=1)
def build_profiles() -> Profiles:
    tb = generate()
    texts: dict[str, list[str]] = {}
    stamps: dict[str, list[str]] = {}
    for post in tb.posts:
        texts.setdefault(post.persona_id, []).append(f"{post.title} {post.body}")
        stamps.setdefault(post.persona_id, []).append(post.ts)

    bios = {p.id: (p.bio or "") for p in tb.personas}

    style = {pid: S.profile(pid, t, bio=bios.get(pid, ""))
             for pid, t in texts.items()}
    burst = [b for b in (S.burstiness(p.text) for p in style.values()) if b is not None]

    return Profiles(
        style=style,
        behav={pid: B.profile(pid, s) for pid, s in stamps.items()},
        timestamps=stamps,
        burstiness=burst,
    )


def compare_pair(a: str, b: str) -> dict:
    pr = build_profiles()
    if a not in pr.style or b not in pr.style:
        return {"ok": False, "detail": "Unknown persona."}
    st = S.compare(pr.style[a], pr.style[b], pr.burstiness)
    bh = B.compare(pr.behav.get(a, B.BehaviourProfile(a, 0)),
                   pr.behav.get(b, B.BehaviourProfile(b, 0)))
    return {"ok": True, "style": st.as_dict(), "behaviour": bh.as_dict()}


# --------------------------------------------------------------------------


@dataclass
class Rebrand:
    persona_before: str
    persona_after: str
    death_date: str
    birth_date: str
    gap_days: int
    s_style: float
    wallet_lineage: bool
    score: float
    reasons: list[str] = field(default_factory=list)


def rebrand_candidates(max_gap_days: int = 30, min_style: float = 0.75) -> list[dict]:
    """A persona goes dark; another appears soon after writing the same way.

    Requires ALL of: a death/birth ordering, a gap under K days, and style
    similarity above threshold. Wallet lineage is scored as corroboration but
    is not required -- an actor who rotates wallets entirely should still be
    catchable on rhythm and prose.
    """
    tb = generate()
    pr = build_profiles()
    out: list[Rebrand] = []

    def d(x: str | None) -> datetime | None:
        try:
            return datetime.fromisoformat(str(x).replace("Z", "+00:00"))
        except Exception:  # noqa: BLE001
            return None

    lineage = {p.wallet: p.wallet_lineage_to for p in tb.personas
               if getattr(p, "wallet_lineage_to", None)}

    for a in tb.personas:
        a_last = d(a.last_seen)
        if not a_last:
            continue
        for b in tb.personas:
            if a.id == b.id:
                continue
            b_first = d(b.first_seen)
            if not b_first or b_first <= a_last:
                continue
            gap = (b_first - a_last).days
            if gap > max_gap_days:
                continue

            st = S.compare(pr.style[a.id], pr.style[b.id], pr.burstiness) if (
                a.id in pr.style and b.id in pr.style) else None
            if st is None or st.s_style < min_style:
                continue

            reasons = [f"death {a.last_seen[:10]} -> birth {b.first_seen[:10]} ({gap}d)",
                       f"style cosine {st.s_style:.3f}"]
            lin = lineage.get(a.wallet) == b.wallet and b.wallet is not None
            score = st.s_style
            if lin:
                reasons.append("wallet lineage edge")
                score = min(0.99, score + 0.15)
            if st.flags:
                reasons.append("flags: " + ",".join(st.flags))

            out.append(Rebrand(a.id, b.id, a.last_seen[:10], b.first_seen[:10],
                               gap, st.s_style, lin, round(score, 4), reasons))

    out.sort(key=lambda r: -r.score)
    return [asdict(r) for r in out]
