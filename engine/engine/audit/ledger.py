"""Append-only audit ledger: canonical JSON, keccak-256 hash chain, Ed25519.

The claim this supports is narrow and testable: **nobody changed the record
after the fact, and we can prove which analyst made each decision.**

Three layers, each defeating a different attacker:

  CANONICAL JSON   sorted keys, no whitespace, UTF-8, no NaN. Two systems must
                   serialise the same record to the same bytes, or the hash
                   proves nothing.

  HASH CHAIN       hash_n = keccak(prev_hash || leaf_n). Editing record k
                   breaks every hash from k onward, and verification reports
                   the failing INDEX -- not just "invalid".

  Ed25519          each record signed by the analyst. An attacker with full
                   database write access still cannot forge a signature
                   without the private key, which never touches the server.

That last point is the threat model D3.3 attacks: write access to the DB, but
not the analyst's key or the anchorer wallet.
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

log = logging.getLogger(__name__)

GENESIS = "0x" + "00" * 32

# Actions that must be recorded. An action absent from this list cannot be
# written to the ledger at all - the set is closed on purpose.
ACTIONS = (
    "confirm", "reject", "assign", "note", "seal", "export", "score",
)


def keccak256(data: bytes) -> str:
    """keccak-256, matching Solidity's `keccak256` exactly.

    NOT sha3-256. They differ in padding, and using the wrong one would make
    on-chain verification silently fail against off-chain hashes.
    """
    try:
        from eth_hash.auto import keccak

        return "0x" + keccak(data).hex()
    except Exception:  # noqa: BLE001
        from Crypto.Hash import keccak as _k

        h = _k.new(digest_bits=256)
        h.update(data)
        return "0x" + h.hexdigest()


def canonical_json(obj: Any) -> bytes:
    """Deterministic serialisation. The same record must always give the same bytes."""
    return json.dumps(
        obj,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    ).encode("utf-8")


@dataclass
class AuditRecord:
    seq: int
    case_id: str
    actor: str
    action: str
    payload: dict
    ts: str
    prev_hash: str
    hash: str = ""
    signature: str | None = None
    pubkey: str | None = None

    def leaf_bytes(self) -> bytes:
        """The signed and hashed content. Excludes hash/signature by design:
        a record cannot commit to its own hash."""
        return canonical_json({
            "seq": self.seq,
            "case_id": self.case_id,
            "actor": self.actor,
            "action": self.action,
            "payload": self.payload,
            "ts": self.ts,
            "prev_hash": self.prev_hash,
        })

    def leaf_hash(self) -> str:
        return keccak256(self.leaf_bytes())

    def compute_hash(self) -> str:
        prev = bytes.fromhex(self.prev_hash[2:])
        leaf = bytes.fromhex(self.leaf_hash()[2:])
        return keccak256(prev + leaf)

    def as_dict(self) -> dict:
        return asdict(self)


# --------------------------------------------------------------------------
# Analyst keys
# --------------------------------------------------------------------------


def generate_keypair() -> tuple[str, str]:
    """(private_hex, public_hex). The private key never leaves the analyst."""
    from nacl.signing import SigningKey

    sk = SigningKey.generate()
    return sk.encode().hex(), sk.verify_key.encode().hex()


def sign(private_hex: str, message: bytes) -> str:
    from nacl.signing import SigningKey

    return SigningKey(bytes.fromhex(private_hex)).sign(message).signature.hex()


def verify_signature(public_hex: str, message: bytes, signature_hex: str) -> bool:
    """True only for a genuine signature. Never raises on bad input."""
    try:
        from nacl.signing import VerifyKey

        VerifyKey(bytes.fromhex(public_hex)).verify(message, bytes.fromhex(signature_hex))
        return True
    except Exception:  # noqa: BLE001
        return False


# --------------------------------------------------------------------------
# Ledger
# --------------------------------------------------------------------------


@dataclass
class Ledger:
    case_id: str
    records: list[AuditRecord] = field(default_factory=list)

    def head(self) -> str:
        return self.records[-1].hash if self.records else GENESIS

    def append(
        self,
        actor: str,
        action: str,
        payload: dict,
        private_hex: str | None = None,
        public_hex: str | None = None,
        ts: str | None = None,
    ) -> AuditRecord:
        if action not in ACTIONS:
            raise ValueError(f"Unknown audit action: {action}. Allowed: {ACTIONS}")

        rec = AuditRecord(
            seq=len(self.records),
            case_id=self.case_id,
            actor=actor,
            action=action,
            payload=payload,
            ts=ts or datetime.now(timezone.utc).isoformat(),
            prev_hash=self.head(),
        )
        rec.hash = rec.compute_hash()
        if private_hex:
            rec.signature = sign(private_hex, rec.leaf_bytes())
            rec.pubkey = public_hex
        self.records.append(rec)
        return rec

    def leaves(self) -> list[str]:
        return [r.leaf_hash() for r in self.records]

    def as_dict(self) -> dict:
        return {"case_id": self.case_id, "records": [r.as_dict() for r in self.records]}


@dataclass
class Verification:
    ok: bool
    n_records: int
    failing_index: int | None = None
    reason: str | None = None
    checks: dict = field(default_factory=dict)

    def as_dict(self) -> dict:
        return asdict(self)


def verify(records: list[dict], known_keys: dict[str, str] | None = None) -> Verification:
    """Walk the chain and report the FIRST failing index.

    "Invalid" is not a useful answer to a court. Which record, and why, is.
    """
    prev = GENESIS
    sigs_ok = sigs_seen = 0

    for i, raw in enumerate(records):
        try:
            rec = AuditRecord(
                seq=raw["seq"], case_id=raw["case_id"], actor=raw["actor"],
                action=raw["action"], payload=raw["payload"], ts=raw["ts"],
                prev_hash=raw["prev_hash"], hash=raw.get("hash", ""),
                signature=raw.get("signature"), pubkey=raw.get("pubkey"),
            )
        except KeyError as exc:
            return Verification(False, len(records), i, f"Record {i} is missing field {exc}")

        # A gap in seq is itself tamper evidence: a deleted middle record.
        if rec.seq != i:
            return Verification(False, len(records), i,
                                f"Record {i} has seq {rec.seq}: a record was deleted or reordered.")

        if rec.prev_hash != prev:
            return Verification(False, len(records), i,
                                f"Record {i} prev_hash does not match record {i - 1}'s hash.")

        recomputed = rec.compute_hash()
        if recomputed != rec.hash:
            return Verification(False, len(records), i,
                                f"Record {i} content was altered: hash does not match its payload.")

        if rec.signature and rec.pubkey:
            sigs_seen += 1
            expected = (known_keys or {}).get(rec.actor)
            if expected and expected != rec.pubkey:
                return Verification(False, len(records), i,
                                    f"Record {i} is signed by a key not registered to {rec.actor}.")
            if not verify_signature(rec.pubkey, rec.leaf_bytes(), rec.signature):
                return Verification(False, len(records), i,
                                    f"Record {i} has an invalid Ed25519 signature.")
            sigs_ok += 1

        prev = rec.hash

    return Verification(
        ok=True, n_records=len(records),
        checks={"chain": "intact", "signatures_verified": sigs_ok,
                "signatures_present": sigs_seen, "head": prev},
    )
