# PRAHARI engine — FastAPI on Python 3.12, with Tor for the live timing demo.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# tor: the live timing testbed launches a real hidden service + client.
# curl: container health checks. build-essential: any sdist that needs compiling.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tor curl build-essential \
 && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

WORKDIR /app
# Copy the engine project (build context is the repo root; see .dockerignore).
COPY engine/ /app/

# Install locked deps into an in-project venv.
RUN uv sync --frozen --no-dev

ENV PORT=8000 \
    ENVIRONMENT=production \
    CORS_ORIGINS=* \
    RPC_URL=https://rpc-amoy.polygon.technology \
    CHAIN_ID=80002

EXPOSE 8000
# Shell form so Render's dynamic $PORT is expanded.
CMD uv run uvicorn engine.main:app --host 0.0.0.0 --port ${PORT:-8000}
