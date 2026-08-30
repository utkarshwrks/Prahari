"""Loaders and adapters, against the committed real fixture."""

from __future__ import annotations

from pathlib import Path

import pytest

from engine.ingest.dataset import page
from engine.ingest.kaggle_agora import load

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "agora_sample.csv"

pytestmark = pytest.mark.skipif(not FIXTURE.exists(), reason="agora fixture absent")


def test_fixture_is_real_agora_data():
    """The fixture must be a genuine sample, never fabricated rows."""
    header = FIXTURE.read_text(encoding="utf-8", errors="replace").splitlines()[0]
    for col in ("Vendor", "Category", "Item", "Price"):
        assert col in header


def test_loader_normalises_to_persona_and_post():
    r = load(FIXTURE)
    assert r.rows_read > 0
    assert r.personas and r.posts
    p = r.posts[0]
    assert p.persona_id.startswith("agora:")
    assert p.market == "Agora"


def test_no_rows_are_silently_lost():
    r = load(FIXTURE)
    assert r.rows_read + r.rows_skipped >= len(r.posts)
    assert r.rows_skipped == 0


def test_agora_has_no_timestamps():
    """DEC-018. If this ever fails the dataset changed and Phase 5's temporal
    story can be revisited -- it is currently testbed-only for this reason."""
    r = load(FIXTURE)
    assert all(p.ts is None for p in r.posts)
    assert r.stats["has_timestamps"] is False


def test_blocklist_drops_how_to_bodies_and_counts_them():
    r = load(FIXTURE)
    assert isinstance(r.bodies_blocked, int)
    # The count is reported so filtering is auditable, never invisible.
    assert r.stats["bodies_blocked"] == r.bodies_blocked


def test_blocklist_actually_matches_synthesis_language():
    from engine.ingest.kaggle_agora import _BLOCK_RE

    for bad in ["full synthesis writeup", "step-by-step guide", "how to make it",
                "extraction method inside", "complete tutorial"]:
        assert _BLOCK_RE.search(bad), bad
    for ok in ["100g crystal, ships from NL", "sealed pack, stealth shipping"]:
        assert not _BLOCK_RE.search(ok), ok


def test_price_parsing():
    from engine.ingest.kaggle_agora import _price

    assert _price("0.05027025666666667 BTC") == pytest.approx(0.05027, rel=1e-3)
    assert _price("") is None
    assert _price("not a price") is None


def test_dataset_page_shapes_v1_intercepts():
    d = page(limit=5)
    assert d["count"] <= 5
    for item in d["items"]:
        for k in ("id", "source", "rawText", "entities", "severity"):
            assert k in item
        for k in ("locations", "contraband", "wallets", "handles"):
            assert k in item["entities"]


def test_dataset_items_never_claim_a_geofence_hit():
    """Agora contains zero MP geography (DEC-018). A DATASET item that reported
    an in-zone city would be fabricating a breach."""
    d = page(limit=50)
    for item in d["items"]:
        assert item["entities"]["locations"] == []


def test_dataset_pagination():
    a = page(limit=3, offset=0)
    b = page(limit=3, offset=3)
    if a["total"] > 6:
        assert [i["id"] for i in a["items"]] != [i["id"] for i in b["items"]]
