# PRAHARI Engine

FastAPI attribution engine for PRAHARI v2. Stages 0-3 and 5 of the pipeline:
ingest, extract, the four engines, evidence fusion, and the immutable audit ledger.

## Run

```bash
uv venv --python 3.12
uv pip install -e ".[dev]"
uv run uvicorn engine.main:app --reload --port 8000
```

Or from the repo root: `npm run engine`.

## Contract

The engine boots with **no `.env`**, with **Postgres down**, and with **every optional key absent**.
Anything it cannot do is reported by `GET /version` under `capabilities`, each with a human-actionable
reason. It never fails at import, and it never claims a capability it does not have.

| Endpoint | Purpose |
|---|---|
| `GET /health` | liveness, database reachability, scheduler state |
| `GET /version` | version and the honest capability matrix |
| `GET /feed` | DATASET-mode items in v1 `Intercept` shape (empty until Phase 3) |
| `GET /sources` | source inventory with `last_scan`, `freshness_s`, `items_24h` |

Python is pinned to `>=3.11,<3.13` per DEC-012 — spaCy, PyTorch CPU and Splink do not
reliably publish wheels for 3.14.
