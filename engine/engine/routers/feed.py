"""DATASET-mode feed.

Phase 2 returns an empty list -- the contract exists so the web store's third
tick() branch can be wired and tested before Phase 3 has any data. The shape is
v1's Intercept exactly (docs/ARCHITECTURE.md section 4), so the workbench needs
no type change when real listings arrive.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from ..ingest.dataset import page

router = APIRouter(tags=["feed"])


@router.get("/feed")
def feed(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict[str, object]:
    result = page(limit=limit, offset=offset)
    return {
        "ok": True,
        "mode": "dataset",
        "source": "Agora 2014-2015 (public academic dataset)",
        # Stated in the payload so the UI cannot imply otherwise: this dataset
        # carries no Madhya Pradesh geography and no timestamps (DEC-018).
        "geofenced": False,
        **result,
    }
