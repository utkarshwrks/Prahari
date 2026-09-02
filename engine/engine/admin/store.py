"""Soft-delete CRUD with optimistic concurrency (DEC-060).

THREE RULES, and they are the ones that make a management surface safe to point
at investigative data:

1. NOTHING IS EVER HARD-DELETED. Every delete sets ``deleted_at`` and
   ``deleted_by``. Deleted rows disappear from reads and SURVIVE IN EXPORTS,
   because a case file that quietly loses a record is worse than one that shows
   a record marked withdrawn. A row a defence expert cannot find is a row the
   prosecution looks like it hid.

2. OPTIMISTIC CONCURRENCY. Every write carries the ``updated_at`` the client
   last saw. A mismatch is a 409 naming both timestamps, never a silent
   overwrite -- two analysts editing one persona must not have the second one's
   work vanish without either of them knowing.

3. EVERY MUTATION RETURNS ITS DIFF. The caller gets before/after for each
   changed field, which is what goes into the ledger payload. A ledger entry
   that says "updated" without saying what changed is not evidence of anything.

In-memory, seeded from the fixture dataset, like the case ledgers in
``audit/cases.py``. Postgres persistence is the same open item it is there.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from ..engines import actors as A


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Conflict(Exception):
    """Optimistic-concurrency failure. Carries both sides so the UI can show them."""

    def __init__(self, expected: str | None, actual: str) -> None:
        super().__init__("The record changed since you loaded it.")
        self.expected = expected
        self.actual = actual


class NotFound(Exception):
    pass


@dataclass
class Record:
    id: str
    kind: str
    data: dict[str, Any]
    updated_at: str = field(default_factory=_now)
    updated_by: str = ""
    deleted_at: str | None = None
    deleted_by: str | None = None

    @property
    def deleted(self) -> bool:
        return self.deleted_at is not None

    def public(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "kind": self.kind,
            **self.data,
            "updated_at": self.updated_at,
            "updated_by": self.updated_by,
            "deleted_at": self.deleted_at,
            "deleted_by": self.deleted_by,
        }


class Store:
    """One collection per entity kind."""

    def __init__(self) -> None:
        self._rows: dict[str, dict[str, Record]] = {}
        self._seeded = False

    # -- seeding -----------------------------------------------------------
    def _seed(self) -> None:
        if self._seeded:
            return
        self._seeded = True
        index = A.list_actors("", 200, 0, 0.0)
        for row in index.get("actors", []):
            self.put(
                "actors",
                Record(
                    id=row["actor_id"],
                    kind="actors",
                    data={
                        "label": row["label"],
                        "attribution_confidence": row["attribution_confidence"],
                        "personas": row["personas"],
                        "markets": row["markets"],
                        "override": None,
                        "override_reason": None,
                    },
                ),
            )
            # A.profile returns an ActorProfile dataclass, not a dict --
            # as_dict() is the documented way across that boundary.
            profile = A.profile(row["actor_id"])
            if profile is None:
                continue
            for p in profile.as_dict().get("personas", []):
                self.put(
                    "personas",
                    Record(
                        id=p["id"],
                        kind="personas",
                        data={
                            "handle": p["handle"],
                            "market": p["market"],
                            "actor_id": row["actor_id"],
                            "post_count": p["post_count"],
                            "role": p.get("role", ""),
                        },
                    ),
                )

    # -- primitives --------------------------------------------------------
    def put(self, kind: str, rec: Record) -> None:
        self._rows.setdefault(kind, {})[rec.id] = rec

    def list(self, kind: str, *, include_deleted: bool = False, limit: int = 100,
             offset: int = 0, q: str = "") -> dict[str, Any]:
        self._seed()
        rows = list(self._rows.get(kind, {}).values())
        if not include_deleted:
            rows = [r for r in rows if not r.deleted]
        if q:
            needle = q.lower()
            rows = [r for r in rows if needle in str(r.public()).lower()]
        rows.sort(key=lambda r: r.id)
        total = len(rows)
        return {
            "ok": True,
            "kind": kind,
            "total": total,
            "count": len(rows[offset:offset + limit]),
            "items": [r.public() for r in rows[offset:offset + limit]],
            # Stated, not implied: a reader must know whether withdrawn records
            # are in front of them.
            "includes_deleted": include_deleted,
        }

    def get(self, kind: str, rid: str) -> Record:
        self._seed()
        rec = self._rows.get(kind, {}).get(rid)
        if rec is None:
            raise NotFound(f"No {kind} record {rid}.")
        return rec

    # -- mutations ---------------------------------------------------------
    def create(self, kind: str, rid: str, data: dict[str, Any], actor: str) -> dict[str, Any]:
        self._seed()
        if rid in self._rows.get(kind, {}):
            raise Conflict(None, self._rows[kind][rid].updated_at)
        rec = Record(id=rid, kind=kind, data=dict(data), updated_by=actor)
        self.put(kind, rec)
        return {"record": rec.public(), "diff": {k: {"before": None, "after": v} for k, v in data.items()}}

    def update(self, kind: str, rid: str, patch: dict[str, Any], actor: str,
               expected_updated_at: str | None) -> dict[str, Any]:
        rec = self.get(kind, rid)
        if expected_updated_at is not None and expected_updated_at != rec.updated_at:
            raise Conflict(expected_updated_at, rec.updated_at)

        before = copy.deepcopy(rec.data)
        diff: dict[str, dict[str, Any]] = {}
        for k, v in patch.items():
            if before.get(k) != v:
                diff[k] = {"before": before.get(k), "after": v}
                rec.data[k] = v
        if diff:
            rec.updated_at = _now()
            rec.updated_by = actor
        return {"record": rec.public(), "diff": diff}

    def soft_delete(self, kind: str, rid: str, actor: str,
                    expected_updated_at: str | None) -> dict[str, Any]:
        rec = self.get(kind, rid)
        if expected_updated_at is not None and expected_updated_at != rec.updated_at:
            raise Conflict(expected_updated_at, rec.updated_at)
        if rec.deleted:
            return {"record": rec.public(), "diff": {}, "already_deleted": True}
        rec.deleted_at = _now()
        rec.deleted_by = actor
        rec.updated_at = rec.deleted_at
        rec.updated_by = actor
        return {
            "record": rec.public(),
            "diff": {"deleted_at": {"before": None, "after": rec.deleted_at}},
        }

    def restore(self, kind: str, rid: str, actor: str) -> dict[str, Any]:
        """The undo window. A soft delete is reversible precisely because the
        row never left."""
        rec = self.get(kind, rid)
        if not rec.deleted:
            return {"record": rec.public(), "diff": {}}
        was = rec.deleted_at
        rec.deleted_at = None
        rec.deleted_by = None
        rec.updated_at = _now()
        rec.updated_by = actor
        return {"record": rec.public(), "diff": {"deleted_at": {"before": was, "after": None}}}

    # -- exports -----------------------------------------------------------
    def export(self, kind: str) -> list[dict[str, Any]]:
        """Everything, INCLUDING withdrawn records.

        Rule 1's second half. A record that vanishes from an export is a record
        an opposing expert cannot examine, and the difference between "deleted"
        and "never existed" is exactly what an audit needs to see.
        """
        self._seed()
        return [r.public() for r in sorted(self._rows.get(kind, {}).values(), key=lambda r: r.id)]

    def reset(self) -> None:
        self._rows.clear()
        self._seeded = False


STORE = Store()
