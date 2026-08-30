"""POST /extract - mirrors v1's /api/analyze, with the engine's fuller extractor."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..extract.extractor import extract

router = APIRouter(tags=["extract"])

MAX_CHARS = 4000  # same cap as v1's /api/analyze


class ExtractRequest(BaseModel):
    text: str = Field(default="")


@router.post("/extract")
def do_extract(req: ExtractRequest) -> dict:
    # Cannot 500 and cannot raise (INV-3). An empty body is a valid question
    # with an empty answer, not an error.
    result = extract(req.text[:MAX_CHARS])
    return {"ok": True, **result.to_dict()}
