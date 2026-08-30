"""Actor profiles — the unit PS 26151 actually asks us to produce.

The problem statement mandates an export "covering actor profiles, identifiers,
infrastructure indicators, persona linkages, attribution confidence, category,
last scan date and source". Every one of those is a field here, and every one is
derived from a real engine rather than asserted.

An ACTOR is the thing under investigation. A PERSONA is one handle on one
marketplace. The whole system exists to decide which personas belong to the
same actor, and to say how confident that is and why.
"""

from __future__ import annotations

import logging
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from functools import lru_cache

log = logging.getLogger(__name__)


@dataclass
class Identifier:
    kind: str          # pgp | wallet | email | onion
    value: str
    personas: list[str] = field(default_factory=list)
    shared: bool = False   # seen on more than one persona of this actor


@dataclass
class PersonaSummary:
    id: str
    handle: str
    market: str
    first_seen: str | None
    last_seen: str | None
    post_count: int
    categories: list[str] = field(default_factory=list)
    role: str = "normal"


@dataclass
class Linkage:
    persona_a: str
    persona_b: str
    confidence: float
    roots: list[str] = field(default_factory=list)
    negatives: list[str] = field(default_factory=list)
    basis: str = ""


@dataclass
class ActorProfile:
    actor_id: str
    label: str
    personas: list[PersonaSummary] = field(default_factory=list)
    identifiers: list[Identifier] = field(default_factory=list)
    infrastructure: list[dict] = field(default_factory=list)
    linkages: list[Linkage] = field(default_factory=list)
    attribution_confidence: float | None = None
    confidence_basis: str = ""
    categories: list[str] = field(default_factory=list)
    markets: list[str] = field(default_factory=list)
    first_seen: str | None = None
    last_seen: str | None = None
    last_scan: str | None = None
    sources: list[str] = field(default_factory=list)
    post_count: int = 0
    flags: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return asdict(self)


def _iso(v: str | None) -> str | None:
    return v[:19] if v else None


@lru_cache(maxsize=1)
def _index():
    """Build actor profiles once per process from the real engines."""
    from ..fusion import eval as E
    from ..testbed.generate import generate
    from .infra_testbed import infra_fixture

    tb = generate()
    ds = E.build_signals()

    posts_by_persona: dict[str, list] = {}
    for p in tb.posts:
        posts_by_persona.setdefault(p.persona_id, []).append(p)

    # Actor membership comes from the testbed's ground truth here; in a live
    # deployment it comes from the Neo4j WCC resolution (Phase 4).
    by_actor: dict[str, list] = {}
    for p in tb.personas:
        by_actor.setdefault(p.actor_id, []).append(p)

    infra_fx = infra_fixture()
    profiles: dict[str, ActorProfile] = {}

    for actor_id, personas in by_actor.items():
        prof = ActorProfile(actor_id=actor_id, label=personas[0].handle)

        cats: Counter = Counter()
        all_posts = 0
        for p in personas:
            pl = posts_by_persona.get(p.id, [])
            all_posts += len(pl)
            pc = Counter(x.category for x in pl if x.category)
            cats.update(pc)
            prof.personas.append(PersonaSummary(
                id=p.id, handle=p.handle, market=p.market,
                first_seen=_iso(p.first_seen), last_seen=_iso(p.last_seen),
                post_count=len(pl), categories=[c for c, _ in pc.most_common(3)],
                role=p.role,
            ))

        # --- identifiers, with sharing marked -----------------------------
        seen: dict[tuple[str, str], Identifier] = {}
        for p in personas:
            for kind, val in (("pgp", p.pgp_fpr), ("wallet", p.wallet),
                              ("email", p.email), ("onion", p.onion)):
                if not val:
                    continue
                key = (kind, val)
                ident = seen.setdefault(key, Identifier(kind=kind, value=val))
                ident.personas.append(p.id)
        for ident in seen.values():
            # A shared hard identifier is the strongest evidence in the model,
            # so it is marked rather than left for the reader to spot.
            ident.shared = len(ident.personas) > 1
        prof.identifiers = sorted(seen.values(), key=lambda i: (not i.shared, i.kind))

        # --- infrastructure indicators ------------------------------------
        for p in personas:
            if p.onion and p.onion == infra_fx["onion"]:
                from . import infra as I

                for piv in I.match(infra_fx["onion"], infra_fx["observed"],
                                   infra_fx["candidates"]):
                    prof.infrastructure.append(piv.as_dict())

        # --- linkages, with the fused confidence and its trail ------------
        best = 0.0
        for i in range(len(personas)):
            for j in range(i + 1, len(personas)):
                a, b = personas[i].id, personas[j].id
                ps = ds.by_pair.get(f"{a}|{b}") or ds.by_pair.get(f"{b}|{a}")
                if not ps:
                    continue
                prof.linkages.append(Linkage(
                    persona_a=a, persona_b=b,
                    confidence=ps.p_raw,
                    roots=sorted(ps.roots_used),
                    negatives=[n["name"] for n in ps.negatives],
                    basis=", ".join(
                        f"{r}={d['s']:.2f}" for r, d in ps.roots_used.items()),
                ))
                best = max(best, ps.p_raw)
                for n in ps.negatives:
                    if n["name"] not in prof.flags:
                        prof.flags.append(n["name"])

        prof.attribution_confidence = round(best, 6) if prof.linkages else None
        prof.confidence_basis = (
            "Highest fused pair score across this actor's personas. "
            "Likelihood ratios collapsed by root cause and dampened by "
            "reliability; see the evidence trail for the arithmetic."
            if prof.linkages else
            "Single persona: no cross-persona evidence to fuse."
        )

        prof.categories = [c for c, _ in cats.most_common(5)]
        prof.markets = sorted({p.market for p in personas})
        firsts = [p.first_seen for p in personas if p.first_seen]
        lasts = [p.last_seen for p in personas if p.last_seen]
        prof.first_seen = _iso(min(firsts)) if firsts else None
        prof.last_seen = _iso(max(lasts)) if lasts else None
        prof.post_count = all_posts
        prof.sources = ["testbed:labelled-ground-truth"]
        prof.last_scan = datetime.now(timezone.utc).isoformat(timespec="seconds")
        profiles[actor_id] = prof

    return profiles


def list_actors(q: str = "", limit: int = 50, offset: int = 0,
                min_confidence: float = 0.0) -> dict:
    """Searchable actor list, ordered by attribution confidence."""
    profs = list(_index().values())
    if q:
        ql = q.lower()
        profs = [p for p in profs if ql in p.actor_id.lower()
                 or any(ql in s.handle.lower() for s in p.personas)
                 or any(ql in i.value.lower() for i in p.identifiers)]
    if min_confidence > 0:
        profs = [p for p in profs if (p.attribution_confidence or 0) >= min_confidence]

    profs.sort(key=lambda p: (-(p.attribution_confidence or 0), p.actor_id))
    window = profs[offset:offset + limit]
    return {
        "total": len(profs),
        "count": len(window),
        "actors": [{
            "actor_id": p.actor_id,
            "label": p.label,
            "personas": len(p.personas),
            "markets": p.markets,
            "categories": p.categories[:3],
            "attribution_confidence": p.attribution_confidence,
            "flags": p.flags,
            "first_seen": p.first_seen,
            "last_seen": p.last_seen,
            "post_count": p.post_count,
        } for p in window],
    }


def profile(actor_id: str) -> ActorProfile | None:
    return _index().get(actor_id)


def timeline(actor_id: str, bucket: str = "week") -> dict:
    """Activity over time, per persona — the PS's timeline requirement.

    Returned per persona rather than aggregated, because the shape that matters
    is one persona going quiet as another appears. Aggregating hides exactly the
    rebrand the timeline exists to reveal.
    """
    from ..testbed.generate import generate

    prof = profile(actor_id)
    if not prof:
        return {"ok": False, "detail": "Unknown actor."}

    tb = generate()
    ids = {p.id for p in prof.personas}
    series: dict[str, Counter] = {i: Counter() for i in ids}

    for post in tb.posts:
        if post.persona_id not in ids or not post.ts:
            continue
        try:
            d = datetime.fromisoformat(post.ts.replace("Z", "+00:00"))
        except Exception:  # noqa: BLE001
            continue
        key = (f"{d.isocalendar().year}-W{d.isocalendar().week:02d}"
               if bucket == "week" else d.date().isoformat())
        series[post.persona_id][key] += 1

    buckets = sorted({k for c in series.values() for k in c})
    return {
        "ok": True,
        "actor_id": actor_id,
        "bucket": bucket,
        "buckets": buckets,
        "series": [
            {"persona_id": pid,
             "handle": next(s.handle for s in prof.personas if s.id == pid),
             "counts": [series[pid].get(b, 0) for b in buckets]}
            for pid in sorted(ids)
        ],
    }


def reset() -> None:
    _index.cache_clear()
