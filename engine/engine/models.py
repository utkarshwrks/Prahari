"""SQLAlchemy models - the nine tables from Phase 2 obj 4.

Shapes follow docs/ARCHITECTURE.md section 4. Nothing here is speculative: every
column exists because a later phase named it.

Note on `signals.root`: the six root causes are the heart of the confidence
model (DEC-003). Grouping by root is what stops one underlying fact being
counted five times, so the value is constrained here rather than left free-text.
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class SignalRoot(str, enum.Enum):
    """Root cause of a signal. Signals sharing a root collapse to their max LR."""

    identity_key = "identity_key"
    financial = "financial"
    infra = "infra"
    linguistic = "linguistic"
    temporal = "temporal"
    social = "social"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


# --------------------------------------------------------------------------
# Stage 0-1: collection and extraction
# --------------------------------------------------------------------------


class Source(Base, TimestampMixin):
    """A data source and its freshness. Backs GET /sources."""

    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)  # osint|dataset|chain|infra
    requires_key: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_scan: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    items_24h: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text)


class Persona(Base, TimestampMixin):
    """One handle on one marketplace. Personas are what we link; actors emerge."""

    __tablename__ = "personas"
    __table_args__ = (
        UniqueConstraint("market", "handle", name="uq_persona_market_handle"),
        Index("ix_persona_actor", "actor_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    market: Mapped[str] = mapped_column(String(64), nullable=False)
    handle: Mapped[str] = mapped_column(String(128), nullable=False)
    first_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Filled by Phase 4 GDS weakly-connected-components. Null until resolved.
    actor_id: Mapped[str | None] = mapped_column(String(64))

    posts: Mapped[list[Post]] = relationship(back_populates="persona")


class Post(Base, TimestampMixin):
    """A listing or forum post. Category-level text only - never how-to content."""

    __tablename__ = "posts"
    __table_args__ = (Index("ix_post_persona_ts", "persona_id", "ts"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    persona_id: Mapped[int] = mapped_column(ForeignKey("personas.id", ondelete="CASCADE"))
    market: Mapped[str] = mapped_column(String(64), nullable=False)
    ts: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    title: Mapped[str | None] = mapped_column(Text)
    body: Mapped[str | None] = mapped_column(Text)
    price: Mapped[float | None] = mapped_column(Float)
    category: Mapped[str | None] = mapped_column(String(64))
    raw_pgp: Mapped[str | None] = mapped_column(Text)
    source_ref: Mapped[str | None] = mapped_column(String(255))

    persona: Mapped[Persona] = relationship(back_populates="posts")


class Entity(Base, TimestampMixin):
    """An extracted identifier: pgp, wallet, email, telegram, onion, domain, city."""

    __tablename__ = "entities"
    __table_args__ = (
        UniqueConstraint("kind", "value", name="uq_entity_kind_value"),
        Index("ix_entity_kind", "kind"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    value: Mapped[str] = mapped_column(String(512), nullable=False)
    # Which extractor produced this - the honest badge, persisted.
    extractor: Mapped[str | None] = mapped_column(String(32))
    confidence: Mapped[float | None] = mapped_column(Float)


# --------------------------------------------------------------------------
# Stage 2-3: signals and fusion
# --------------------------------------------------------------------------


class Signal(Base, TimestampMixin):
    """One piece of evidence about one candidate pair.

    `strength` is the raw per-signal probability s; the fusion layer derives
    LR = s/(1-s) from it. `reliability` is the dampening exponent r.
    """

    __tablename__ = "signals"
    __table_args__ = (Index("ix_signal_pair", "pair_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    pair_id: Mapped[str] = mapped_column(String(128), nullable=False)
    root: Mapped[SignalRoot] = mapped_column(Enum(SignalRoot, name="signal_root"), nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    strength: Mapped[float] = mapped_column(Float, nullable=False)
    reliability: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    provenance: Mapped[dict | None] = mapped_column(JSON)
    # Negative signals (mimicry_suspected, llm_rewrite_suspected) argue AGAINST
    # a link and may cap the final score outright.
    negative: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    cap: Mapped[float | None] = mapped_column(Float)


class PairScore(Base, TimestampMixin):
    """A fused, calibrated confidence for one candidate pair, with its trail."""

    __tablename__ = "pair_scores"
    __table_args__ = (UniqueConstraint("pair_id", name="uq_pairscore_pair"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    pair_id: Mapped[str] = mapped_column(String(128), nullable=False)
    persona_a: Mapped[int | None] = mapped_column(ForeignKey("personas.id", ondelete="SET NULL"))
    persona_b: Mapped[int | None] = mapped_column(ForeignKey("personas.id", ondelete="SET NULL"))
    p_raw: Mapped[float | None] = mapped_column(Float)
    p_calibrated: Mapped[float | None] = mapped_column(Float)
    roots_used: Mapped[dict | None] = mapped_column(JSON)
    roots_collapsed: Mapped[dict | None] = mapped_column(JSON)
    negatives: Mapped[dict | None] = mapped_column(JSON)
    # Every number in the trail must recompute p_raw exactly (D3.2 objective 3).
    trail: Mapped[dict | None] = mapped_column(JSON)
    naive_stack: Mapped[float | None] = mapped_column(Float)


class Case(Base, TimestampMixin):
    """An investigation. Sealed cases carry a Merkle root and an anchor tx."""

    __tablename__ = "cases"

    id: Mapped[int] = mapped_column(primary_key=True)
    ref: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str | None] = mapped_column(String(64))
    category: Mapped[str | None] = mapped_column(String(64))
    severity: Mapped[str | None] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(32), default="Open", nullable=False)
    assignee: Mapped[str | None] = mapped_column(String(128))
    actor_id: Mapped[str | None] = mapped_column(String(64))
    confidence: Mapped[float | None] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(Text)


# --------------------------------------------------------------------------
# Stage 5: immutable audit
# --------------------------------------------------------------------------


class AuditRecord(Base):
    """Append-only hash chain. Never updated, never deleted.

    hash_n = keccak(prev_hash || leaf_n), each record signed with the analyst's
    Ed25519 key. `seq` is per-case and gapless - a gap is itself tamper evidence.
    """

    __tablename__ = "audit_records"
    __table_args__ = (
        UniqueConstraint("case_id", "seq", name="uq_audit_case_seq"),
        Index("ix_audit_case", "case_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"))
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    actor: Mapped[str] = mapped_column(String(128), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSON)
    prev_hash: Mapped[str | None] = mapped_column(String(66))
    hash: Mapped[str] = mapped_column(String(66), nullable=False)
    signature: Mapped[str | None] = mapped_column(String(256))
    pubkey: Mapped[str | None] = mapped_column(String(128))
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Seal(Base, TimestampMixin):
    """A case's Merkle root anchored on chain. Only 32-byte hashes go on chain."""

    __tablename__ = "seals"
    __table_args__ = (UniqueConstraint("root", name="uq_seal_root"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"))
    root: Mapped[str] = mapped_column(String(66), nullable=False)
    leaf_count: Mapped[int] = mapped_column(Integer, nullable=False)
    tx_hash: Mapped[str | None] = mapped_column(String(66))
    chain_id: Mapped[int | None] = mapped_column(Integer)
    block: Mapped[int | None] = mapped_column(Integer)
    # False when sealed against local Anvil. Drives the LOCAL CHAIN badge, and
    # must make a Sepolia explorer link impossible to render (D3.3 objective 5).
    is_public_chain: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    anchored_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class User(Base, TimestampMixin):
    """Analyst accounts. Migrated from v1 data/users.json per DEC-009.

    `ed25519_pubkey` is registered at signup and used to verify audit-record
    signatures on read (Phase 8).
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="analyst", nullable=False)
    ed25519_pubkey: Mapped[str | None] = mapped_column(String(128))
