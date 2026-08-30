"""In-memory case ledgers for Phase 8. Postgres persistence lands in Phase 9."""

from __future__ import annotations

from functools import lru_cache

from ..fusion import eval as E
from .ledger import Ledger, generate_keypair, keccak256

DEMO_ANALYST = "officer@mp.gov.in"
_KEYS: dict[str, tuple[str, str]] = {}
_LEDGERS: dict[str, Ledger] = {}
_SEALS: dict[str, dict] = {}


def keys_for(analyst: str) -> tuple[str, str]:
    """Demo keypair. In production the private half never reaches the server."""
    if analyst not in _KEYS:
        _KEYS[analyst] = generate_keypair()
    return _KEYS[analyst]


def public_keys() -> dict[str, str]:
    return {a: pub for a, (_, pub) in _KEYS.items()}


def case_ref(case_id: str) -> str:
    """Only the HASH of the reference goes on chain, never the identifier."""
    return keccak256(case_id.encode())


@lru_cache(maxsize=1)
def _seed() -> None:
    """A pre-seeded case so the demo has a real ledger to show."""
    priv, pub = keys_for(DEMO_ANALYST)
    lg = Ledger("CASE-001")
    ds = E.build_signals()
    ps = ds.by_pair.get("rebrand-before|rebrand-after")
    if ps:
        lg.append(DEMO_ANALYST, "score",
                  {"pair_id": ps.pair_id, "p_raw": ps.p_raw,
                   "roots": sorted(ps.roots_used)}, priv, pub)
    lg.append(DEMO_ANALYST, "confirm", {"pair_id": "rebrand-before|rebrand-after"}, priv, pub)
    lg.append(DEMO_ANALYST, "assign", {"officer": "SI A. Yadav"}, priv, pub)
    lg.append(DEMO_ANALYST, "note", {"text": "Rebrand candidate; field unit notified."}, priv, pub)
    _LEDGERS["CASE-001"] = lg


def ledger(case_id: str) -> Ledger:
    _seed()
    if case_id not in _LEDGERS:
        _LEDGERS[case_id] = Ledger(case_id)
    return _LEDGERS[case_id]


def all_cases() -> list[str]:
    _seed()
    return sorted(_LEDGERS)


def set_seal(case_id: str, data: dict) -> None:
    _SEALS[case_id] = data


def get_seal(case_id: str) -> dict | None:
    return _SEALS.get(case_id)
