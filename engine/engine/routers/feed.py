"""DATASET-mode feed.

Phase 2 returns an empty list -- the contract exists so the web store's third
tick() branch can be wired and tested before Phase 3 has any data. The shape is
v1's Intercept exactly (docs/ARCHITECTURE.md section 4), so the workbench needs
no type change when real listings arrive.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

router = APIRouter(tags=["feed"])


@router.get("/feed")
def feed(limit: int = Query(default=20, ge=1, le=100)) -> dict[str, object]:
    return {
        "ok": True,
        "mode": "dataset",
        "items": [],
        "count": 0,
        # An honest empty state, not an error. The UI renders this verbatim.
        "detail": "No dataset loaded. Phase 3 ingests the Agora and DNM archives.",
    }
