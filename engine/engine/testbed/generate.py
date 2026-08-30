"""Synthetic ground truth with a fixed seed.

This is the only dataset in PRAHARI that carries LABELS, so every metric in
docs/METRICS.md comes from here -- not from Agora (DEC-018). Four cases are
injected deliberately, because each one is a claim the system must defend:

  1. MULTI-PERSONA  one actor, several handles, sharing a hard identifier.
                    Proves linkage works.
  2. REBRAND        persona A goes dark, B appears days later with the same
                    style and a wallet lineage edge. Proves temporal detection.
  3. INFRA LEAK     an onion whose TLS cert CN names a clearnet domain.
                    Proves passive infrastructure pivoting.
  4. DECOY          copies a target's bio verbatim but shares NO hard
                    identifier. Labelled must-not-link. Proves the system
                    resists the obvious false positive -- the most important
                    case of the four, because it is what a defence lawyer
                    will construct.

Text is category-level only, in English and Hinglish. Nothing here is, or
resembles, synthesis or how-to content.

Determinism is a tested guarantee: same seed -> byte-identical labels.
"""

from __future__ import annotations

import hashlib
import json
import random
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

# --------------------------------------------------------------------------
# Vocabulary. Category-level nouns only.
# --------------------------------------------------------------------------

MARKETS = ["Agora", "Evolution", "Nucleus", "AlphaBay", "Dream"]

CATEGORIES = ["Drugs", "Weapons", "Data", "Counterfeit"]

ITEMS: dict[str, list[str]] = {
    "Drugs": ["MDMA", "LSD", "mephedrone", "charas", "ketamine", "ganja"],
    "Weapons": ["pistol parts", "weapon parts", "ammunition", "air pistol"],
    "Data": ["Aadhaar records", "PAN records", "KYC data", "OTP logs", "credit-card dumps"],
    "Counterfeit": ["counterfeit currency", "fake stamp paper", "forged documents"],
}

CITIES = [
    "Jabalpur", "Katni", "Narsinghpur", "Bhopal", "Indore",
    "Gwalior", "Ujjain", "Sagar", "Rewa", "Satna",
]

# Two distinct writing styles. The stylometry engine must separate them, and
# the decoy must NOT be separable by style alone -- that is the whole point.
STYLE_A = {
    "greeting": ["Listing:", "For sale:", "Available:"],
    "connector": ["·", "-", "|"],
    "sign": ["Escrow only.", "FE for trusted.", "No exceptions."],
    "ellipsis": "...",
    "hinglish": 0.15,
}
STYLE_B = {
    "greeting": ["bhai listing", "naya stock", "fresh maal"],
    "connector": [",", " aur ", " + "],
    "sign": ["escrow chalega", "DM karo", "bhav fix hai"],
    "ellipsis": "..",
    "hinglish": 0.75,
}

HINGLISH_TOKENS = ["bhai", "bhaiya", "ji", "hai", "karo", "milega", "bhav", "maal", "jaldi"]


# --------------------------------------------------------------------------
# Records
# --------------------------------------------------------------------------


@dataclass
class TPersona:
    id: str
    actor_id: str
    market: str
    handle: str
    first_seen: str
    last_seen: str
    style: str
    pgp_fpr: str | None = None
    wallet: str | None = None
    email: str | None = None
    onion: str | None = None
    bio: str = ""
    role: str = "normal"  # normal | rebrand_before | rebrand_after | decoy | infra
    # Funds observed flowing FROM this wallet TO the named one. Lineage is a
    # transfer relationship, not an identical address -- see the rebrand case.
    wallet_lineage_to: str | None = None


@dataclass
class TPost:
    id: str
    persona_id: str
    market: str
    ts: str
    title: str
    body: str
    price: float
    category: str
    raw_pgp: str | None = None


@dataclass
class TPairLabel:
    pair_id: str
    persona_a: str
    persona_b: str
    same_actor: bool
    case: str  # multi_persona | rebrand | decoy | unrelated
    must_not_link: bool = False
    notes: str = ""


@dataclass
class Testbed:
    personas: list[TPersona] = field(default_factory=list)
    posts: list[TPost] = field(default_factory=list)
    labels: list[TPairLabel] = field(default_factory=list)
    meta: dict = field(default_factory=dict)


# --------------------------------------------------------------------------
# Deterministic helpers. Every random draw goes through `rng`.
# --------------------------------------------------------------------------


def _hex(rng: random.Random, n: int) -> str:
    return "".join(rng.choice("0123456789abcdef") for _ in range(n))


def _pgp_fpr(rng: random.Random) -> str:
    return _hex(rng, 40).upper()


def _wallet(rng: random.Random) -> str:
    return "1" + "".join(
        rng.choice("ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789")
        for _ in range(33)
    )


def _onion(rng: random.Random) -> str:
    return "".join(rng.choice("abcdefghijklmnopqrstuvwxyz234567") for _ in range(56)) + ".onion"


def _handle(rng: random.Random) -> str:
    a = ["night", "iron", "rupee", "zero", "narmada", "silk", "ghost", "cobalt", "vault", "ember"]
    b = ["owl", "hand", "forge", "net", "kaka", "route", "fox", "byte", "supply", "gate"]
    return f"{rng.choice(a)}{rng.choice(b)}{rng.randint(1, 99)}"


def _render(rng: random.Random, style: dict, category: str, city: str | None) -> tuple[str, str]:
    """Category-level listing text in the persona's style."""
    item = rng.choice(ITEMS[category])
    second = rng.choice(ITEMS[category])
    title = f"{rng.choice(style['greeting'])} {item}"
    parts = [f"{item}{rng.choice(style['connector'])}{second}"]
    if city:
        parts.append(f"delivery {city}" if style["hinglish"] < 0.5 else f"{city} mein delivery")
    if rng.random() < style["hinglish"]:
        parts.append(" ".join(rng.sample(HINGLISH_TOKENS, k=rng.randint(1, 3))))
    parts.append(rng.choice(style["sign"]))
    body = f" {rng.choice(style['connector'])} ".join(parts) + style["ellipsis"]
    return title, body


# --------------------------------------------------------------------------
# Generator
# --------------------------------------------------------------------------


def generate(
    seed: int = 20260920,
    n_actors: int = 120,
    personas_per_actor: int = 3,
    days: int = 90,
    posts_per_persona: int = 12,
    negative_ratio: int = 20,
) -> Testbed:
    """Sized so Phase 7 can actually calibrate.

    Conformal prediction at alpha=0.05 bounds the false-merge rate on a
    held-out split; that needs enough POSITIVE pairs to be meaningful. An
    earlier 40-actor run produced 21 positives, which would leave ~10 in
    validation -- statistically useless. 120 actors with up to 3 personas
    yields ~200 positive pairs. `negative_ratio` caps the imbalance at a
    trainable 20:1 rather than letting it run to 134:1.
    """
    rng = random.Random(seed)
    tb = Testbed()
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)

    def add_posts(p: TPersona, start_day: int, end_day: int, n: int) -> None:
        style = STYLE_A if p.style == "A" else STYLE_B
        for i in range(n):
            day = rng.randint(start_day, max(start_day, end_day))
            # Personas post in a characteristic hour band - the behavioural
            # signal Phase 5 measures. Agora cannot supply this (DEC-018).
            hour = (rng.randint(18, 23) if p.style == "A" else rng.randint(6, 12)) % 24
            ts = t0 + timedelta(days=day, hours=hour, minutes=rng.randint(0, 59))
            cat = rng.choice(CATEGORIES)
            city = rng.choice(CITIES) if rng.random() < 0.55 else None
            title, body = _render(rng, style, cat, city)
            tb.posts.append(
                TPost(
                    id=f"{p.id}-post-{i:03d}",
                    persona_id=p.id,
                    market=p.market,
                    ts=ts.isoformat(),
                    title=title,
                    body=body,
                    price=round(rng.uniform(0.01, 2.5), 6),
                    category=cat,
                    raw_pgp=p.pgp_fpr if (p.pgp_fpr and i == 0) else None,
                )
            )

    # ---- Case 1: ordinary + multi-persona actors -------------------------
    for a in range(n_actors):
        actor_id = f"actor-{a:03d}"
        style = "A" if rng.random() < 0.5 else "B"
        shared_pgp = _pgp_fpr(rng)
        shared_wallet = _wallet(rng)
        # Some actors run several handles sharing a hard identifier.
        # 70% of actors run more than one handle, so positives are plentiful.
        roll = rng.random()
        k = personas_per_actor if roll < 0.35 else (2 if roll < 0.70 else 1)
        markets = rng.sample(MARKETS, k=min(k, len(MARKETS)))
        made: list[TPersona] = []
        for j, market in enumerate(markets):
            p = TPersona(
                id=f"{actor_id}-p{j}",
                actor_id=actor_id,
                market=market,
                handle=_handle(rng),
                first_seen=(t0 + timedelta(days=rng.randint(0, 10))).isoformat(),
                last_seen=(t0 + timedelta(days=rng.randint(days - 15, days))).isoformat(),
                style=style,
                # The shared hard identifier is what makes them one actor.
                pgp_fpr=shared_pgp if rng.random() < 0.8 else None,
                wallet=shared_wallet if rng.random() < 0.7 else _wallet(rng),
                email=f"{_handle(rng)}@protonmail.test" if rng.random() < 0.3 else None,
                bio=f"Vendor since 2024. {rng.choice(['Escrow only.', 'FE trusted.', 'Bulk ok.'])}",
            )
            tb.personas.append(p)
            made.append(p)
            add_posts(p, 0, days, posts_per_persona)

        for i in range(len(made)):
            for j in range(i + 1, len(made)):
                tb.labels.append(
                    TPairLabel(
                        pair_id=f"{made[i].id}|{made[j].id}",
                        persona_a=made[i].id,
                        persona_b=made[j].id,
                        same_actor=True,
                        case="multi_persona",
                        notes="same actor, shared hard identifier",
                    )
                )

    # ---- Case 2: rebrand -------------------------------------------------
    # A goes dark at day 40; B is born day 45 with the same style and a wallet
    # lineage edge. Same actor, but NO shared PGP - only style + timing + money.
    reb_actor = "actor-rebrand"
    # DISTINCT wallets joined by a lineage (transfer) edge, not one shared
    # address. If they shared an address the pair would be solved trivially by
    # hard-identifier WCC, and the case would prove nothing about style or
    # timing -- which is the only thing it exists to prove.
    wallet_before = _wallet(rng)
    wallet_after = _wallet(rng)
    before = TPersona(
        id="rebrand-before", actor_id=reb_actor, market="Evolution", handle=_handle(rng),
        first_seen=(t0 + timedelta(days=5)).isoformat(),
        last_seen=(t0 + timedelta(days=40)).isoformat(),
        style="B", wallet=wallet_before, role="rebrand_before",
        wallet_lineage_to=wallet_after,
        bio="Reliable vendor. Escrow only.",
    )
    after = TPersona(
        id="rebrand-after", actor_id=reb_actor, market="Nucleus", handle=_handle(rng),
        first_seen=(t0 + timedelta(days=45)).isoformat(),
        last_seen=(t0 + timedelta(days=days)).isoformat(),
        style="B", wallet=wallet_after, role="rebrand_after",
        bio="New shop, old hands. Escrow only.",
    )
    tb.personas += [before, after]
    add_posts(before, 5, 40, posts_per_persona)
    add_posts(after, 45, days, posts_per_persona)
    tb.labels.append(
        TPairLabel(
            pair_id=f"{before.id}|{after.id}", persona_a=before.id, persona_b=after.id,
            same_actor=True, case="rebrand",
            notes=(
                "death day 40, birth day 45, same style, wallet LINEAGE edge "
                "(distinct addresses, funds flowed before->after), no shared PGP. "
                "Solvable only by temporal + linguistic + financial-lineage evidence."
            ),
        )
    )

    # ---- Case 3: infra leak ---------------------------------------------
    # An onion whose certificate CN names a clearnet domain we control.
    infra = TPersona(
        id="infra-leak", actor_id="actor-infra", market="AlphaBay", handle=_handle(rng),
        first_seen=t0.isoformat(), last_seen=(t0 + timedelta(days=days)).isoformat(),
        style="A", pgp_fpr=_pgp_fpr(rng), wallet=_wallet(rng),
        onion=_onion(rng), role="infra", bio="Vendor shop. Mirrors available.",
    )
    tb.personas.append(infra)
    add_posts(infra, 0, days, posts_per_persona)

    # ---- Case 4: decoy (must-not-link) ----------------------------------
    # Copies the target's bio VERBATIM, overlapping activity, same style --
    # but a different PGP and no shared wallet. The correct answer is "not
    # the same actor", and the copied bio must trigger mimicry_suspected.
    target = tb.personas[0]
    decoy = TPersona(
        id="decoy", actor_id="actor-decoy", market="Dream", handle=_handle(rng),
        first_seen=target.first_seen, last_seen=target.last_seen,
        style=target.style,
        pgp_fpr=_pgp_fpr(rng),   # DIFFERENT key - the hard evidence against
        wallet=_wallet(rng),      # different wallet
        role="decoy",
        bio=target.bio,           # verbatim copy - the trap
    )
    tb.personas.append(decoy)
    add_posts(decoy, 0, days, posts_per_persona)
    tb.labels.append(
        TPairLabel(
            pair_id=f"{target.id}|{decoy.id}", persona_a=target.id, persona_b=decoy.id,
            same_actor=False, case="decoy", must_not_link=True,
            notes="verbatim bio copy, overlapping window, same style, DIFFERENT pgp and wallet",
        )
    )

    # ---- Negative pairs --------------------------------------------------
    # Unrelated pairs so precision is measurable, not just recall.
    ids = [p.id for p in tb.personas]
    seen = {lab.pair_id for lab in tb.labels}
    n_pos = sum(1 for x in tb.labels if x.same_actor)
    want_neg = n_pos * negative_ratio
    tries = 0
    while sum(1 for x in tb.labels if x.case == "unrelated") < want_neg and tries < want_neg * 40:
        tries += 1
        a, b = rng.sample(ids, 2)
        pa = next(p for p in tb.personas if p.id == a)
        pb = next(p for p in tb.personas if p.id == b)
        if pa.actor_id == pb.actor_id:
            continue
        pid = f"{a}|{b}"
        if pid in seen:
            continue
        seen.add(pid)
        tb.labels.append(
            TPairLabel(pair_id=pid, persona_a=a, persona_b=b, same_actor=False, case="unrelated")
        )

    tb.meta = {
        "seed": seed,
        "n_actors": n_actors,
        "days": days,
        "personas": len(tb.personas),
        "posts": len(tb.posts),
        "labels": len(tb.labels),
        "positive_pairs": sum(1 for x in tb.labels if x.same_actor),
        "negative_pairs": sum(1 for x in tb.labels if not x.same_actor),
        "must_not_link": sum(1 for x in tb.labels if x.must_not_link),
        "cases": sorted({x.case for x in tb.labels}),
    }
    return tb


# --------------------------------------------------------------------------
# Output
# --------------------------------------------------------------------------


def labels_digest(tb: Testbed) -> str:
    """Stable hash of the label set. Same seed must give the same digest."""
    payload = json.dumps(
        [asdict(x) for x in sorted(tb.labels, key=lambda l: l.pair_id)],
        sort_keys=True, separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def write(tb: Testbed, out_dir: str | Path) -> dict[str, str]:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    written: dict[str, str] = {}

    for name, rows in (
        ("personas", [asdict(p) for p in tb.personas]),
        ("posts", [asdict(p) for p in tb.posts]),
        ("labels", [asdict(x) for x in tb.labels]),
    ):
        path = out / f"{name}.json"
        path.write_text(json.dumps(rows, indent=2, sort_keys=True), encoding="utf-8")
        written[name] = str(path)

    # labels.parquet is what the playbook names; JSON is the portable mirror.
    try:
        import pandas as pd

        pd.DataFrame([asdict(x) for x in tb.labels]).to_parquet(out / "labels.parquet", index=False)
        written["labels_parquet"] = str(out / "labels.parquet")
    except Exception:  # noqa: BLE001 - parquet is a convenience, never a hard dep
        pass

    meta = dict(tb.meta)
    meta["labels_digest"] = labels_digest(tb)
    (out / "meta.json").write_text(json.dumps(meta, indent=2, sort_keys=True), encoding="utf-8")
    written["meta"] = str(out / "meta.json")
    return written


if __name__ == "__main__":  # pragma: no cover
    import sys

    tb = generate()
    target = sys.argv[1] if len(sys.argv) > 1 else "fixtures/testbed"
    paths = write(tb, target)
    print(json.dumps({**tb.meta, "digest": labels_digest(tb), "files": paths}, indent=2))
